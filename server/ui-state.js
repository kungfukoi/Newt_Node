import path from "node:path";
import { readJsonFile, writeJsonAtomic } from "./json-store.js";

// Independent recovery slots for each window, with serialized atomic writes.
export function registerUiStateRoutes(app, { dataDir, read = readJsonFile, write = writeJsonAtomic } = {}) {
  const file = path.join(dataDir, "ui-state.json");
  let pending = Promise.resolve();
  const validId = id => typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id);
  const load = async () => {
    const saved = await read(file, {});
    return saved.version === 1 && saved.sessions ? saved : { version: 1, sessions: {}, legacy: saved };
  };
  app.get("/api/ui-state", async (req, res) => {
    try {
      await pending;
      const store = await load();
      const own = validId(req.query?.sessionId) ? store.sessions[req.query.sessionId] : null;
      const entry = own || store.sessions[store.lastSessionId];
      res.json({ state: entry?.state || store.legacy || {}, revision: own?.revision || 0, updatedAt: entry?.updatedAt || 0 });
    } catch { res.status(500).json({ error: "Could not load workspace recovery." }); }
  });
  app.put("/api/ui-state", async (req, res) => {
    const { state, sessionId, revision } = req.body || {};
    if (!validId(sessionId) || !Number.isSafeInteger(revision) || revision < 1 || !state || typeof state !== "object" || Array.isArray(state)
      || (state.draft && (!Array.isArray(state.draft.nodes) || !Array.isArray(state.draft.edges)))) {
      return res.status(400).json({ error: "Expected a window session, revision and valid workspace state." });
    }
    const operation = pending.catch(() => {}).then(async () => {
      const store = await load();
      if ((store.sessions[sessionId]?.revision || 0) >= revision) return;
      store.sessions[sessionId] = { state, revision, updatedAt: Date.now() };
      store.lastSessionId = sessionId;
      delete store.legacy;
      store.sessions = Object.fromEntries(Object.entries(store.sessions).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 20));
      await write(file, store);
    });
    pending = operation.catch(() => {});
    try { await operation; res.json({ ok: true }); }
    catch { res.status(500).json({ error: "Could not save workspace recovery. Your open project is unchanged." }); }
  });
}
