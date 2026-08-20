export const fluxVideoUpscaleEndpoint = "blackforestlabs/flux-video-upscale";
export const fluxVideoUpscaleModelName = "Flux Video Upscale";
export const fluxVideoUpscaleMaximumDurationSeconds = 20;
export const fluxVideoUpscaleMaximumBytes = 50 * 1024 * 1024;
export const fluxVideoUpscaleFactorMinimum = 1.5;
export const fluxVideoUpscaleFactorMaximum = 3;
export const fluxVideoUpscaleFactorDefault = 2;
export const fluxVideoUpscaleCreativityOptions = [
  [0, "Precise"],
  [1, "Creative"]
];
export const fluxVideoUpscaleSafetyToleranceOptions = [0, 1, 2, 3, 4];

export const fluxVideoUpscaleCostPerSecond = Object.freeze({
  precise: Object.freeze({
    "1080p": 0.14,
    "2k": 0.25,
    "4k": 0.55
  }),
  creative: Object.freeze({
    "1080p": 0.2,
    "2k": 0.35,
    "4k": 0.79
  })
});

export function normalizeFluxVideoUpscaleFactor(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fluxVideoUpscaleFactorDefault;
  return Math.min(fluxVideoUpscaleFactorMaximum, Math.max(fluxVideoUpscaleFactorMinimum, number));
}

export function normalizeFluxVideoUpscaleCreativity(value) {
  return Number(value) === 0 ? 0 : 1;
}

export function normalizeFluxVideoUpscaleSafetyTolerance(value) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number)) return 2;
  return Math.min(4, Math.max(0, number));
}

export function fluxVideoUpscaleBillingTier({ width, height } = {}) {
  const outputWidth = Number(width || 0);
  const outputHeight = Number(height || 0);
  if (!Number.isFinite(outputWidth) || !Number.isFinite(outputHeight) || outputWidth <= 0 || outputHeight <= 0) return "";

  const longSide = Math.max(outputWidth, outputHeight);
  const shortSide = Math.min(outputWidth, outputHeight);
  if (longSide <= 1920 && shortSide <= 1080) return "1080p";
  if (longSide <= 2560 && shortSide <= 1440) return "2k";
  return "4k";
}

export function estimateFluxVideoUpscaleCost({
  endpoint = fluxVideoUpscaleEndpoint,
  durationSeconds,
  sourceWidth,
  sourceHeight,
  outputWidth,
  outputHeight,
  upscaleFactor = fluxVideoUpscaleFactorDefault,
  creativity = 1,
  rates = fluxVideoUpscaleCostPerSecond
} = {}) {
  const seconds = Number(durationSeconds || 0);
  const factor = normalizeFluxVideoUpscaleFactor(upscaleFactor);
  const resolvedWidth = Number(outputWidth || 0) || Number(sourceWidth || 0) * factor;
  const resolvedHeight = Number(outputHeight || 0) || Number(sourceHeight || 0) * factor;
  const billingResolutionTier = fluxVideoUpscaleBillingTier({ width: resolvedWidth, height: resolvedHeight });
  const mode = normalizeFluxVideoUpscaleCreativity(creativity) === 0 ? "precise" : "creative";
  const unitRateUsd = billingResolutionTier ? Number(rates?.[mode]?.[billingResolutionTier]) : null;
  const hasDuration = Number.isFinite(seconds) && seconds > 0;
  const hasRate = Number.isFinite(unitRateUsd) && unitRateUsd >= 0;

  return {
    amountUsd: hasDuration && hasRate ? Math.round(seconds * unitRateUsd * 1000000) / 1000000 : null,
    currency: "USD",
    unitRateUsd: hasRate ? unitRateUsd : null,
    units: hasDuration ? seconds : null,
    unit: "video second",
    mediaType: "video",
    durationSeconds: hasDuration ? seconds : null,
    billingResolutionTier,
    mode,
    creativity: mode === "creative" ? 1 : 0,
    upscaleFactor: factor,
    sourceWidth: Number(sourceWidth || 0) || null,
    sourceHeight: Number(sourceHeight || 0) || null,
    outputWidth: resolvedWidth > 0 ? Math.round(resolvedWidth) : null,
    outputHeight: resolvedHeight > 0 ? Math.round(resolvedHeight) : null,
    pricingBasis: hasDuration && hasRate
      ? `Flux Video Upscale fal.ai per-second estimate for ${billingResolutionTier} ${mode} output`
      : "Flux Video Upscale fal.ai estimate; output duration or resolution unavailable",
    pricingSource: "fal-model-page-2026-08-20",
    endpoint
  };
}
