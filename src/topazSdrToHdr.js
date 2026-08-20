export const topazSdrToHdrEndpoint = "topaz/sdr-to-hdr/video";
export const topazSdrToHdrModelName = "Topaz SDR to HDR";
export const topazSdrToHdrMaximumDurationSeconds = 300;
export const topazSdrToHdrOutputFormatOptions = ["mp4", "prores"];

export const topazSdrToHdrCostPerSecond = Object.freeze({
  "up-to-1080p": 0.24,
  "4k": 0.51
});

export function normalizeTopazSdrToHdrOutputFormat(value) {
  return String(value || "").trim().toLowerCase() === "prores" ? "prores" : "mp4";
}

export function topazSdrToHdrBillingTier({ width, height } = {}) {
  const normalizedWidth = Number(width || 0);
  const normalizedHeight = Number(height || 0);
  if (normalizedWidth <= 0 || normalizedHeight <= 0) return "";
  const longSide = Math.max(normalizedWidth, normalizedHeight);
  const shortSide = Math.min(normalizedWidth, normalizedHeight);
  return longSide > 1920 || shortSide > 1080 ? "4k" : "up-to-1080p";
}

export function estimateTopazSdrToHdrCost({
  endpoint = topazSdrToHdrEndpoint,
  durationSeconds,
  width,
  height,
  rates = topazSdrToHdrCostPerSecond
} = {}) {
  const seconds = Number(durationSeconds || 0);
  const billingResolutionTier = topazSdrToHdrBillingTier({ width, height });
  const unitRateUsd = rates?.[billingResolutionTier] ?? null;
  const hasEstimate = Number.isFinite(seconds) && seconds > 0 && unitRateUsd !== null;

  return {
    amountUsd: hasEstimate ? roundCurrency(seconds * unitRateUsd) : null,
    currency: "USD",
    unitRateUsd,
    units: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    unit: "video second",
    mediaType: "video",
    billingResolutionTier: billingResolutionTier || null,
    durationSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    sourceWidth: Number(width || 0) || null,
    sourceHeight: Number(height || 0) || null,
    pricingBasis: hasEstimate
      ? "Topaz SDR to HDR fal.ai per-second estimate by source resolution tier"
      : "Topaz SDR to HDR fal.ai estimate; source duration or resolution unavailable",
    pricingSource: "fal-model-page-2026-08-20",
    endpoint
  };
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
}
