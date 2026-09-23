const imageReferenceLimits = Object.freeze({
  fal: Object.freeze({
    "z-image": 1,
    "seedream-5-pro": 10,
    "nano-banana-2": 14,
    "nano-banana-pro": 14,
    "openai-image-2-5": 16,
    "openai-image-2": 16,
    "reve-2-1": 8,
    "krea-2-large": 10
  }),
  atlas: Object.freeze({
    "openai-image-2-5": 16,
    "openai-image-2": 10,
    "nano-banana-2": 14,
    "nano-banana-pro": 10,
    "reve-2-1": 6
  }),
  krea: Object.freeze({
    "z-image": 1,
    "seedream-5-pro": 10,
    "nano-banana-2": 14,
    "nano-banana-pro": 14,
    "openai-image-2": 10,
    "krea-2-large": 10
  })
});

function imageReferenceModelKey(model = "") {
  const normalized = String(model || "").trim().toLowerCase();
  if (normalized.includes("openai image 2.5") || normalized.includes("gpt image 2.5")) return "openai-image-2-5";
  if (normalized.includes("openai image 2") || normalized.includes("gpt image 2")) return "openai-image-2";
  if (normalized.includes("nano banana 2")) return "nano-banana-2";
  if (normalized.includes("nano banana pro")) return "nano-banana-pro";
  if (normalized.includes("seedream 5")) return "seedream-5-pro";
  if (normalized.includes("z-image") || normalized.includes("z image")) return "z-image";
  if (normalized.includes("reve 2.1") || normalized.includes("reve-2.1")) return "reve-2-1";
  if (normalized.includes("krea 2 large")) return "krea-2-large";
  return "";
}

export function imageModelReferenceLimit(model, provider = "fal") {
  const modelKey = imageReferenceModelKey(model);
  const normalizedProvider = String(provider || "fal").trim().toLowerCase();
  return imageReferenceLimits[normalizedProvider]?.[modelKey] || null;
}

export function imageReferenceProviderLabel(provider = "fal") {
  if (provider === "atlas") return "Atlas Cloud";
  if (provider === "krea") return "Krea";
  if (provider === "google") return "Google";
  return "Fal";
}

export function imageReferenceLimitError({ model, provider = "fal", count = 0 } = {}) {
  const limit = imageModelReferenceLimit(model, provider);
  const normalizedCount = Math.max(0, Number(count) || 0);
  if (!limit || normalizedCount <= limit) return "";
  const excess = normalizedCount - limit;
  return `${model} accepts up to ${limit} reference images through ${imageReferenceProviderLabel(provider)}; ${normalizedCount} were supplied. Disconnect ${excess} reference${excess === 1 ? "" : "s"} and retry. Newt did not submit a truncated generation.`;
}
