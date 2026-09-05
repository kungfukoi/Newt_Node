import test from "node:test";
import assert from "node:assert/strict";
import { createWorkScheduler } from "../src/workScheduler.js";
import { runRunnableNodesByDependencyOrder } from "../src/nodeRunner.js";
import { nodeSchedulingKey } from "../src/nodeScheduling.js";
import { createRemoteVideoRequests } from "../src/remoteVideoRequests.js";

test("scheduler enforces global/per-resource bounds and removes cancelled queued work", async () => {
  const scheduler = createWorkScheduler({ maxConcurrent: 3, limits: { local: 1, fal: 2 } });
  const release = [];
  const started = [];
  const job = (key) => scheduler.run(() => new Promise((resolve) => { started.push(key); release.push(resolve); }), { key });
  const jobs = [job("local"), job("local"), job("fal"), job("fal")];
  const aborter = new AbortController();
  const cancelled = scheduler.run(() => assert.fail("cancelled task executed"), { key: "local", signal: aborter.signal });
  aborter.abort(new Error("Cancelled by test"));
  await assert.rejects(cancelled, /Cancelled/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["local", "fal", "fal"]);
  assert.equal(scheduler.snapshot().active, 3);
  release.splice(0).forEach((fn) => fn());
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["local", "fal", "fal", "local"]);
  release.splice(0).forEach((fn) => fn());
  await Promise.all(jobs);
});

test("selected runs bound provider concurrency and retain partial failures/dependency skips", async () => {
  const nodes = Array.from({ length: 8 }, (_, id) => ({ id: String(id), type: "videoModel", data: { model: "Seedance 2.5" } }));
  nodes.push({ id: "export", type: "output", data: {} });
  let active = 0; let peak = 0;
  const result = await runRunnableNodesByDependencyOrder(nodes, [{ from: { nodeId: "0" }, to: { nodeId: "export" } }], {
    resourceKey: (node) => nodeSchedulingKey(node, { seedance: "krea" }), providerLimits: { krea: 2 },
    runNode: async (node) => {
      active++; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active--;
      if (node.id === "0") throw new Error("Provider rejected input");
      return { status: "complete" };
    }
  });
  assert.equal(peak, 2);
  assert.deepEqual(result, { completed: 7, failed: 1, skipped: 1 });
  assert.equal(nodeSchedulingKey({ data: { model: "MiniMax H3" } }, { minimaxH3: "local" }), "localGpu");
});

test("recovery list and foreground waiters share current snapshots without duplicate requests", async () => {
  let calls = 0; let clock = 0;
  const response = { ok: true, status: 200 };
  const api = createRemoteVideoRequests({ now: () => clock,
    get: async (runId) => { calls++; await new Promise((resolve) => setTimeout(resolve, 1)); return { response, data: { job: { runId, state: "running" } } }; },
    list: async () => ({ response, data: { jobs: [{ runId: "a", state: "completed" }] } })
  });
  await Promise.all([api.get("a"), api.get("a")]);
  assert.equal(calls, 1);
  await api.list("scope", "cursor");
  assert.equal((await api.get("a")).data.job.state, "completed");
  clock = 3000;
  await api.get("a");
  assert.equal(calls, 2);
});
