import { imageModelNames } from "./modelOptions.js";

const imageModels = Object.freeze({
  [imageModelNames.legacyOpenAiImage2]: { id: "openai/gpt-image-2", family: "openai", maxReferences: 10 },
  [imageModelNames.nanoBanana2]: { id: "google/nano-banana-2", family: "nano", maxReferences: 14 },
  [imageModelNames.nanoBananaPro]: { id: "google/nano-banana-pro", family: "nano", maxReferences: 10 },
  [imageModelNames.reve21]: { id: "reve-ai/reve-2.1", family: "reve", maxReferences: 6 }
});

const videoModels = new Map([
  ["seedance 2.0", { id: "bytedance/seedance-2.0", family: "seedance", version: "2.0", limits: [9, 3, 3] }],
  ["seedance 2.5", { id: "bytedance/seedance-2.5", family: "seedance", version: "2.5", limits: [30, 10, 10] }],
  ["minimax h3", { id: "minimax/h3", family: "minimax", limits: [9, 3, 3] }]
]);

export function supportsAtlasImageModel(model) {
  return model === imageModelNames.openAiImage2 || Object.hasOwn(imageModels, model);
}

export function supportsAtlasVideoModel(model) {
  return videoModels.has(String(model || "").trim().toLowerCase());
}

export function buildAtlasImageRequest({
  model,
  variant = "flare",
  prompt,
  images = [],
  aspectRatio = "16:9",
  resolution = "2K",
  quality = "high",
  background = "auto",
  size,
  maskUrl = ""
} = {}) {
  const isImage25 = model === imageModelNames.openAiImage2;
  const config = isImage25
    ? { id: `openai/gpt-image-2.5-${normalizedChoice(variant, ["flare", "sunburst"], "flare")}`, family: "openai25", maxReferences: 16 }
    : imageModels[model];
  if (!config) fail(`Atlas Cloud does not support ${model || "this image model"}.`);
  if (!String(prompt || "").trim()) fail(`Atlas Cloud ${model} needs a prompt.`);
  if (!Array.isArray(images) || images.length > config.maxReferences || images.some((url) => !validRemoteUrl(url))) {
    fail(`Atlas Cloud ${model} accepts up to ${config.maxReferences} uploaded image references.`);
  }
  if (maskUrl && (config.family !== "openai25" || !images.length || !validRemoteUrl(maskUrl))) {
    fail("Atlas Cloud edit masks require OpenAI Image 2.5 and a reference image.");
  }

  const route = config.family === "reve" && images.length > 1 ? "remix" : images.length ? "edit" : "text-to-image";
  const request = {
    model: `${config.id}/${route}`,
    prompt: String(prompt).trim(),
    output_format: "png"
  };
  // GPT Image 2.5 has a strict per-model schema and rejects this legacy
  // Atlas envelope option as an extra field, especially on masked edits.
  if (config.family !== "openai25") request.enable_sync_mode = false;
  const normalizedResolution = config.family === "reve"
    ? "4K"
    : normalizedChoice(resolution, ["1K", "2K", "4K"], "2K");
  const ratio = normalizedAspectRatio(aspectRatio, config.family === "openai25");

  if (config.family === "openai" || config.family === "openai25") {
    request.size = size || atlasImageSize(ratio, normalizedResolution);
    request.quality = normalizedChoice(
      quality,
      config.family === "openai25" ? ["auto", "low", "medium", "high", "xhigh", "max"] : ["low", "medium", "high"],
      "high"
    );
    if (config.family === "openai25") {
      request.background = normalizedChoice(background, ["auto", "transparent", "opaque"], "auto");
      request.n = 1;
      if (maskUrl) request.mask = maskUrl;
    }
  } else {
    request.aspect_ratio = ratio;
    request.resolution = normalizedResolution;
    if (config.family === "nano") {
      request.media_resolution = "high";
      if (model === imageModelNames.nanoBanana2) request.thinking_level = "high";
    } else {
      request.remove_background = background === "transparent";
    }
  }

  if (images.length) {
    if (config.family === "reve" && images.length === 1) request.image = images[0];
    else request.images = images;
  }
  return request;
}

export function buildAtlasVideoRequest({
  model,
  prompt,
  startImage = "",
  endImage = "",
  images = [],
  videos = [],
  audios = [],
  aspectRatio,
  duration,
  resolution,
  generateAudio = true,
  seed
} = {}) {
  const spec = videoModels.get(String(model || "").trim().toLowerCase());
  if (!spec) fail(`Atlas Cloud does not support ${model || "this video model"}.`);
  const refs = { images, videos, audios };
  if (endImage && !startImage) fail("Atlas Cloud End Frame requires a Start Frame.");
  const hasReferences = Object.values(refs).some((items) => items.length);
  if (startImage && hasReferences) fail("Atlas Cloud cannot combine Start/End Frames with reference inputs on this route.");
  Object.entries(refs).forEach(([kind, values], index) => {
    if (!Array.isArray(values) || values.length > spec.limits[index] || values.some((url) => !validRemoteUrl(url))) {
      fail(`Atlas Cloud ${model} accepts up to ${spec.limits[index]} ${kind}.`);
    }
  });
  if ([startImage, endImage].filter(Boolean).some((url) => !validRemoteUrl(url))) fail("Atlas Cloud needs uploaded frame URLs.");
  const route = startImage ? "image-to-video" : hasReferences ? "reference-to-video" : "text-to-video";
  if (!String(prompt || "").trim() && route === "text-to-video") fail(`Atlas Cloud ${model} needs a prompt.`);
  const request = { model: `${spec.id}/${route}` };
  if (String(prompt || "").trim()) request.prompt = String(prompt).trim();

  if (spec.family === "seedance") {
    const is25 = spec.version === "2.5";
    request.duration = normalizedDuration(duration, 4, is25 ? 30 : 15, 5, true);
    request.resolution = normalizedSeedanceResolution(resolution, is25);
    request.ratio = normalizedVideoRatio(aspectRatio, startImage ? "adaptive" : "16:9");
    request.generate_audio = generateAudio !== false;
    if (seed !== undefined && seed !== null && seed !== "") {
      if (is25) fail("Atlas Cloud Seedance 2.5 does not document a seed setting.");
      request.seed = normalizedInteger(seed, "seed");
    }
    if (startImage) request.image = startImage;
    if (endImage) request.last_image = endImage;
    if (images.length) request.reference_images = images;
    if (videos.length) request.reference_videos = videos;
    if (audios.length) request.reference_audios = audios;
    if (is25 && hasReferences) request.omni_reference_task_type = "reference";
    return request;
  }

  if (images.length + videos.length + audios.length > 12) fail("Atlas Cloud MiniMax H3 accepts up to 12 references in total.");
  if (audios.length && !images.length && !videos.length) fail("Atlas Cloud MiniMax H3 audio references need an image or video reference.");
  request.resolution = normalizedChoice(resolution, ["768P", "2K"], "2K");
  request.duration = normalizedDuration(duration, 4, 15, 8);
  request.ratio = normalizedVideoRatio(aspectRatio, startImage || hasReferences ? "adaptive" : "16:9");
  request.prompt_expansion = false;
  if (startImage) request.image = startImage;
  if (endImage) request.end_image = endImage;
  if (hasReferences) {
    request.refers = Object.entries(refs).flatMap(([kind, urls]) => urls.map((url) => ({
      url,
      type: kind === "images" ? "image" : kind === "videos" ? "video" : "audio"
    })));
  }
  return request;
}

export function estimateAtlasImageCost({ model, resolution, referenceCount = 0, endpoint = "" } = {}) {
  const rates = model === imageModelNames.nanoBanana2
    ? { "1K": 0.08, "2K": 0.12, "4K": 0.16 }
    : model === imageModelNames.nanoBananaPro
      ? { "1K": 0.14, "2K": 0.14, "4K": 0.24 }
      : null;
  const amountUsd = rates?.[normalizedChoice(resolution, ["1K", "2K", "4K"], "2K")] ?? null;
  return {
    amountUsd,
    currency: "USD",
    units: 1,
    unit: "image",
    mediaType: "image",
    pricingBasis: amountUsd == null
      ? "Atlas Cloud route uses provider runtime pricing; no fixed local estimate is available"
      : "Atlas Cloud published standard per-image price",
    pricingSource: "https://api.atlascloud.ai/api/v1/pricing/models",
    endpoint,
    referenceCount
  };
}

export function estimateAtlasVideoCost({ model, duration, resolution, referenceImageCount = 0, endpoint = "" } = {}) {
  const seconds = normalizedDuration(duration, 4, 30, 5, true);
  const normalizedResolution = String(resolution || "").toUpperCase();
  let amountUsd = null;
  if (model === "MiniMax H3" && seconds > 0 && ["768P", "2K"].includes(normalizedResolution)) {
    const rate = normalizedResolution === "2K" ? 0.13 : 0.08;
    amountUsd = seconds * rate + Math.max(0, referenceImageCount - 5) * 0.04;
  }
  return {
    amountUsd,
    currency: "USD",
    units: seconds > 0 ? seconds : null,
    unit: "second",
    mediaType: "video",
    pricingBasis: amountUsd == null
      ? "Atlas Cloud route uses provider runtime pricing; no fixed local estimate is available"
      : "Atlas Cloud published standard duration and reference estimate",
    pricingSource: "https://api.atlascloud.ai/api/v1/pricing/models",
    endpoint
  };
}

function atlasImageSize(ratio, resolution) {
  const presets = {
    "1K": { "21:9": "1344x576", "16:9": "1280x720", "1:1": "1024x1024", "9:16": "720x1280" },
    "2K": { "21:9": "2048x880", "16:9": "2048x1152", "1:1": "2048x2048", "9:16": "1152x2048" },
    "4K": { "21:9": "3840x1648", "16:9": "3840x2160", "1:1": "2880x2880", "9:16": "2160x3840" }
  };
  return presets[resolution]?.[ratio] || presets[resolution]?.["16:9"] || presets["2K"]["16:9"];
}

function normalizedAspectRatio(value, allowAuto = false) {
  const normalized = String(value || "16:9").replace(/\s+\((?:Landscape|Portrait)\)$/i, "");
  if (allowAuto && /^auto$/i.test(normalized)) return "auto";
  return /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(normalized) ? normalized : "16:9";
}

function normalizedVideoRatio(value, fallback) {
  const normalized = String(value || fallback).replace(/\s+\((?:Landscape|Portrait)\)$/i, "");
  return /^auto$/i.test(normalized) ? "adaptive" : normalized;
}

function normalizedSeedanceResolution(value, is25) {
  const choices = is25
    ? ["480p", "720p", "720p-sr", "720p-esr", "1080p", "1080p-sr", "1080p-esr", "1080p-esr & 60fps", "1440p-sr", "1440p-esr", "4k-esr"]
    : ["480p", "720p", "720p-SR", "1080p", "1080p-SR", "1440p-SR", "4k"];
  return normalizedChoice(value, choices, "720p");
}

function normalizedChoice(value, choices, fallback) {
  const requested = String(value ?? "").trim().toLowerCase();
  return choices.find((choice) => choice.toLowerCase() === requested) || fallback;
}

function normalizedDuration(value, minimum, maximum, fallback, allowAuto = false) {
  if (allowAuto && /^auto$/i.test(String(value || "").trim())) return -1;
  const parsed = Number(String(value ?? "").match(/-?\d+/)?.[0]);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function normalizedInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail(`Atlas Cloud ${field} must be an integer.`);
  return parsed;
}

function validRemoteUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function fail(message) {
  throw Object.assign(new Error(message), { status: 400 });
}
