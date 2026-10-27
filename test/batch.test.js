import test from "node:test";
import assert from "node:assert/strict";
import { batchEntries, validateBatchEntries, runBatchEntries, buildBatchPlan, materializeBatchGraph } from "../src/batch.js";
import { runMediaBatch } from "../src/nodeRunners/batch.js";
import { buildSelectedRunnableDependencies } from "../src/nodeRunner.js";
import { createFlowConnectionIndex } from "../src/flowNodeConnections.js";
import { clearStaleRunningState } from "../src/workflowState.js";
import { nodeBatchConcurrency } from "../src/nodeScheduling.js";

const connection = (id, url) => ({ source: { id, data: { title: id, resultUrl: url } }, edge: { from: { nodeId: id, port: "imageOut" } } });
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
