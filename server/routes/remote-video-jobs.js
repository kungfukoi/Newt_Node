import { createHash } from "node:crypto";
import { supportsDurableVideo } from "../../src/remoteVideoJobs.js";

export function registerRemoteVideoJobRoutes(app, jobs) {
  app.post("/api/remote-video-jobs/:runId/recover", async (req, res) => {
    try { res.json({ job: await jobs.recover(req.params.runId, req.body) }); }
    catch (error) {
      const status = [400, 403, 404, 409].includes(error.statusCode) ? error.statusCode : 503;
      res.status(status).json({ error: status === 503 ? "Recovery could not be verified. Check the original provider key, job ID, and local media, then retry this recovery action." : error.message });
    }
  });
  app.get("/api/remote-video-jobs", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const scope = String(req.query.scope || "");
    res.json(jobs.changes ? jobs.changes(scope, req.query.cursor) : { jobs: jobs.list(scope) });
  });
  app.get("/api/remote-video-jobs/:runId", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const job = jobs.get(req.params.runId);
    res.status(job ? 200 : 404).json(job ? { job } : { error: "Job has not been accepted." });
  });
}

export function durableVideoRequestHandler(handler, jobs) {
  const preparing = new Map();
  return async (req, res) => {
    if (!req.body?.durableGeneration || !supportsDurableVideo(req.body.model)) return handler(req, res);
    const runId = String(req.body.generationRunId || "");
    if (!runId || runId.length > 180) return res.status(400).json({ error: "A valid generation run ID is required." });
    req.durableGenerationOwned = true;
    const requestHash = createHash("sha256").update(JSON.stringify(req.body)).digest("hex");
    const existing = jobs.get(runId);
    if (existing) {
      if (!jobs.matches(runId, requestHash)) return res.status(409).json({ error: "Run ID already belongs to a different request." });
      return res.status(202).json({ job: existing });
    }
    if (preparing.has(runId) && preparing.get(runId).hash !== requestHash) {
      return res.status(409).json({ error: "Run ID already belongs to a different request." });
    }
    if (!preparing.has(runId)) {
      const result = new Promise((resolve, reject) => {
        let statusCode = 200;
        const response = { headersSent: false, status(code) { statusCode = code; return this; }, json(data) { resolve({ statusCode, data }); return this; } };
        Promise.resolve(handler({ ...req, body: req.body, durableRequestHash: requestHash }, response)).catch(reject);
      });
      preparing.set(runId, { hash: requestHash, result });
      result.finally(() => preparing.delete(runId)).catch(() => {});
    }
    try {
      const { statusCode, data } = await preparing.get(runId).result;
      res.status(statusCode).json(data);
    } catch {
      res.status(503).json({ error: "Could not accept generation. No automatic provider resubmission." });
    }
  };
}
