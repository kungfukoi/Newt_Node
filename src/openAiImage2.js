export const openAiImage2Quality = "high";
export const openAiImage2QualityOptions = ["auto", "low", "medium", "high", "xhigh", "max"];
export const openAiImage2Background = "auto";
export const openAiImage2BackgroundOptions = ["auto", "transparent", "opaque"];
export const openAiImage2Variant = "flare";
export const openAiImage2VariantOptions = ["flare", "sunburst"];

export const openAiImage2Costs = {
  low: {
    text: {
      "1K": { landscape: 0.00441, square: 0.00588, portrait: 0.00474 },
      "2K": { landscape: 0.00441, square: 0.00615, portrait: 0.00615 },
      "4K": { landscape: 0.01113, square: 0.01113, portrait: 0.01113 }
    },
    edit: {
      "1K": { landscape: 0.00441, square: 0.00588, portrait: 0.00474 },
      "2K": { landscape: 0.00441, square: 0.00615, portrait: 0.00615 },
      "4K": { landscape: 0.01113, square: 0.01113, portrait: 0.01113 }
    }
  },
  medium: {
    text: {
      "1K": { landscape: 0.01029, square: 0.01317, portrait: 0.01029 },
      "2K": { landscape: 0.01029, square: 0.01434, portrait: 0.01434 },
      "4K": { landscape: 0.02595, square: 0.02595, portrait: 0.02595 }
    },
    edit: {
      "1K": { landscape: 0.01029, square: 0.01317, portrait: 0.01029 },
      "2K": { landscape: 0.01029, square: 0.01434, portrait: 0.01434 },
      "4K": { landscape: 0.02595, square: 0.02595, portrait: 0.02595 }
    }
  },
  high: {
    text: {
      "1K": { landscape: 0.0396, square: 0.05268, portrait: 0.04116 },
      "2K": { landscape: 0.0396, square: 0.05529, portrait: 0.05529 },
      "4K": { landscape: 0.10008, square: 0.10008, portrait: 0.10008 }
    },
    edit: {
      "1K": { landscape: 0.0396, square: 0.05268, portrait: 0.04116 },
      "2K": { landscape: 0.0396, square: 0.05529, portrait: 0.05529 },
      "4K": { landscape: 0.10008, square: 0.10008, portrait: 0.10008 }
    }
  },
  xhigh: {
    text: {
      "1K": { landscape: 0.07041, square: 0.09366, portrait: 0.07377 },
      "2K": { landscape: 0.07041, square: 0.09828, portrait: 0.09828 },
      "4K": { landscape: 0.1779, square: 0.1779, portrait: 0.1779 }
    },
    edit: {
      "1K": { landscape: 0.07041, square: 0.09366, portrait: 0.07377 },
      "2K": { landscape: 0.07041, square: 0.09828, portrait: 0.09828 },
      "4K": { landscape: 0.1779, square: 0.1779, portrait: 0.1779 }
    }
  },
  max: {
    text: {
      "1K": { landscape: 0.1584, square: 0.21072, portrait: 0.16464 },
      "2K": { landscape: 0.1584, square: 0.2211, portrait: 0.2211 },
      "4K": { landscape: 0.40026, square: 0.40026, portrait: 0.40026 }
    },
    edit: {
      "1K": { landscape: 0.1584, square: 0.21072, portrait: 0.16464 },
      "2K": { landscape: 0.1584, square: 0.2211, portrait: 0.2211 },
      "4K": { landscape: 0.40026, square: 0.40026, portrait: 0.40026 }
    }
  }
};

export const legacyOpenAiImage2Costs = {
  low: {
    text: {
      "1K": { landscape: 0.005, square: 0.006, portrait: 0.005 },
      "2K": { landscape: 0.005, square: 0.007, portrait: 0.007 },
      "4K": { landscape: 0.012, square: 0.012, portrait: 0.012 }
    },
    edit: {
      "1K": { landscape: 0.011, square: 0.015, portrait: 0.018 },
      "2K": { landscape: 0.017, square: 0.019, portrait: 0.019 },
      "4K": { landscape: 0.024, square: 0.024, portrait: 0.024 }
    }
  },
  medium: {
    text: {
      "1K": { landscape: 0.037, square: 0.053, portrait: 0.042 },
      "2K": { landscape: 0.04, square: 0.056, portrait: 0.056 },
      "4K": { landscape: 0.101, square: 0.101, portrait: 0.101 }
    },
    edit: {
      "1K": { landscape: 0.043, square: 0.061, portrait: 0.054 },
      "2K": { landscape: 0.053, square: 0.068, portrait: 0.068 },
      "4K": { landscape: 0.113, square: 0.113, portrait: 0.113 }
    }
  },
  high: {
    text: {
      "1K": { landscape: 0.145, square: 0.211, portrait: 0.165 },
      "2K": { landscape: 0.158, square: 0.222, portrait: 0.222 },
      "4K": { landscape: 0.401, square: 0.401, portrait: 0.401 }
    },
    edit: {
      "1K": { landscape: 0.151, square: 0.219, portrait: 0.178 },
      "2K": { landscape: 0.158, square: 0.234, portrait: 0.234 },
      "4K": { landscape: 0.413, square: 0.413, portrait: 0.413 }
    }
  }
};

export const openAiImage2HighCosts = openAiImage2Costs.high;

export function normalizeOpenAiImage2Quality(value, fallback = openAiImage2Quality) {
  const normalized = String(value || "").trim().toLowerCase();
  return openAiImage2QualityOptions.includes(normalized) ? normalized : fallback;
}

export function normalizeOpenAiImage2Background(value, fallback = openAiImage2Background) {
  const normalized = String(value || "").trim().toLowerCase();
  return openAiImage2BackgroundOptions.includes(normalized) ? normalized : fallback;
}

export function normalizeOpenAiImage2Variant(value, fallback = openAiImage2Variant) {
  const normalized = String(value || "").trim().toLowerCase();
  return openAiImage2VariantOptions.includes(normalized) ? normalized : fallback;
}

export function openAiImage2FalEndpoint({ variant, edit = false } = {}) {
  return `openai/gpt-image-2.5/${normalizeOpenAiImage2Variant(variant)}/${edit ? "edit" : "text-to-image"}`;
}

export function buildOpenAiImage2FalInput({ prompt, imageSize, quality, background }) {
  return {
    prompt,
    image_size: imageSize,
    background: normalizeOpenAiImage2Background(background),
    quality: normalizeOpenAiImage2Quality(quality),
    num_images: 1,
    output_format: "png",
    sync_mode: false
  };
}

export function estimateOpenAiImage2Cost({ resolution, size, quality = openAiImage2Quality, edit = false, pricing = openAiImage2Costs }) {
  const normalizedQuality = normalizeOpenAiImage2Quality(quality);
  const qualityKey = normalizedQuality === "auto" ? openAiImage2Quality : normalizedQuality;
  const resolutionKey = normalizeOpenAiImage2Resolution(resolution, size);
  const orientation = openAiImage2Orientation(size);
  const qualityPricing = pricing?.[qualityKey] || openAiImage2Costs[qualityKey];
  const routePricing = qualityPricing?.[edit ? "edit" : "text"];
  return Number(routePricing?.[resolutionKey]?.[orientation] ?? openAiImage2Costs[qualityKey][edit ? "edit" : "text"][resolutionKey][orientation]);
}

export function estimateLegacyOpenAiImage2Cost({ resolution, size, quality = openAiImage2Quality, edit = false }) {
  const legacyQuality = ["low", "medium", "high"].includes(normalizeOpenAiImage2Quality(quality))
    ? normalizeOpenAiImage2Quality(quality)
    : openAiImage2Quality;
  return estimateOpenAiImage2Cost({ resolution, size, quality: legacyQuality, edit, pricing: legacyOpenAiImage2Costs });
}

export function estimateOpenAiImage2HighCost({ resolution, size, edit = false, pricing = openAiImage2HighCosts }) {
  return estimateOpenAiImage2Cost({
    resolution,
    size,
    quality: "high",
    edit,
    pricing: { high: pricing }
  });
}

function normalizeOpenAiImage2Resolution(resolution, size) {
  const normalized = String(resolution || "").toUpperCase();
  if (["1K", "2K", "4K"].includes(normalized)) return normalized;
  const dimensions = openAiImage2Dimensions(size);
  const longestEdge = Math.max(dimensions.width, dimensions.height);
  return longestEdge >= 2800 ? "4K" : longestEdge >= 1600 ? "2K" : "1K";
}

function openAiImage2Orientation(size) {
  const { width, height } = openAiImage2Dimensions(size);
  if (!width || !height) return "landscape";
  if (Math.abs(width / height - 1) < 0.12) return "square";
  return height > width ? "portrait" : "landscape";
}

function openAiImage2Dimensions(size) {
  const match = String(size || "").match(/(\d+)\s*x\s*(\d+)/i);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 0, height: 0 };
}
