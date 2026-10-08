import { normalizeStatsRecord } from "../../src/statsAnalytics.js";

export function registerStatsRoutes(app, { ledger, providers, readHistory, refreshKeys = async () => {} }) {
  const snapshot = async () => {
    const document = await ledger.snapshot(await readHistory());
    return { history: document.records, coverage: { source: "This installation's retained history + durable accounting ledger", trackingStartedAt: document.trackingStartedAt,
      recordCount: document.records.length, note: "Earlier evicted history and other machines are not included. Shared API keys do not synchronize local records. Only recorded operations appear; this is not a live job queue." },
      capabilities: providers.capabilities, fetchedAt: new Date().toISOString() };
  };
  app.get("/api/stats/local", async (_req, res) => {
    try { res.json(await snapshot()); }
    catch { res.status(503).json({ error: "Local accounting unavailable. Records are preserved; retry or restore the ledger/history backup." }); }
  });
  app.get("/api/stats/accounts", async (req, res) => {
    try { await refreshKeys(); res.json(await providers.load(req.query)); }
    catch (error) { res.status(error.status || 503).json({ error: error.status === 400 || error.status === 429 ? error.message : "Billing query unavailable. Retry later." }); }
  });
  app.get("/api/stats/export", async (_req, res) => {
    try { const data = await snapshot(); res.json({ format: "newt-accounting-v1", exportedAt: data.fetchedAt, coverage: data.coverage, records: data.history }); }
    catch { res.status(503).json({ error: "Could not export local accounting." }); }
  });
  app.post("/api/stats/import-preview", async (req, res) => {
    const document = req.body;
    if (document?.format !== "newt-accounting-v1" || !Array.isArray(document.records) || document.records.length > 10000 || document.records.some(row => !row || typeof row !== "object" || Array.isArray(row))) return res.status(400).json({ error: "Expected a Newt accounting export with at most 10000 records." });
    try {
      const result = await ledger.preview(document.records.map(normalizeStatsRecord));
      res.json({ records: result.records, duplicates: result.duplicates, persisted: false, scope: "Read-only comparison of Local and imported records; not provider account history." });
    } catch { res.status(503).json({ error: "Could not preview accounting import. Nothing was changed." }); }
  });
}
