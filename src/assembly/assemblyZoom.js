export const defaultAssemblyZoom = 72;
export const minimumAssemblyZoom = 1 / 32;
export const maximumAssemblyZoom = 8192;
export const assemblyZoomFactor = 1.25;

export function normalizeAssemblyZoom(value, fallback = defaultAssemblyZoom) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : fallback;
  return Math.min(maximumAssemblyZoom, Math.max(minimumAssemblyZoom, safe));
}

export function stepAssemblyZoom(value, direction) {
  const current = normalizeAssemblyZoom(value);
  const next = direction < 0 ? current / assemblyZoomFactor : current * assemblyZoomFactor;
  return Number(normalizeAssemblyZoom(next).toPrecision(10));
}

export function assemblyZoomLabel(value) {
  const zoom = normalizeAssemblyZoom(value);
  if (zoom >= 10) return `${Math.round(zoom)} px/s`;
  if (zoom >= 1) return `${zoom.toFixed(1)} px/s`;
  return `${zoom.toFixed(2)} px/s`;
}

export function assemblyRulerSpacing(duration, pixelsPerSecond, frameRate = 24) {
  const safeDuration = Math.max(0, Number(duration) || 0);
  const zoom = normalizeAssemblyZoom(pixelsPerSecond);
  const frameDuration = 1 / Math.max(1, Number(frameRate) || 24);
  const targetMajorStep = Math.max(72 / zoom, safeDuration / 2000, frameDuration);
  const majorStep = Math.max(frameDuration, niceStep(targetMajorStep));
  return {
    majorStep,
    minorStep: Math.max(frameDuration, majorStep / 5)
  };
}

function niceStep(value) {
  const exponent = Math.floor(Math.log10(Math.max(Number.EPSILON, value)));
  const magnitude = 10 ** exponent;
  const fraction = value / magnitude;
  const multiplier = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return multiplier * magnitude;
}
