import { randomUUID } from "node:crypto";
import { buildOutpaintAnalysisPrompt, normalizeOutpaintPromptMode } from "../../src/videoOutpaintPrompt.js";
import { fitOutpaintPrompt, outpaintEditablePromptBudget } from "../../src/outpaintPromptBudget.js";

export function registerVideoOutpaintPromptRoute(app, deps) {
  app.post("/api/node/video-outpaint-prompt", async (req, res) => {
    try {
      const { sourceVideoUrl, maskVideoUrl, maskImageUrl } = req.body;
      if (![sourceVideoUrl, maskImageUrl || maskVideoUrl].every(url => typeof url === "string" && deps.isLocalAssetUrl(url))) {
        return res.status(400).json({ error: "Connect a local source video and matching mask before analyzing outpainting." });
      }
      const mode = normalizeOutpaintPromptMode(req.body.mode);
      if (mode === "manual") return res.status(400).json({ error: "Manual mode uses the editable Prompt field; select Auto to analyze video." });
      const frameEvidence = maskImageUrl && deps.inspectFrames ? await deps.inspectFrames(req.body) : null;
      const promptByteBudget = req.body.outpaintModel === "seedance-2.5" ? outpaintEditablePromptBudget(req.body.preparedPlan, req.body.preparedPlan?.settings) : 1100;
      const prompt = buildOutpaintAnalysisPrompt({ mode, guidance: req.body.guidance, aspectRatio: req.body.aspectRatio, outpaintModel: req.body.outpaintModel, maskIsImage: Boolean(maskImageUrl), frameEvidence: frameEvidence?.text || "", maxPromptBytes: promptByteBudget });
      const inputs = [{ url: sourceVideoUrl, label: "Source footage on target canvas", type: "video" }, ...(!maskImageUrl ? [{ url: maskVideoUrl, label: "Expansion mask: white generate, black preserve", type: "video" }] : [])];
      const result = await deps.analyze({ inputs, prompt });
      if (!result.text?.trim()) throw new Error("Video analysis returned no prompt. Your existing prompt was preserved.");
      const originalDraft = result.text;
      result.text = fitOutpaintPrompt(originalDraft, promptByteBudget);
      const usage = result.usages?.[0] || result.usage || null;
      const helperUsages = result.usages?.slice(1) || [];
      const cost = deps.estimateCost({ provider: result.provider, model: result.model, usage, helperUsages, videoInputs: inputs.filter(i => i.type === "video"), imageInputs: inputs.filter(i => i.type === "image") });
      await deps.appendHistory({ id: randomUUID(), createdAt: new Date().toISOString(), mediaType: "text", provider: result.provider, modelName: result.model, endpoint: result.endpoint,
        mode: "Video outpainting prompt", prompt, submittedPrompt: prompt, text: result.text, originalDraft, project: deps.projectFromBody(req.body), node: deps.nodeFromBody(req.body),
        settings: { mode, outpaintModel: req.body.outpaintModel === "seedance-2.5" ? "seedance-2.5" : "wan-vace", aspectRatio: req.body.aspectRatio || "auto", guidance: mode === "guided" ? String(req.body.guidance || "") : "", sourceVideoUrl, ...(maskImageUrl ? { maskImageUrl } : { maskVideoUrl }), videoInputCount: maskImageUrl ? 1 : 2, imageInputCount: 0, ...(frameEvidence ? { frameAnalysis: { frameCount: frameEvidence.frameCount, fps: frameEvidence.fps, prerollFrames: frameEvidence.prerollFrames } } : {}) },
        usage: { request: usage, helpers: helperUsages }, cost });
      res.json({ text: result.text, provider: result.provider, model: result.model, cost, ...(frameEvidence ? { frameAnalysis: { frameCount: frameEvidence.frameCount, fps: frameEvidence.fps, prerollFrames: frameEvidence.prerollFrames } } : {}) });
    } catch (error) {
      res.status(error.status || error.statusCode || 500).json({ error: error.message || "Outpainting prompt analysis failed." });
    }
  });
}
