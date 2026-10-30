import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { nodeTypeDefinitions } from "../src/nodeRegistry.js";

const types = new Set(nodeTypeDefinitions.map(row => row.type));
export function validUsageEvent(event) {
  return event && /^[a-f0-9-]{36}$/i.test(event.id || "") && types.has(event.type) && ["add", "run"].includes(event.action);
}

// One process owns dataDir; serialize read/modify/atomic replacement across windows.
export function createFeatureUsageStore(filePath, now = () => new Date()) {
  let queue = Promise.resolve();
  async function read() {
    try {
      const data = JSON.parse(await readFile(filePath, "utf8"));
      if (data.version !== 1 || !Array.isArray(data.days) || !Array.isArray(data.recentIds) || !Number.isFinite(Date.parse(data.startedAt)) ||
        data.days.some(row => !types.has(row.type) || !["add", "run"].includes(row.action) || !Number.isSafeInteger(row.count) || row.count < 1 || !Number.isFinite(Date.parse(row.lastUsed)))) throw new Error("Invalid feature usage file");
      return data;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return { version: 1, startedAt: now().toISOString(), days: [], recentIds: [] };
    }
  }
  function serial(operation) {
    const result = queue.then(operation); queue = result.catch(() => {}); return result;
  }
  return {
    snapshot: () => serial(async () => {
      const data = await read();
      return { startedAt: data.startedAt, days: data.days };
    }),
    record: event => serial(async () => {
      if (!validUsageEvent(event)) throw new Error("Invalid feature usage event");
      const data = await read();
      if (data.recentIds.includes(event.id)) return;
      const date = now();
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const row = data.days.find(row => row.day === day && row.type === event.type && row.action === event.action);
      if (row) { row.count++; row.lastUsed = date.toISOString(); }
      else data.days.push({ day, type: event.type, action: event.action, count: 1, lastUsed: date.toISOString() });
      data.recentIds = [...data.recentIds, event.id].slice(-10000);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(`${filePath}.tmp`, JSON.stringify(data), "utf8");
      await rename(`${filePath}.tmp`, filePath);
    })
  };
}

export function registerFeatureUsageRoutes(app, store) {
  app.get("/api/feature-usage", async (_req, res) => {
    try { res.json(await store.snapshot()); }
    catch { res.status(503).json({ error: "Feature usage unavailable. Existing records are preserved; retry after checking the local usage file." }); }
  });
  app.post("/api/feature-usage", async (req, res) => {
    if (!validUsageEvent(req.body)) return res.status(400).json({ error: "Expected a node type, add/run action and event UUID." });
    try { await store.record(req.body); res.json({ ok: true }); }
    catch { res.status(503).json({ error: "Could not save feature usage. Generation is unaffected." }); }
  });
}
