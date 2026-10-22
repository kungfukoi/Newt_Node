import { normalizeKeyerData, keyerSettings } from "../../src/keyer.js";

export function registerKeyerRoutes(app, service) {
  app.get("/api/keyer/status", async (_req, res) => {
    try { res.json(await service.status()); } catch { res.status(500).json({ error: "Could not inspect the local Keyer installation." }); }
  });
  app.post("/api/node/keyer", async (req, res) => {
    try {
      // Reuse client normalization at the trust boundary; arbitrary CLI flags are never accepted.
      const s = req.body.settings || {};
      const settings = keyerSettings(normalizeKeyerData({ keyerMode: s.mode, keyerDespill: s.despill, keyerHintQuality: s.hintQuality, keyerMemory: s.memory, keyerFrameLimit: s.frameLimit, keyerCarry: s.carry }));
      res.status(202).json(await service.start({ ...req.body, settings }));
    } catch (error) { res.status(error.status || 400).json({ error: error.message }); }
  });
  app.get("/api/keyer/jobs/:id", (req, res) => {
    const job = service.job(req.params.id);
    if (!job) return res.status(404).json({ error: "Keyer job is no longer available. Check History before starting another run." });
    res.json(job);
  });
}
