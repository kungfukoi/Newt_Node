import test from "node:test";
import assert from "node:assert/strict";

test("workspace recovery preserves the current window draft, serializes saves and surfaces failures", async t => {
  const previous = { window: globalThis.window, fetch: globalThis.fetch };
  t.after(() => { globalThis.window = previous.window; globalThis.fetch = previous.fetch; });
  const store = new Map();
  const memory = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  globalThis.window = { location: { hostname: "localhost", port: "3336" }, sessionStorage: memory, localStorage: { getItem: () => null, setItem() {} } };
  const puts = []; let fail = false;
  globalThis.fetch = async (url, opts = {}) => {
    if (opts.method === "PUT") { if (fail) throw new Error("offline"); puts.push(JSON.parse(opts.body)); return Response.json({ ok: true }); }
    return Response.json({ revision: 0, state: { workspaceMode: "nodes", draft: { nodes: [], edges: [], projectName: "Demo" } } });
  };
  const ui = await import("../src/uiState.js");
  await ui.loadUiState();
  assert.equal(ui.uiGet("workspaceMode"), "nodes");
  assert.equal(JSON.parse(store.get("seedance-node-editor-draft-v1")).projectName, "Demo");
  store.set("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [], edges: [], projectName: "Mine" }));
  await ui.loadUiState();
  ui.uiSet("workspaceMode", "video");
  await ui.saveNow();
  assert.equal(puts.at(-1).state.draft.projectName, "Mine");
  const firstRevision = puts.at(-1).revision;
  await Promise.all([ui.saveNow(), ui.saveNow()]);
  assert.ok(puts.at(-1).revision > firstRevision);
  fail = true; await ui.saveNow(); assert.match(ui.uiSaveStatus(), /could not be saved/);
  fail = false; await ui.saveNow(); assert.equal(ui.uiSaveStatus(), "");
});
