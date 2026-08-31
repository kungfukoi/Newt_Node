export const minimaxH3ModelName = "MiniMax H3";

export const minimaxH3Endpoints = {
  text: "minimax/h3/text-to-video",
  image: "minimax/h3/image-to-video",
  reference: "minimax/h3/reference-to-video"
};

export const minimaxH3DurationOptions = Array.from({ length: 11 }, (_value, index) => `${index + 5} seconds`);
export const minimaxH3ResolutionOptions = ["768P", "2K"];
export const minimaxH3LocalResolutionOptions = ["576P"];
export const minimaxH3TextAspectRatioOptions = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
export const minimaxH3ReferenceAspectRatioOptions = ["adaptive", ...minimaxH3TextAspectRatioOptions];

export const minimaxH3ReferenceLimits = {
  images: 9,
  videos: 3,
  audios: 3,
  total: 12,
  minimumMediaSeconds: 2,
  maximumMediaSeconds: 15,
  videoSeconds: 15,
  audioSeconds: 15,
  freeImages: 5,
  additionalImageCost: 0.08
};

export const minimaxH3CostPerSecond = {
  "480P": 0.05,
  "768P": 0.06,
  "2K": 0.13,
  "4K": 0.16
};

export function isMinimaxH3Model(model) {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized === "minimax h3" || normalized.includes("minimax/h3") || normalized.includes("minimax h3");
}

export function normalizeMinimaxH3Duration(value) {
  const seconds = Math.min(15, Math.max(5, Math.round(Number(String(value ?? "").match(/\d+/)?.[0]) || 5)));
  return seconds;
}

export function normalizeMinimaxH3DurationLabel(value) {
  return `${normalizeMinimaxH3Duration(value)} seconds`;
}

export function minimaxH3ResolutionOptionsForProvider(provider = "fal") {
  return String(provider || "").trim().toLowerCase() === "local"
    ? minimaxH3LocalResolutionOptions
    : minimaxH3ResolutionOptions;
}

export function normalizeMinimaxH3Resolution(value, provider = "fal") {
  const options = minimaxH3ResolutionOptionsForProvider(provider);
  const fallback = options.includes("2K") ? "2K" : options[0];
  const normalized = String(value || fallback).toUpperCase();
  return options.find((option) => option.toUpperCase() === normalized) || fallback;
}

export function normalizeMinimaxH3AspectRatio(value, route = "text-to-video") {
  if (route === "image-to-video") return "adaptive";
  const options = route === "reference-to-video" ? minimaxH3ReferenceAspectRatioOptions : minimaxH3TextAspectRatioOptions;
  const normalized = String(value || (route === "reference-to-video" ? "adaptive" : "16:9"));
  return options.includes(normalized) ? normalized : route === "reference-to-video" ? "adaptive" : "16:9";
}

export function minimaxH3Route({ hasStartFrame = false, referenceImageCount = 0, referenceVideoCount = 0, referenceAudioCount = 0 } = {}) {
  if (hasStartFrame) return "image-to-video";
  if (referenceImageCount + referenceVideoCount + referenceAudioCount > 0) return "reference-to-video";
  return "text-to-video";
}

export function minimaxH3ExactAudioSource(referenceAudioUrls = [], route = "") {
  const urls = (Array.isArray(referenceAudioUrls) ? referenceAudioUrls : []).filter(Boolean);
  return route === "reference-to-video" && urls.length === 1 ? urls[0] : "";
}

export function minimaxH3Endpoint(route) {
  if (route === "image-to-video") return minimaxH3Endpoints.image;
  if (route === "reference-to-video") return minimaxH3Endpoints.reference;
  return minimaxH3Endpoints.text;
}

export function buildMinimaxH3ReferencePrompt(prompt, {
  imageNames = [],
  videoNames = [],
  audioNames = [],
  syntax = "fal",
  ensureAllReferences = false
} = {}) {
  const mentionMap = new Map();
  const references = [];
  const mediaToken = (type, index) => syntax === "sglang"
    ? `<${type === "Image" ? "Picture" : type} ${index + 1}>`
    : `${type} ${index + 1}`;
  const addReferences = (type, names) => {
    names.forEach((rawName, index) => {
      const name = String(rawName || "").trim();
      const token = mediaToken(type, index);
      if (name) mentionMap.set(name.toLowerCase(), token);
      if (index === 0) mentionMap.set(type.toLowerCase(), token);
      mentionMap.set(`${type}${index + 1}`.toLowerCase(), token);
      mentionMap.set(`${type}-${index + 1}`.toLowerCase(), token);
      references.push({ type, name, token });
    });
  };

  addReferences("Image", imageNames);
  addReferences("Video", videoNames);
  addReferences("Audio", audioNames);

  let submittedPrompt = String(prompt || "").replace(
    /@([A-Za-z0-9_-]+)/g,
    (fullMatch, name) => mentionMap.get(name.toLowerCase()) || fullMatch
  );
  if (!ensureAllReferences) return submittedPrompt;

  const missingReferences = references.filter(({ token }) => !submittedPrompt.includes(token));
  if (!missingReferences.length) return submittedPrompt;

  const referenceInstructions = missingReferences.map(({ type, name, token }) => {
    const compactToken = token.replace(/[<>\s]/g, "").toLowerCase();
    const label = name && name.toLowerCase() !== compactToken ? ` (${name})` : "";
    if (type === "Image") return `Use ${token}${label} as a visual identity/style reference.`;
    if (type === "Video") return `Use ${token}${label} as a motion/camera reference.`;
    return `Use ${token}${label} as an audio/voice reference.`;
  });
  return [submittedPrompt.trim(), `Reference bindings: ${referenceInstructions.join(" ")}`]
    .filter(Boolean)
    .join("\n\n");
}

export function buildMinimaxH3Input({
  route,
  prompt,
  duration,
  resolution,
  aspectRatio,
  seed,
  enablePromptExpansion = true,
  enableSafetyChecker = true,
  imageUrl = "",
  endImageUrl = "",
  referenceImageUrls = [],
  referenceVideoUrls = [],
  referenceAudioUrls = []
} = {}) {
  const normalizedRoute = ["text-to-video", "image-to-video", "reference-to-video"].includes(route) ? route : "text-to-video";
  const normalizedPrompt = String(prompt || "").trim();
  const input = {
    prompt: normalizedRoute === "reference-to-video"
      ? buildMinimaxH3ReferencePrompt(normalizedPrompt, {
        imageNames: referenceImageUrls.map((_url, index) => `Image${index + 1}`),
        videoNames: referenceVideoUrls.map((_url, index) => `Video${index + 1}`),
        audioNames: referenceAudioUrls.map((_url, index) => `Audio${index + 1}`),
        syntax: "fal",
        ensureAllReferences: true
      })
      : normalizedPrompt,
    duration: normalizeMinimaxH3Duration(duration),
    resolution: normalizeMinimaxH3Resolution(resolution),
    enable_prompt_expansion: enablePromptExpansion !== false,
    enable_safety_checker: enableSafetyChecker !== false
  };
  const normalizedSeed = Number(seed);
  if (seed !== "" && seed !== null && seed !== undefined && Number.isInteger(normalizedSeed)) input.seed = normalizedSeed;

  if (normalizedRoute === "text-to-video" || normalizedRoute === "reference-to-video") {
    input.aspect_ratio = normalizeMinimaxH3AspectRatio(aspectRatio, normalizedRoute);
  }
  if (normalizedRoute === "image-to-video") {
    if (imageUrl) input.image_url = imageUrl;
    if (endImageUrl) input.end_image_url = endImageUrl;
  }
  if (normalizedRoute === "reference-to-video") {
    if (referenceImageUrls.length) input.reference_image_urls = referenceImageUrls;
    if (referenceVideoUrls.length) input.reference_video_urls = referenceVideoUrls;
    if (referenceAudioUrls.length) input.reference_audio_urls = referenceAudioUrls;
  }
  return input;
}

export function validateMinimaxH3References({
  imageCount = 0,
  videoCount = 0,
  audioCount = 0,
  videoDurations = [],
  audioDurations = []
} = {}) {
  const limits = minimaxH3ReferenceLimits;
  if (imageCount > limits.images) return `MiniMax H3 accepts up to ${limits.images} reference images.`;
  if (videoCount > limits.videos) return `MiniMax H3 accepts up to ${limits.videos} reference videos.`;
  if (audioCount > limits.audios) return `MiniMax H3 accepts up to ${limits.audios} reference audio files.`;
  if (imageCount + videoCount + audioCount > limits.total) return `MiniMax H3 accepts up to ${limits.total} total reference files.`;
  if (audioCount && !imageCount && !videoCount) return "MiniMax H3 reference audio requires at least one reference image or video.";
  if (videoDurations.some((seconds) => seconds > 0 && (seconds < limits.minimumMediaSeconds || seconds > limits.maximumMediaSeconds))) {
    return `MiniMax H3 reference videos must be ${limits.minimumMediaSeconds}-${limits.maximumMediaSeconds} seconds long.`;
  }
  if (audioDurations.some((seconds) => seconds > 0 && (seconds < limits.minimumMediaSeconds || seconds > limits.maximumMediaSeconds))) {
    return `MiniMax H3 reference audio must be ${limits.minimumMediaSeconds}-${limits.maximumMediaSeconds} seconds long.`;
  }
  if (videoDurations.reduce((total, seconds) => total + seconds, 0) > limits.videoSeconds) {
    return `MiniMax H3 reference videos can be up to ${limits.videoSeconds} seconds total.`;
  }
  if (audioDurations.reduce((total, seconds) => total + seconds, 0) > limits.audioSeconds) {
    return `MiniMax H3 reference audio can be up to ${limits.audioSeconds} seconds total.`;
  }
  return "";
}

export function estimateMinimaxH3Cost({
  duration,
  resolution,
  referenceImageCount = 0,
  rates = minimaxH3CostPerSecond,
  freeReferenceImages = minimaxH3ReferenceLimits.freeImages,
  additionalReferenceImageCost = minimaxH3ReferenceLimits.additionalImageCost
} = {}) {
  const durationSeconds = normalizeMinimaxH3Duration(duration);
  const normalizedResolution = normalizeMinimaxH3Resolution(resolution);
  const costPerSecond = Number(rates?.[normalizedResolution] ?? minimaxH3CostPerSecond[normalizedResolution]);
  const additionalReferenceImages = Math.max(0, Math.floor(Number(referenceImageCount) || 0) - Math.max(0, Number(freeReferenceImages) || 0));
  const referenceImageCost = additionalReferenceImages * Math.max(0, Number(additionalReferenceImageCost) || 0);
  return {
    amountUsd: durationSeconds * costPerSecond + referenceImageCost,
    units: durationSeconds,
    unit: "second",
    costPerSecond,
    durationSeconds,
    resolution: normalizedResolution,
    referenceImageCount: Math.max(0, Math.floor(Number(referenceImageCount) || 0)),
    additionalReferenceImages,
    referenceImageCost,
    pricingBasis: "duration + reference images"
  };
}
