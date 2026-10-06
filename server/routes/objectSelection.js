import { createHash, randomUUID } from "node:crypto";
import { objectSelectionEndpoints, objectSelectionInput } from "../../src/objectSelection.js";
import { prepareObjectSource, encodeObjectMask, readObjectMask } from "../object-selection.js";

export function registerObjectSelectionRoutes(app, { limiter, available, readSource, upload, subscribe, recordHistory, sendError, readMask = readObjectMask }) {
  const jobs = new Map();
  app.post("/api/node/image-objects", limiter, async (req, res) => {
    try {
      if (!available()) throw Object.assign(new Error("Enable a Fal key in Settings to use Object Selection."), { status: 400 });
      const { sourceUrl, requestId, point, prompt } = req.body;
      if (typeof sourceUrl !== "string" || !/^[a-z0-9-]{16,80}$/i.test(requestId || "")) throw Object.assign(new Error("An image source and request ID are required."), { status: 400 });
      if (point !== undefined && (!point || ![point.x, point.y].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1))) throw Object.assign(new Error("Choose a point inside the image."), { status: 400 });
      if (prompt !== undefined && (typeof prompt !== "string" || !prompt.trim() || prompt.length > 300 || point !== undefined)) throw Object.assign(new Error("Describe the selection in 1–300 characters, or choose a point."), { status: 400 });
      const fingerprint = createHash("sha256").update(JSON.stringify(req.body)).digest("hex");
      for (const [id, job] of jobs) if (job.finished && Date.now() - job.finished > 3600000) jobs.delete(id);
      if (!jobs.has(requestId)) {
        if (jobs.size >= 1000) throw Object.assign(new Error("Object Selection is busy. Try again later."), { status: 429 });
        if ([...jobs.values()].filter(job => !job.finished).length >= 4) throw Object.assign(new Error("Four selections are already running. Wait for one to finish."), { status: 429 });
        const job = { fingerprint };
        job.promise = run(req).then(result => {
          job.result = result;
          // Keep request tombstones after releasing old maps: never replay paid work.
          const cached = [...jobs.values()].filter(entry => entry.result);
          for (const old of cached.slice(0, Math.max(0, cached.length - 8))) old.result = null;
        }).finally(() => { job.finished = Date.now(); });
        jobs.set(requestId, job);
      }
      if (jobs.get(requestId).fingerprint !== fingerprint) throw Object.assign(new Error("This request ID belongs to a different selection."), { status: 409 });
      const job = jobs.get(requestId);
      await job.promise;
      if (!job.result) throw Object.assign(new Error("This selection result has expired. The paid request was not repeated."), { status: 410 });
      res.json(job.result);
    } catch (error) { sendError(res, error, "Object Selection failed."); }
  });

  async function run(req) {
    const { sourceUrl, point, prompt } = req.body;
    const source = await readSource(sourceUrl);
    const { data, info } = await prepareObjectSource(source.buffer).catch(() => { throw Object.assign(new Error("Use an image up to 24 megapixels."), { status: 400 }); });
    const sam3 = Boolean(point || prompt);
    const endpoint = objectSelectionEndpoints[sam3 ? "point" : "auto"];
    const model = sam3 ? "SAM 3" : "SAM 2";
    const imageUrl = await upload({ buffer: data, mimeType: "image/png", fileName: "object-selection.png" });
    const result = await subscribe(endpoint, { input: objectSelectionInput({ imageUrl, point, prompt, width: info.width, height: info.height }), logs: true }, { route: "image-objects", model });
    const remote = (sam3 ? result?.data?.masks : result?.data?.individual_masks) || [];
    // Record completed paid inference even if its masks are empty or cannot be downloaded.
    const cost = { amountUsd: sam3 ? 0.005 : null, currency: "USD", units: 1, unit: "request", mediaType: "image", endpoint,
      pricingBasis: sam3 ? "SAM 3 Fal per-request estimate" : "SAM 2: awaiting matched Fal billing; no verified fixed rate", pricingSource: "fal-model-page-2026-10-06" };
    let warning = "";
    try {
      await recordHistory({ id: result.requestId || randomUUID(), createdAt: new Date().toISOString(), mediaType: "image", provider: "fal.ai", modelName: model,
        endpoint, mode: "Image Edit: Object Selection", prompt: prompt || "", project: { id: req.body.projectId || "node-workspace", name: req.body.projectName || "Node workspace" },
        node: { id: req.body.nodeId, title: req.body.nodeTitle || "Image Edit" }, localImage: sourceUrl,
        settings: { sourceUrl, point, imageSize: `${info.width}x${info.height}`, maskCount: remote.length }, cost });
    } catch { warning = "Selection completed, but its usage could not be added to History."; }
    try {
      if (!Array.isArray(remote)) throw new Error("Invalid mask response.");
      const masks = [], signal = AbortSignal.timeout(180000); let runCount = 0;
      for (let offset = 0; offset < Math.min(remote.length, 128); offset += 4) {
        signal.throwIfAborted();
        const batch = await Promise.all(remote.slice(offset, Math.min(offset + 4, 128)).map(async (image, index) =>
          encodeObjectMask(await readMask(typeof image === "string" ? image : image.url, signal), info.width, info.height, `${req.body.requestId}:${offset + index}`)));
        for (const mask of batch) {
          runCount += mask.runs.length;
          if (runCount > 2000000) throw new Error("The selection map is too complex. Use manual selection for this image.");
          if (mask.area) masks.push(mask);
        }
      }
      if (remote.length > 128) warning = [warning, "Showing the first 128 objects; click an unhighlighted area to select it with SAM 3."].filter(Boolean).join(" ");
      return { masks, model, warning };
    } catch (error) { throw Object.assign(new Error(`${model} completed, but its masks could not be loaded. Check History before retrying. ${error.message}`), { status: 502 }); }
  }
}
