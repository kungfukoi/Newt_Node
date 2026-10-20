// Fal text/keyframes-to-video schemas checked 2026-10-20:
// https://fal.ai/models/blackforestlabs/flux-3-max/keyframes-to-video/api
export const flux3MaxModelName = "FLUX 3 Max";
export const flux3MaxDurationOptions = Array.from({ length: 16 }, (_, i) => `${i + 5} seconds`);
export const flux3MaxResolutionOptions = ["720p", "1080p"];
export const flux3MaxAspectRatioOptions = ["Auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"];
export const isFlux3MaxModel = model => String(model || "").trim().toLowerCase() === "flux 3 max";
export const flux3MaxUnsupportedPorts = ["directorIn", "characterIn", "startFrameIn", "endFrameIn", "referenceVideoIn", "referenceAudioIn"];

export function flux3MaxKeyframeRows(data = {}) {
  if (Array.isArray(data.flux3MaxKeyframes) && data.flux3MaxKeyframes.length) return data.flux3MaxKeyframes;
  return [{ id: "referenceImageIn", frameIndex: "0" }];
}

export function flux3MaxKeyframePorts(data, color) {
  return flux3MaxKeyframeRows(data).map((row, index) => ({ id: row.id, label: `Keyframe ${index + 1}`, color }));
}

export function flux3MaxSelectionPatch(data = {}) {
  return {
    model: flux3MaxModelName,
    characterVoiceMode: "off",
    duration: flux3MaxDurationOptions.includes(data.duration) ? data.duration : "5 seconds",
    resolution: flux3MaxResolutionOptions.includes(data.resolution) ? data.resolution : "720p",
    aspectRatio: flux3MaxAspectRatioOptions.includes(data.aspectRatio) ? data.aspectRatio : "Auto",
    flux3MaxReasoningLevel: ["low", "high"].includes(data.flux3MaxReasoningLevel) ? data.flux3MaxReasoningLevel : "high",
    generateAudio: data.generateAudio !== false,
    seed: data.seed ?? ""
  };
}

// Validate before any upload or paid submission. Unsupported inputs must never
// silently disappear, including inputs retained in an older workflow.
export function buildFlux3MaxRequest(body = {}) {
  const prompt = String(body.prompt || "").trim();
  if (!prompt) throw new Error("Prompt is required.");
  for (const field of ["characterReferenceUrls", "referenceVideoUrls", "referenceAudioUrls"]) {
    if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].length)) throw new Error("FLUX 3 Max accepts image keyframes only. Disconnect Character, video and audio references.");
  }
  if (body.filmDirector || body.characterDialogue || body.exactDialogueAudio) throw new Error("FLUX 3 Max does not support Director or assigned Character audio.");
  for (const field of ["startFrameUrls", "endFrameUrls", "referenceImageUrls"]) {
    if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].length)) throw new Error("FLUX 3 Max accepts images through Keyframe inputs only.");
  }
  const durationLabel = body.duration ?? "5 seconds";
  if (!flux3MaxDurationOptions.includes(durationLabel)) throw new Error("FLUX 3 Max duration must be 5–20 seconds.");
  const resolution = body.resolution ?? "720p";
  if (!flux3MaxResolutionOptions.includes(resolution)) throw new Error("FLUX 3 Max resolution must be 720p or 1080p.");
  const aspectRatio = body.aspectRatio ?? "Auto";
  if (!flux3MaxAspectRatioOptions.includes(aspectRatio)) throw new Error("Choose a supported FLUX 3 Max aspect ratio.");
  const reasoning = body.flux3MaxReasoningLevel ?? "high";
  if (!["low", "high"].includes(reasoning)) throw new Error("FLUX 3 Max reasoning must be low or high.");
  if (body.generateAudio !== undefined && typeof body.generateAudio !== "boolean") throw new Error("Invalid FLUX 3 Max audio setting.");
  const input = { prompt, duration: Number.parseInt(durationLabel, 10), resolution, aspect_ratio: aspectRatio.toLowerCase(), reasoning_level: reasoning, generate_audio: body.generateAudio !== false };
  if (body.seed !== undefined && body.seed !== null && body.seed !== "") {
    if (!Number.isSafeInteger(Number(body.seed))) throw new Error("FLUX 3 Max seed must be an integer.");
    input.seed = Number(body.seed);
  }
  const frames = body.flux3MaxKeyframes ?? [];
  if (!Array.isArray(frames) || frames.some(frame => !frame || typeof frame.image_url !== "string" || !frame.image_url.trim() || !/^\d+$/.test(String(frame.frame_index)))) throw new Error("Each keyframe needs one image and an integer frame index.");
  if (frames.length) {
    input.keyframes = frames.map(frame => ({ image_url: frame.image_url, frame_index: Number(frame.frame_index) }));
    if (input.keyframes.length > 10) throw new Error("FLUX 3 Max supports up to 10 keyframes.");
    const indices = input.keyframes.map(frame => frame.frame_index);
    if (indices.some(index => !Number.isSafeInteger(index) || index < 0 || index > input.duration * 24) || new Set(indices).size !== indices.length) throw new Error(`Keyframe indices must be unique integers from 0 to ${input.duration * 24} (24 fps).`);
    input.keyframes.sort((a, b) => a.frame_index - b.frame_index);
    return { endpoint: "blackforestlabs/flux-3-max/keyframes-to-video", input };
  }
  return { endpoint: "blackforestlabs/flux-3-max/text-to-video", input };
}

export function flux3MaxCost(endpoint, duration) {
  return { amountUsd: null, currency: "USD", estimated: false, pricingStatus: "unpriced", units: duration, unit: "second", mediaType: "video", endpoint,
    pricingSource: "https://fal.ai/models/blackforestlabs/flux-3-max/text-to-video", pricingBasis: "FLUX 3 Max pricing has not been verified locally; check the Fal billing record." };
}
