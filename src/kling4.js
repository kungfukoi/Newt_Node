// Provider schemas checked 2026-10-27. Keep the two request contracts explicit.
export const kling4ModelName = "Kling 4.0 Image-to-Video";
export const isKling4Model = model => String(model || "").trim().toLowerCase() === kling4ModelName.toLowerCase();
export const kling4DurationOptions = Array.from({ length: 28 }, (_, i) => `${i + 3} seconds`);
export const kling4ResolutionOptions = provider => provider === "atlas"
  ? ["720p", "1080p", "1080p-esr", "2k-esr", "4k-esr"] : ["720p", "1080p"];
export const kling4Endpoints = Object.freeze({ fal: "kling/v4/image-to-video", atlas: "kwaivgi/kling-v4.0/image-to-video" });
export const kling4UnsupportedPorts = ["directorIn", "characterIn", "referenceVideoIn", "referenceAudioIn"];
export function kling4SelectionPatch(data = {}) {
  return { model: kling4ModelName, duration: kling4DurationOptions.includes(data.duration) ? data.duration : "5 seconds",
    resolution: kling4ResolutionOptions("atlas").includes(data.resolution) ? data.resolution : "1080p", aspectRatio: "Auto", generateAudio: false, characterVoiceMode: "off" };
}
export function buildKling4Request(body = {}, provider = "fal") {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!kling4Endpoints[provider]) fail("Kling 4.0 Image-to-Video requires Fal or Atlas Cloud. Change Video Model provider in Settings.");
  for (const field of ["characterReferenceUrls", "referenceVideoUrls", "referenceAudioUrls"]) {
    if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].length)) fail("Kling 4.0 Image-to-Video accepts Start, End and ordered middle images only. Disconnect Character, video and audio references.");
  }
  if (body.filmDirector || body.characterDialogue || body.exactDialogueAudio) fail("Kling 4.0 Image-to-Video does not support Director or assigned Character audio.");
  const frames = {};
  for (const [field, min, max] of [["startFrameUrls", 1, 1], ["endFrameUrls", 0, 1], ["referenceImageUrls", 0, 8]]) {
    const values = body[field] ?? [];
    if (!Array.isArray(values) || values.length < min || values.length > max || values.some(url => typeof url !== "string" || !url.trim())) fail(`Kling 4.0 requires ${min === 1 ? "exactly one Start Frame" : `at most ${max} ${field === "endFrameUrls" ? "End Frame" : "middle keyframe images"}`}.`);
    frames[field] = values;
  }
  const label = body.duration ?? "5 seconds";
  if (!kling4DurationOptions.includes(label)) fail("Kling 4.0 duration must be 3–30 whole seconds.");
  const resolution = body.resolution ?? "1080p";
  if (!kling4ResolutionOptions(provider).includes(resolution)) fail(`Kling 4.0 ${provider === "fal" ? "Fal supports 720p or 1080p" : "Atlas Cloud requires a supported native or ESR resolution"}.`);
  const prompt = String(body.prompt || "").trim();
  const input = { ...(prompt ? { prompt } : {}), duration: Number.parseInt(label, 10), resolution };
  if (provider === "atlas") {
    input.model = kling4Endpoints.atlas;
    input.image = frames.startFrameUrls[0];
    if (frames.endFrameUrls.length) input.last_image = frames.endFrameUrls[0];
    if (frames.referenceImageUrls.length) input.middle_images = [...frames.referenceImageUrls];
  } else {
    if (!prompt) fail("Kling 4.0 on Fal requires a motion prompt.");
    input.start_image_url = frames.startFrameUrls[0];
    if (frames.endFrameUrls.length) input.end_image_url = frames.endFrameUrls[0];
    if (frames.referenceImageUrls.length) input.middle_image_urls = [...frames.referenceImageUrls];
  }
  return { endpoint: kling4Endpoints[provider], input };
}
export function kling4Cost(endpoint, duration) {
  return { amountUsd: null, currency: "USD", estimated: false, pricingStatus: "unpriced", units: duration, unit: "second", mediaType: "video", endpoint,
    pricingBasis: "No verified Kling 4.0 price is available; consult the selected provider billing record." };
}
