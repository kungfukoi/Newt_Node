export const sam31ImageEndpoint = "fal-ai/sam-3-1/image";
export const sam31VideoEndpoint = "fal-ai/sam-3-1/video";
export const sam31ImageCostPerRequest = 0.01;
export const sam31VideoCostPer16Frames = 0.01;

export function estimateSam31ImageCost() {
  return {
    amountUsd: sam31ImageCostPerRequest, currency: "USD", estimated: true,
    unitRateUsd: sam31ImageCostPerRequest, units: 1, unit: "request", mediaType: "image",
    pricingBasis: "Fal SAM 3.1 image list rate per request",
    pricingSource: "https://fal.ai/models/fal-ai/sam-3-1/image",
    endpoint: sam31ImageEndpoint
  };
}

export function estimateSam31VideoCost(inputFrames) {
  const frames = Number.isSafeInteger(inputFrames) && inputFrames > 0 ? inputFrames : null;
  const units = frames ? Math.ceil(frames / 16) : null;
  return {
    amountUsd: units === null ? null : Number((units * sam31VideoCostPer16Frames).toFixed(2)), currency: "USD", estimated: true,
    unitRateUsd: sam31VideoCostPer16Frames, units, unit: "16 input frames", mediaType: "video",
    pricingBasis: frames ? "Fal SAM 3.1 video list rate per 16 input frames" : "SAM 3.1 input frame count unavailable",
    pricingSource: "https://fal.ai/models/fal-ai/sam-3-1/video",
    endpoint: sam31VideoEndpoint, frames
  };
}
