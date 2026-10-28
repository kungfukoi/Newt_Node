import test from "node:test";
import assert from "node:assert/strict";
import { batchEntries, validateBatchEntries, runBatchEntries, buildBatchPlan, materializeBatchGraph, batchChildNode, initializeTextAgentBatches, upstreamBatchTextAgents, batchInputEntryCount, batchInputConnections, migrateBatchOutputEdge } from "../src/batch.js";
import { runMediaBatch } from "../src/nodeRunners/batch.js";
import { buildSelectedRunnableDependencies } from "../src/nodeRunner.js";
import { createFlowConnectionIndex } from "../src/flowNodeConnections.js";
import { clearStaleRunningState } from "../src/workflowState.js";
import { nodeBatchConcurrency } from "../src/nodeScheduling.js";
import { textAgentMessagesForPrompt } from "../src/textAgent.js";
import { runRunnableNodesByDependencyOrder } from "../src/nodeRunner.js";

const connection = (id, url) => ({ source: { id, data: { title: id, resultUrl: url } }, edge: { from: { nodeId: id, port: "imageOut" } } });

test("normal media outputs carry the complete collection into the next processor", () => {
  const source = { id: "processor", type: "utility", data: { batchResults: [{ id: "a", url: "/a.png", type: "image" }, { id: "b", url: "/b.png", type: "image" }] } };
  const target = { id: "next", type: "imageModel", data: {} };
  const edge = { id: "normal-media", from: { nodeId: source.id, port: "utilityOut" }, to: { nodeId: target.id, port: "imagePromptIn" } };
  const inputs = batchInputConnections({ imagePromptIn: [{ source, edge }] });
  const plan = buildBatchPlan(inputs, {}, () => null);
  assert.equal(plan.length, 2);
  for (const entry of plan) {
    const graph = materializeBatchGraph([source, target], [edge], target.id, entry.inputs);
    assert.equal(graph.edges[0].id, edge.id);
    assert.equal(graph.edges[0].from.port, "imageOut");
    assert.equal(graph.nodes.find(node => node.id === graph.edges[0].from.nodeId).data.resultUrl, entry.url);
  }
});

test("ordinary Prompt wires carry per-entry prompts and privately pair media without a second wire", () => {
  const agent = { id: "agent", type: "textAgent", data: { batchResults: [{ id: "a", type: "video", url: "/a.mp4", prompt: "Follow A" }, { id: "b", type: "video", url: "/b.mp4", prompt: "Follow B" }] } };
  const target = { id: "model", type: "videoModel", data: {} };
  const edge = { id: "ordinary-prompt", from: { nodeId: agent.id, port: "promptOut" }, to: { nodeId: target.id, port: "promptIn" } };
  const plan = buildBatchPlan(batchInputConnections({ promptIn: [{ source: agent, edge }] }), {}, () => null);
  for (const entry of plan) {
    const graph = materializeBatchGraph([agent, target], [edge], target.id, entry.inputs, () => "referenceVideoIn");
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0].to.port, "referenceVideoIn");
    const source = graph.nodes.find(node => node.id === graph.edges[0].from.nodeId);
    assert.equal(source.data.resultUrl, entry.url);
    assert.equal(source.data.resultText, entry.prompt);
  }
  assert.equal(edge.to.port, "promptIn");
  assert.equal(agent.data.batchResults.length, 2);
});

test("fresh normal Prompt chains inherit pending batch context and legacy special wires migrate", () => {
  const batch = { id: "batch", type: "batch", data: { batchMediaType: "video", batchFiles: [{ id: "v", type: "video", url: "/v.mp4" }] } };
  const first = { id: "first", type: "textAgent", data: {} }, second = { id: "second", type: "textAgent", data: {} };
  const edges = [{ from: { nodeId: batch.id, port: "batchOut" }, to: { nodeId: first.id, port: "videoIn" } },
    { from: { nodeId: first.id, port: "promptOut" }, to: { nodeId: second.id, port: "textIn" } },
    { from: { nodeId: second.id, port: "promptOut" }, to: { nodeId: "model", port: "promptIn" } }];
  const nodes = initializeTextAgentBatches([batch, first, second], edges);
  assert.equal(nodes[2].data.batchMediaType, "video");
  assert.deepEqual(upstreamBatchTextAgents("model", nodes, edges).map(node => node.id), [first.id, second.id]);
  const legacy = { id: "keep-me", from: { nodeId: first.id, port: "batchOut" }, to: { nodeId: "model", port: "startFrameIn" } };
  const migrated = migrateBatchOutputEdge(legacy, first, {}, "promptOut", "promptIn");
  assert.equal(migrated.id, legacy.id); assert.equal(migrated.from.port, "promptOut"); assert.equal(migrated.to.port, "promptIn");
  assert.equal(legacy.from.port, "batchOut");
  assert.equal(migrateBatchOutputEdge(edges[0], batch, first, "batchOut", "textIn"), edges[0]);
});
test("selected consumer waits for selected producers across a passive Batch", () => {
  const nodes = [{ id: "producer", type: "imageModel" }, { id: "consumer", type: "imageModel" }];
  const dependencies = buildSelectedRunnableDependencies(nodes, [
    { from: { nodeId: "producer", port: "imageOut" }, to: { nodeId: "collection", port: "imageIn" } },
    { from: { nodeId: "collection", port: "batchOut" }, to: { nodeId: "consumer", port: "imagePromptIn" } }
  ]);
  assert.deepEqual(dependencies.get("consumer"), ["producer"]);
});
test("batch retains prompts through reorder and follows updated linked files", () => {
  const node = { data: { batchSettings: { "a:imageOut": { prompt: "Red background" } }, batchOrder: ["b:imageOut", "a:imageOut"] } };
  const entries = batchEntries(node, [connection("a", "/new.png"), connection("b", "/b.png")]);
  assert.deepEqual(entries.map(item => item.id), ["b:imageOut", "a:imageOut"]);
  assert.equal(entries[1].prompt, "Red background");
  assert.equal(entries[1].url, "/new.png");
  assert.throws(() => validateBatchEntries(batchEntries(node, [connection("a", "")])), /no media/);
  assert.throws(() => validateBatchEntries([]), /Add media/);
});
test("batch runs concurrently with bounded admission and stable output order despite a failure", async () => {
  let active = 0, maximum = 0;
  const results = await runBatchEntries([0, 1, 2, 3, 4], { concurrency: 3, run: async value => {
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, (5 - value) * 4));
    active--;
    if (value === 1) throw new Error("Provider failed");
    return value;
  } });
  assert.equal(maximum, 3);
  assert.deepEqual(results.map(item => item.status === "fulfilled" ? item.value : "failed"), [0, "failed", 2, 3, 4]);
});
test("Stop leaves queued entries unsubmitted", async () => {
  let stopped = false;
  const submitted = [];
  await runBatchEntries([0, 1, 2, 3, 4], { stopped: () => stopped, run: async value => {
    submitted.push(value); stopped = true; return value;
  } });
  assert.deepEqual(submitted, [0]);
});

test("video collections keep type, snapshot each port and reject mixed or mismatched batches", () => {
  const video = { id: "videos", type: "batch", data: { batchFiles: [{ id: "v1", type: "video", url: "/one.mp4", label: "One" }, { id: "v2", type: "video", url: "/two.mp4", label: "Two" }] } };
  const target = { id: "target", type: "videoModel", data: {} };
  const edge = { from: { nodeId: video.id, port: "batchOut" }, to: { nodeId: target.id, port: "referenceVideoIn" } };
  const plan = buildBatchPlan([{ source: video, edge }], {}, () => null);
  assert.equal(plan.length, 2);
  const graph = materializeBatchGraph([video, target], [edge], target.id, plan[1].inputs);
  const source = graph.nodes.find(node => node.id === graph.edges[0].from.nodeId);
  assert.equal(source.type, "video"); assert.equal(source.data.resultUrl, "/two.mp4");
  assert.equal(edge.from.nodeId, video.id);
  assert.throws(() => validateBatchEntries([{ type: "image", url: "/a.png" }, { type: "video", url: "/b.mp4" }]), /not both/);
  const three = { id: "three", type: "batch", data: { batchFiles: [1, 2, 3].map(id => ({ id, type: "image", url: `/${id}.png` })) } };
  assert.throws(() => buildBatchPlan([{ source: video }, { source: three }], {}, () => null), /matching lengths/);
});

test("Text Agent batch outputs keep generated prompts paired with original images", async () => {
  const plan = [0, 1].map(runIndex => ({ id: `image-${runIndex}`, runIndex, type: "image", label: `Image ${runIndex}`, url: `/${runIndex}.png`, inputs: [] }));
  let data = {};
  await runMediaBatch({ node: { type: "textAgent", data: {} }, plan, stopped: () => false,
    update: patch => { data = { ...data, ...patch }; }, execute: async (entry, capture) => {
      capture({ resultText: `Generated prompt for ${entry.id}` }); return { status: "complete" };
    } });
  assert.deepEqual(data.batchResults.map(item => [item.url, item.prompt]), [["/0.png", "Generated prompt for image-0"], ["/1.png", "Generated prompt for image-1"]]);
});

test("live source changes invalidate consumers beyond a passive Batch", () => {
  const index = createFlowConnectionIndex();
  const nodes = [{ id: "source", type: "video", data: { resultUrl: "/old.mp4" } }, { id: "batch", type: "batch", data: {} }, { id: "viewer", type: "preview", data: {} }];
  const edges = [{ from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "batch", port: "videoIn" } }, { from: { nodeId: "batch", port: "batchOut" }, to: { nodeId: "viewer", port: "sourceIn" } }];
  const first = index(nodes, edges).inputDependencyRefsByNode.get("viewer");
  const changed = [{ ...nodes[0], data: { resultUrl: "/new.mp4" } }, ...nodes.slice(1)];
  const second = index(changed, edges).inputDependencyRefsByNode.get("viewer");
  assert.notEqual(first, second); assert.equal(second[1].resultUrl, "/new.mp4");
});

test("interrupted batches retain completed files and never restore an active queue", () => {
  const item = { url: "/completed.mp4", type: "video" };
  const restored = clearStaleRunningState({ type: "videoModel", data: { status: "running", batchRunActive: true, batchProgress: "1 / 3", resultItems: [item], batchResults: [item] } });
  assert.equal(restored.data.batchRunActive, false); assert.equal(restored.data.status, "error");
  assert.equal(restored.data.batchProgress, ""); assert.deepEqual(restored.data.resultItems, [item]);
  assert.match(restored.data.error, /Batch interrupted/);
});

test("batch admission respects local GPU and media resource limits", () => {
  assert.equal(nodeBatchConcurrency({ type: "utility", data: { utilityMode: "video", utilityVideoModel: "CorridorKey 2.0" } }), 1);
  assert.equal(nodeBatchConcurrency({ type: "edit", data: {} }), 2);
  assert.equal(nodeBatchConcurrency({ type: "videoModel", data: { model: "Kling 4.0 Image-to-Video" } }), 3);
});

test("agent batch entries start fresh and keep the shared instruction for reruns", async () => {
  const plan = [0, 1].map(runIndex => ({ id: `image-${runIndex}`, runIndex, type: "image", label: `Image ${runIndex}`, url: `/${runIndex}.png`, inputs: [] }));
  const node = { id: "agent", type: "textAgent", data: { title: "Agent", agentDraft: "Add a soccer ball", resultText: "Old prompt", agentMessages: [{ role: "user", text: "Old instruction" }, { role: "assistant", text: "Old prompt" }] } };
  let data = { ...node.data };
  await runMediaBatch({ node, plan, stopped: () => false, update: patch => { data = { ...data, ...patch }; }, execute: async entry => {
    const child = batchChildNode(node, entry);
    assert.deepEqual(textAgentMessagesForPrompt(child.data), []);
    assert.equal(child.data.agentDraft, "Add a soccer ball");
    return { status: "error", error: new Error("Retry me") };
  } });
  assert.equal(data.agentDraft, node.data.agentDraft);
  assert.deepEqual(data.agentMessages, node.data.agentMessages);
  assert.equal(data.resultText, "");
  assert.deepEqual(data.batchResults, []);
  assert.equal(data.batchFailedEntries.length, 2);
});

test("retry preserves every image/prompt pair and its aggregate display in source order", async () => {
  const entries = [0, 1, 2].map(runIndex => ({ id: `image-${runIndex}`, runIndex, batchRunIndex: runIndex, type: "image", label: `Image ${runIndex}`, url: `/${runIndex}.png`, prompt: `Prompt ${runIndex}` }));
  let data = {};
  await runMediaBatch({ node: { type: "textAgent", data: { batchRetryEntry: entries[1], batchResults: [entries[0], entries[2]], batchFailedEntries: [entries[1]] } },
    plan: [entries[1]], stopped: () => false, update: patch => { data = { ...data, ...patch }; }, execute: async (entry, capture) => {
      capture({ resultText: "New prompt 1", agentDraft: "", agentMessages: [{ role: "assistant", text: "New prompt 1" }] });
      return { status: "complete" };
    } });
  assert.deepEqual(data.batchResults.map(item => item.prompt), ["Prompt 0", "New prompt 1", "Prompt 2"]);
  assert.equal(data.resultText, "Image 0\nPrompt 0\n\nImage 1\nNew prompt 1\n\nImage 2\nPrompt 2");
  assert.deepEqual(data.batchFailedEntries, []);
  assert.equal(data.agentMessages, undefined);
});

test("downstream waits for the complete agent batch and uses paired prompts without aggregate prompt wires", async () => {
  const agent = { id: "agent", type: "textAgent", data: {} }, model = { id: "model", type: "imageModel", data: {} };
  const edges = [
    { from: { nodeId: "agent", port: "batchOut" }, to: { nodeId: "model", port: "imagePromptIn" } },
    { from: { nodeId: "agent", port: "promptOut" }, to: { nodeId: "model", port: "promptIn" } }
  ];
  let finished = 0;
  const result = await runRunnableNodesByDependencyOrder([agent, model], edges, { runNode: async node => {
    if (node.id === "agent") return runMediaBatch({ node, plan: [0, 1, 2, 3].map(runIndex => ({ id: `entry-${runIndex}`, runIndex, label: `Image ${runIndex}`, type: "image", url: `/${runIndex}.png` })),
      update: patch => Object.assign(agent.data, patch), stopped: () => false, execute: async (entry, capture) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        capture({ resultText: `Soccer ball in image ${entry.runIndex}` }); finished++;
        return { status: "complete" };
      } });
    assert.equal(finished, 4);
    const plan = buildBatchPlan([{ source: agent }], {}, () => null);
    for (const entry of plan) {
      const graph = materializeBatchGraph([agent, model], edges, model.id, entry.inputs);
      assert.equal(graph.edges.length, 1);
      const source = graph.nodes.find(item => item.id === graph.edges[0].from.nodeId);
      assert.equal(source.data.resultUrl, `/${entry.runIndex}.png`);
      assert.equal(entry.prompt, `Soccer ball in image ${entry.runIndex}`);
    }
    return { status: "complete" };
  } });
  assert.equal(result.completed, 2);
});

test("fresh Text Agent chains expose typed Batch outputs and count pending media before the first run", () => {
  const nodes = [{ id: "batch", type: "batch", data: { batchFiles: [{ id: "v", type: "video", url: "/v.mp4" }] } },
    { id: "first", type: "textAgent", data: {} }, { id: "second", type: "textAgent", data: {} }, { id: "model", type: "videoModel", data: {} }];
  const edge = (from, to) => ({ from: { nodeId: from, port: "batchOut" }, to: { nodeId: to, port: "videoIn" } });
  const edges = [edge("second", "model"), edge("first", "second"), edge("batch", "first")];
  const ready = initializeTextAgentBatches(nodes, edges);
  assert.equal(ready[1].data.batchMediaType, "video");
  assert.equal(ready[2].data.batchMediaType, "video");
  assert.deepEqual(ready[1].data.batchResults, []);
  assert.equal(initializeTextAgentBatches(ready, edges), ready);
  const byId = new Map(ready.map(node => [node.id, node]));
  const incoming = Object.fromEntries(["first", "second"].map(id => [id, { videoIn: edges.filter(edge => edge.to.nodeId === id).map(edge => ({ edge, source: byId.get(edge.from.nodeId) })) }]));
  assert.equal(batchInputEntryCount(byId.get("second"), incoming, () => null), 1);
  assert.equal(nodes[1].data.batchResults, undefined);
  assert.deepEqual(upstreamBatchTextAgents("model", ready, edges).map(node => node.id), ["first", "second"]);
});

test("upstream refresh deduplicates prompt and batch wires, excludes ordinary agents and rejects cycles", () => {
  const nodes = ["first", "second", "ordinary"].map(id => ({ id, type: "textAgent", data: {} }));
  const edge = (from, to, port = "batchOut") => ({ from: { nodeId: from, port }, to: { nodeId: to, port: "imageIn" } });
  const edges = [edge("batch", "first"), edge("first", "second"), edge("second", "model"), edge("second", "model", "promptOut"), edge("ordinary", "model", "promptOut")];
  assert.deepEqual(upstreamBatchTextAgents("model", nodes, edges).map(node => node.id), ["first", "second"]);
  assert.throws(() => upstreamBatchTextAgents("model", nodes, [...edges, edge("second", "first")]), /cycle/);
});
