import assert from "node:assert/strict";
import test from "node:test";
import { waitForRemoteVideo, activeRemoteVideoNodeIds } from "../src/remoteVideoJobClient.js";
import { remoteVideoScope, supportsDurableVideo, appendUniqueVideoResults } from "../src/remoteVideoJobs.js";
import { recoveredVideoPatches } from "../src/remoteVideoRecovery.js";

const body = { generationRunId: "one", projectId: "project", nodeId: "video" };
const result = { generationRunId: "one", video: { localUrl: "/outputs/one.mp4", fileName: "one.mp4" }, cost: { amount: 1 } };
const response = (job, status = 200) => ({ response: { ok: status < 400, status }, data: { job } });

test("client recovers lost acceptance and network polls using original run ID", async () => {
  let submits = 0, polls = 0;
  const value = await waitForRemoteVideo(body, {
    submit: async (request) => { assert.equal(request.generationRunId, "one"); submits++; throw new Error("acceptance response lost"); },
    get: async (id) => {
      assert.equal(id, "one");
      assert.ok(activeRemoteVideoNodeIds(remoteVideoScope(body)).has("video"));
      if (++polls === 1) throw new Error("server restarting");
      return response({ state: "completed", result });
    }, delay: async () => {}
  });
  assert.equal(submits, 1);
  assert.equal(value.data, result);
  assert.equal(activeRemoteVideoNodeIds(remoteVideoScope(body)).size, 0);
});

test("unaccepted preparation can retry only with the same idempotency key", async () => {
  let submits = 0;
  const value = await waitForRemoteVideo(body, {
    submit: async (request) => { assert.equal(request, body); if (++submits === 1) throw new Error("offline"); return response({ state: "completed", result }, 202); },
    get: async () => response(null, 404), delay: async () => {}
  });
  assert.equal(submits, 2);
  assert.equal(value.response.ok, true);
});

test("once accepted, missing statuses do not cause new submissions", async () => {
  let submits = 0, polls = 0;
  const value = await waitForRemoteVideo(body, {
    submit: async () => { submits++; return response({ state: "queued" }, 202); },
    get: async () => ++polls < 3 ? response(null, 404) : response({ state: "failed", message: "Provider failed" }),
    delay: async () => {}
  });
  assert.equal(submits, 1);
  assert.equal(value.response.ok, false);
  assert.equal(value.data.error, "Provider failed");
});

test("validation errors return immediately and clear local active-run tracking", async () => {
  const value = await waitForRemoteVideo(body, { submit: async () => response(null, 400), get: async () => assert.fail("must not poll"), delay: async () => {} });
  assert.equal(value.response.status, 400);
  assert.equal(activeRemoteVideoNodeIds(remoteVideoScope(body)).size, 0);
});

test("confirmed local preparation errors do not cause endless upload retries", async () => {
  let submits = 0;
  const value = await waitForRemoteVideo(body, {
    submit: async () => { submits++; return { response: { ok: false, status: 500 }, data: { error: "Source file missing" } }; },
    get: async () => response(null, 404), delay: async () => {}
  });
  assert.equal(value.data.error, "Source file missing");
  assert.equal(submits, 1);
});

test("uncertain submissions release the foreground waiter without claiming provider failure", async () => {
  const value = await waitForRemoteVideo(body, {
    submit: async () => response({ runId: "one", state: "uncertain", message: "Needs attention: acceptance unknown" }, 202),
    get: async () => assert.fail("must not keep polling an uncertain submission"),
    delay: async () => assert.fail("must not wait indefinitely")
  });
  assert.equal(value.data.needsAttention, true);
  assert.equal(value.data.code, "SUBMISSION_UNCERTAIN");
  assert.equal(activeRemoteVideoNodeIds(remoteVideoScope(body)).size, 0);
});

const nodes = [
  { id: "video", type: "videoModel", data: { status: "idle", resultItems: [] } },
  { id: "output", type: "output", data: {} }
];
const edges = [{ from: { nodeId: "video" }, to: { nodeId: "output" } }];
const completed = { runId: "one", nodeId: "video", groupId: "group", state: "completed", batchIndex: 1, createdAt: "2026-09-03T00:00:00Z", updatedAt: "2026-09-03T00:01:00Z", result, outputTargetNodeId: "output" };

test("recovery publishes partial results, updates Output, and stays running for pending siblings", () => {
  const jobs = [completed, { ...completed, runId: "two", result: null, state: "running", batchIndex: 2 }];
  const patches = recoveredVideoPatches(nodes, jobs, new Set(), edges);
  assert.equal(patches[0].patch.status, "running");
  assert.equal(patches[0].patch.resultItems[0].url, result.video.localUrl);
  assert.equal(patches[1].nodeId, "output");
  const updated = nodes.map((node) => ({ ...node, data: { ...node.data, ...patches.find((item) => item.nodeId === node.id)?.patch } }));
  assert.deepEqual(recoveredVideoPatches(updated, jobs, new Set(), edges), []);
  assert.deepEqual(recoveredVideoPatches(nodes, jobs, new Set(["video"]), edges), []);
});

test("recovery never overwrites rewired outputs or reapplies dismissed completions", () => {
  const patches = recoveredVideoPatches(nodes, [completed], new Set(), []);
  assert.equal(patches.length, 1);
  assert.deepEqual(recoveredVideoPatches([{ ...nodes[0], data: { remoteVideoRunIds: ["one"] } }], [completed]), []);
  assert.deepEqual(recoveredVideoPatches([{ id: "different", type: "videoModel", data: {} }], [completed]), []);
});

test("uncertain recovery stops busy nodes while retaining the run for later reconciliation", () => {
  const uncertain = { ...completed, state: "uncertain", result: null, message: "Needs attention: acceptance unknown" };
  const patch = recoveredVideoPatches(nodes, [uncertain])[0].patch;
  assert.equal(patch.status, "error");
  assert.match(patch.error, /Needs attention/);
  assert.deepEqual(patch.remoteVideoRunIds, []);
  const updated = [{ ...nodes[0], data: { ...nodes[0].data, ...patch } }];
  assert.deepEqual(recoveredVideoPatches(updated, [uncertain]), []);
  assert.equal(recoveredVideoPatches(updated, [completed])[0].patch.resultItems.length, 1);
});

test("scope differentiates Save As paths and handles Windows/macOS paths", () => {
  assert.notEqual(remoteVideoScope({ projectId: "p", workflowPackagePath: "C:\\project\\A" }), remoteVideoScope({ projectId: "p", workflowPackagePath: "C:\\project\\B" }));
  assert.equal(remoteVideoScope({ projectId: "p", workflowPackagePath: "C:\\project\\A" }), remoteVideoScope({ projectId: "p", workflowPackagePath: "c:/project/a/" }));
  assert.notEqual(remoteVideoScope({ projectId: "p", workflowPackagePath: "/Users/A" }), remoteVideoScope({ projectId: "p", workflowPackagePath: "/Users/B" }));
});

test("durable opt-in is limited to Seedance 2.0/2.5 and result merging is idempotent", () => {
  assert.equal(supportsDurableVideo("Seedance 2.5"), true);
  assert.equal(supportsDurableVideo("Seedance 2.0"), true);
  assert.equal(supportsDurableVideo("MiniMax H3"), false);
  const item = { url: "/outputs/a.mp4", generationRunId: "one" };
  assert.deepEqual(appendUniqueVideoResults([item], [item, { ...item, url: "/outputs/b.mp4" }]), [item]);
});
