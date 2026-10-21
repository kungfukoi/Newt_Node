import { normalizeVideoOutpaintSettings, seedanceOutpaintPrompt } from "../src/videoOutpaint.js";

export async function prepareSeedanceOutpaint(body, { provider, apiKey, prepare }) {
  const settings = normalizeVideoOutpaintSettings(body.videoOutpaint);
  if (body.model !== "Seedance 2.5" || settings.model !== "seedance-2.5") throw Object.assign(new Error("Seedance outpainting requires the Seedance 2.5 outpaint model."), { status: 400 });
  if (!Array.isArray(body.referenceVideoUrls) || body.referenceVideoUrls.length !== 1) throw Object.assign(new Error("Connect exactly one source video for outpainting."), { status: 400 });
  const prepared = await prepare(body, body.referenceVideoUrls[0]);
  const prompt = String(body.prompt || "");
  if (prepared.plan.needsOutpaint) {
    // Preparation is local; validate the selected route before any provider upload.
    if (!["fal", "atlas"].includes(provider)) throw Object.assign(new Error("Seedance outpainting supports Fal or Atlas. Select one in Settings > Model Providers > Seedance."), { status: 400 });
    if (!apiKey) throw Object.assign(new Error(`Enable the selected ${provider === "fal" ? "Fal" : "Atlas Cloud"} key for Seedance outpainting.`), { status: 400 });
    if (!prompt.trim()) throw Object.assign(new Error("Enter or draft an outpainting prompt before Run."), { status: 400 });
  }
  return { prepared, body: {
    ...body, prompt: seedanceOutpaintPrompt(prompt), seedanceTask: "edit", seedanceDraft: false,
    referenceVideoUrls: [prepared.videoUrl], referenceVideoLabels: ["Video1"],
    referenceImageLabels: (body.referenceImageUrls || []).map((_url, index) => `Image${index + 1}`),
    referenceAudioUrls: [], startFrameUrls: [], endFrameUrls: [], filmDirector: null,
    characterDialogue: null, exactDialogueAudio: false, generateAudio: false,
    resolution: settings.seedanceResolution, aspectRatio: "auto", duration: "auto",
    seed: undefined,
    videoOutpaintContext: prepared, outpaintUserPrompt: prompt
  } };
}

export async function finishSeedanceOutpaint(body, prepared, rawOutput, nativeVideo, { finish, probeVideo }) {
  const details = { prepared, rawVideoUrl: rawOutput.publicPath, model: "seedance-2.5", nativeWidth: nativeVideo.width, nativeHeight: nativeVideo.height, nativeDuration: nativeVideo.duration, restoredSource: false, outputFormat: "8-bit SDR H.264" };
  try {
    const output = await finish(body, prepared, rawOutput);
    return { output, video: { ...nativeVideo, ...await probeVideo(output.filePath) }, details: { ...details, restoredSource: prepared.plan.settings.restoreSource }, warning: "" };
  } catch (error) {
    const warning = `Seedance outpainting finishing failed; the paid raw result was preserved: ${error.message}`;
    return { output: rawOutput, video: nativeVideo, details: { ...details, warning }, warning };
  }
}
