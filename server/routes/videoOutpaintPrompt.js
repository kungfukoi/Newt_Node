import { randomUUID } from "node:crypto";
import { buildOutpaintAnalysisPrompt, normalizeOutpaintPromptMode } from "../../src/videoOutpaintPrompt.js";

export function registerVideoOutpaintPromptRoute(app, deps) {
  app.post("/api/node/video-outpaint-prompt", async (req, res) => {
    try {
      const { sourceVideoUrl, maskVideoUrl } = req.body;
      if (![sourceVideoUrl, maskVideoUrl].every(url => typeof url === "string" && deps.isLocalAssetUrl(url))) {
        return res.status(400).json({ error: "Connect a local source video and matching mask video before analyzing outpainting." });
      }
      const mode = normalizeOutpaintPromptMode(req.body.mode);
      if (mode === "manual") return res.status(400).json({ error: "Manual mode uses the editable Prompt field; select Auto to analyze video." });
      const prompt = buildOutpaintAnalysisPrompt({ mode, guidance: req.body.guidance, aspectRatio: req.body.aspectRatio, outpaintModel: req.body.outpaintModel });
      const inputs = [{ url: sourceVideoUrl, label: "Source footage on target canvas", type: "video" }, { url: maskVideoUrl, label: "Expansion mask: white generate, black preserve", type: "video" }];
      const result = await deps.analyze({ inputs, prompt });
      if (!result.text?.trim()) throw new Error("Video analysis returned no prompt. Your existing prompt was preserved.");
      const usage = result.usages?.[0] || result.usage || null;
      const helperUsages = result.usages?.slice(1) || [];
      const cost = deps.estimateCost({ provider: result.provider, model: result.model, usage, helperUsages, videoInputs: inputs, imageInputs: [] });
      await deps.appendHistory({ id: randomUUID(), createdAt: new Date().toISOString(), mediaType: "text", provider: result.provider, modelName: result.model, endpoint: result.endpoint,
        mode: "Video outpainting prompt", prompt, submittedPrompt: prompt, text: result.text, project: deps.projectFromBody(req.body), node: deps.nodeFromBody(req.body),
        settings: { mode, outpaintModel: req.body.outpaintModel === "seedance-2.5" ? "seedance-2.5" : "wan-vace", aspectRatio: req.body.aspectRatio || "auto", guidance: mode === "guided" ? String(req.body.guidance || "") : "", sourceVideoUrl, maskVideoUrl, videoInputCount: 2 },
        usage: { request: usage, helpers: helperUsages }, cost });
      res.json({ text: result.text, provider: result.provider, model: result.model, cost });
    } catch (error) {
      res.status(error.status || error.statusCode || 500).json({ error: error.message || "Outpainting prompt analysis failed." });
    }
  });
}
