import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerUiStateRoutes } from "../server/ui-state.js";

test("workspace recovery keeps concurrent windows independent and rejects stale saves", async t => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "newt-ui-test-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const routes = {};
  registerUiStateRoutes({ get: (p, h) => routes.get = h, put: (p, h) => routes.put = h }, { dataDir });
  const res = () => ({ code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
  const save = async (sessionId, revision, state) => { const r = res(); await routes.put({ body: { sessionId, revision, state } }, r); return r; };
  const load = async sessionId => { const r = res(); await routes.get({ query: { sessionId } }, r); return r.body; };
  assert.deepEqual((await load("a")).state, {});
  await Promise.all([save("a", 2, { workspaceMode: "nodes" }), save("b", 1, { workspaceMode: "video" })]);
  await save("a", 1, { workspaceMode: "image" });
  assert.equal((await load("a")).state.workspaceMode, "nodes");
  assert.equal((await load("b")).state.workspaceMode, "video");
  assert.equal((await load("new-window")).state.workspaceMode, "video");
  assert.equal((await save("bad/path", 1, {})).code, 400);
  assert.equal((await save("a", 3, { draft: { nodes: [] } })).code, 400);
});

test("workspace recovery reports disk failures and permits retry", async () => {
  const routes = {}; let fail = true;
  registerUiStateRoutes({ get: (p, h) => routes.get = h, put: (p, h) => routes.put = h }, {
    dataDir: "unused", read: async () => ({}), write: async () => { if (fail) throw new Error("disk full"); }
  });
  const r = { code: 200, status(c) { this.code = c; return this; }, json() {} };
  const req = { body: { sessionId: "test", revision: 1, state: {} } };
  await routes.put(req, r); assert.equal(r.code, 500);
  fail = false; r.code = 200;
  await routes.put(req, r); assert.equal(r.code, 200);
});
