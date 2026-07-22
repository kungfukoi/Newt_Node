export const kreaApiBaseUrl = "https://api.krea.ai";
export const kreaSeedancePromptBudget = 4000;

const additionalDirectionMarker = "\n\nAdditional direction:\n";
const compactedDirectorMarker = "\n\n[Director detail compacted for Seedance]\n\n";

const kreaSeedanceRates = Object.freeze({
  standard: Object.freeze({
    "480p": Object.freeze({ withVideoReference: 0.0849, withoutVideoReference: 0.1415 }),
    "720p": Object.freeze({ withVideoReference: 0.1911, withoutVideoReference: 0.3186 }),
    "1080p": Object.freeze({ withVideoReference: 0.4301, withoutVideoReference: 0.7168 }),
    "4k": Object.freeze({ withVideoReference: 1.7203, withoutVideoReference: 2.8671 })
  }),
  fast: Object.freeze({
    "480p": Object.freeze({ withVideoReference: 0.0677, withoutVideoReference: 0.1129 }),
    "720p": Object.freeze({ withVideoReference: 0.1524, withoutVideoReference: 0.254 })
  })
});

export function resolveSeedanceRuntimeProvider({ preferredProvider, falKey, kreaKey } = {}) {
  const preferred = String(preferredProvider || "").trim().toLowerCase();
  const hasFal = Boolean(String(falKey || "").trim());
  const hasKrea = Boolean(String(kreaKey || "").trim());
  if (preferred === "fal") return hasFal ? "fal" : "";
  if (preferred === "krea") return hasKrea ? "krea" : "";
  if (hasFal) return "fal";
  if (hasKrea) return "krea";
  return "";
}

export function kreaSeedanceEndpoint(speed) {
  return speed === "fast"
    ? "/generate/video/bytedance/seedance-2-fast"
    : "/generate/video/bytedance/seedance-2";
}

export function kreaReferenceImageTarget(width, height, maxDimension = 2048) {
  const sourceWidth = Math.max(1, Math.round(Number(width) || 0));
  const sourceHeight = Math.max(1, Math.round(Number(height) || 0));
  const ratio = sourceWidth / sourceHeight;
  const panoramicThreshold = 2.25;
  if (ratio <= panoramicThreshold && ratio >= 1 / panoramicThreshold) {
    return { width: sourceWidth, height: sourceHeight, needsNormalization: false };
  }

  const landscape = ratio > 1;
  const targetRatio = landscape ? 16 / 9 : 9 / 16;
  const longestSide = Math.min(Math.max(sourceWidth, sourceHeight), Math.max(512, Number(maxDimension) || 2048));
  const targetWidth = landscape ? longestSide : Math.round(longestSide * targetRatio);
  const targetHeight = landscape ? Math.round(longestSide / targetRatio) : longestSide;

  return {
    width: evenDimension(targetWidth),
    height: evenDimension(targetHeight),
    needsNormalization: true
  };
}

export function compactKreaSeedancePrompt(prompt, maxLength = kreaSeedancePromptBudget) {
  const normalized = String(prompt || "").trim();
  const budget = Math.max(400, Number(maxLength) || kreaSeedancePromptBudget);
  if (utf8Length(normalized) <= budget) return normalized;

  const supplementalIndex = normalized.lastIndexOf(additionalDirectionMarker);
  if (supplementalIndex < 0) return compactDirectorText(normalized, budget);

  const director = normalized.slice(0, supplementalIndex).trim();
  const supplemental = normalized.slice(supplementalIndex + additionalDirectionMarker.length).trim();
  const supplementalBudget = Math.min(utf8Length(supplemental), Math.max(160, budget - 600));
  const safeSupplemental = utf8Length(supplemental) <= supplementalBudget
    ? supplemental
    : `${clipUtf8Start(supplemental, supplementalBudget - 3).trimEnd()}...`;
  const directorBudget = budget - utf8Length(additionalDirectionMarker) - utf8Length(safeSupplemental);

  return `${compactDirectorText(director, directorBudget)}${additionalDirectionMarker}${safeSupplemental}`;
}

function compactDirectorText(value, maxLength) {
  const text = String(value || "").trim();
  if (utf8Length(text) <= maxLength) return text;

  const styleStart = text.indexOf("Style Direction:");
  const cameraStart = styleStart >= 0 ? text.indexOf("Camera Direction:", styleStart) : -1;
  if (styleStart >= 0 && cameraStart > styleStart) {
    const prefix = text.slice(0, styleStart).trimEnd();
    const suffix = text.slice(cameraStart).trimStart();
    const styleBudget = maxLength - utf8Length(prefix) - utf8Length(suffix) - 4;
    if (styleBudget >= 120) {
      const style = text.slice(styleStart, cameraStart).trim();
      const compactStyle = utf8Length(style) <= styleBudget
        ? style
        : `${clipUtf8Start(style, styleBudget - 3).trimEnd()}...`;
      return `${prefix}\n\n${compactStyle}\n\n${suffix}`;
    }
  }

  if (maxLength <= utf8Length(compactedDirectorMarker) + 80) return clipUtf8Start(text, maxLength).trimEnd();
  const available = maxLength - utf8Length(compactedDirectorMarker);
  const headLength = Math.max(120, Math.floor(available * 0.32));
  const tailLength = available - headLength;
  return `${clipUtf8Start(text, headLength).trimEnd()}${compactedDirectorMarker}${clipUtf8End(text, tailLength).trimStart()}`;
}

function utf8Length(value) {
  return new TextEncoder().encode(String(value || "")).length;
}

function clipUtf8Start(value, maxBytes) {
  const text = String(value || "");
  if (utf8Length(text) <= maxBytes) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (utf8Length(text.slice(0, middle)) <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return text.slice(0, low);
}

function clipUtf8End(value, maxBytes) {
  const text = String(value || "");
  if (utf8Length(text) <= maxBytes) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (utf8Length(text.slice(-middle)) <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return text.slice(-low);
}

export function estimateKreaSeedanceCost({ speed, durationSeconds, resolution, hasVideoReference }) {
  const tier = speed === "fast" ? "fast" : "standard";
  const fallbackResolution = tier === "fast" ? "720p" : "720p";
  const normalizedResolution = kreaSeedanceRates[tier][resolution] ? resolution : fallbackResolution;
  const rate = kreaSeedanceRates[tier][normalizedResolution][
    hasVideoReference ? "withVideoReference" : "withoutVideoReference"
  ];
  const seconds = Math.max(1, Number(durationSeconds) || 5);

  return {
    amountUsd: roundCurrency(seconds * rate),
    currency: "USD",
    unitRateUsd: rate,
    units: seconds,
    unit: "second",
    mediaType: "video",
    resolution: normalizedResolution,
    durationSeconds: seconds,
    pricingBasis: `Krea Seedance 2 ${tier} per-second estimate (${hasVideoReference ? "with" : "without"} video reference)`,
    pricingSource: "krea-api-pricing-2026-07-12"
  };
}

export function extractKreaJobResultUrl(job) {
  const urls = job?.result?.urls;
  if (typeof urls === "string" && urls.trim()) return urls.trim();

  if (Array.isArray(urls)) {
    const preferred = urls.find((item) => item?.type === "model" && typeof item?.url === "string");
    if (preferred?.url) return preferred.url;
    for (const item of urls) {
      if (typeof item === "string" && item.trim()) return item.trim();
      if (typeof item?.url === "string" && item.url.trim()) return item.url.trim();
    }
  }

  if (urls && typeof urls === "object") {
    for (const value of Object.values(urls)) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value?.url === "string" && value.url.trim()) return value.url.trim();
    }
  }

  return "";
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
}

function evenDimension(value) {
  const rounded = Math.max(2, Math.round(Number(value) || 2));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}
