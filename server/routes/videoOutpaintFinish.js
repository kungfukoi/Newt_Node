import { randomUUID } from "node:crypto";

export function registerVideoOutpaintFinishRoute(app, { isLocalAssetUrl, service, resolveAsset, probeVideo, appendHistory, projectFromBody, nodeFromBody }) {
  app.post("/api/node/video-outpaint-finish", async (req, res) => {
    try {
      const { rawVideoUrl, prepared: previous } = req.body;
      if (!isLocalAssetUrl(rawVideoUrl) || !isLocalAssetUrl(previous?.sourceUrl) || !previous?.plan?.settings) return res.status(400).json({ error: "Select a local outpaint result with its original preparation metadata." });
      // Rebuild geometry server-side; finishing controls must never reinterpret an
      // existing generation using a newly edited crop, model, duration or resolution.
      const { restoreSource, feather, autoMatch, finalQc, visualQc, keepAllRepeats, matchExtensionColor } = req.body.videoOutpaint || {};
      const finishing = Object.fromEntries(Object.entries({ restoreSource, feather, autoMatch, finalQc, visualQc, keepAllRepeats, matchExtensionColor }).filter(([, value]) => value !== undefined));
      const prepared = await service.prepare({ ...req.body, canvasVideoUrl: previous.canvasVideoUrl || "", videoOutpaint: { ...previous.plan.settings, ...finishing } }, previous.sourceUrl, { prerollFrames: previous.plan.prerollFrames || 0, frames: previous.plan.frames, outputFrames: previous.plan.outputFrames, outputDuration: previous.plan.outputDuration, sourceFps: previous.plan.sourceFps, sourceFrameRate: previous.plan.sourceFrameRate, sourceStartSeconds: previous.plan.sourceStartSeconds });
      const raw = await resolveAsset(rawVideoUrl), native = await probeVideo(raw.filePath);
      const output = await service.finish(req.body, prepared, raw), metadata = await probeVideo(output.filePath);
      const videoOutpaint = { prepared, rawVideoUrl, model: prepared.plan.settings.model, nativeWidth: native.width, nativeHeight: native.height, nativeDuration: native.duration, restoredSource: prepared.plan.settings.restoreSource, matching: output.matching, qc: output.qc, outputFormat: output.outputFormat || "8-bit SDR H.264", warning: output.warning };
      const cost = { amountUsd: 0, currency: "USD", mediaType: "video", pricingBasis: "Local source compositing and optional extension color matching; no provider generation or AI review" };
      const item = { type: "video", label: "Outpaint matched finish", url: output.publicPath, fileName: output.fileName, filePath: output.filePath, mimeType: output.mimeType || "video/mp4", videoOutpaint, warning: output.warning, cost };
      await appendHistory({ id: randomUUID(), createdAt: new Date().toISOString(), mediaType: "video", provider: "local", modelName: "Video Outpaint", endpoint: "local/video-outpaint-finish", mode: "Outpaint overlap finish", project: projectFromBody(req.body), node: nodeFromBody(req.body), settings: { videoOutpaint }, videoOutpaint, cost, warning: output.warning, localVideo: output.publicPath, outputFileName: output.fileName, outputBytes: output.bytes, video: metadata });
      res.json(item);
    } catch (error) { res.status(error.status || 400).json({ error: "Could not reprocess outpainting; the original result is unchanged. " + error.message }); }
  });
}
