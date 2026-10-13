export const nanoBanana21ModelName = "Nano Banana 2.1";
export const nanoBanana21TextEndpoint = "google/nano-banana-2.1";
export const nanoBanana21EditEndpoint = "google/nano-banana-2.1/edit";
export const nanoBanana21ResolutionOptions = ["2K", "1K", "4K"];
export const nanoBanana21AspectRatios = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"];
export const isNanoBanana21Model = model => String(model || "").trim().toLowerCase() === "nano banana 2.1";

export function buildNanoBanana21Request({ prompt, imageUrls = [], imageLabels = [], aspectRatio = "16:9", resolution = "2K" } = {}) {
  const brief = String(prompt || "").trim();
  if (brief.length < 3 || brief.length > 50000) throw new Error("Nano Banana 2.1 needs a prompt between 3 and 50,000 characters.");
  if (!Array.isArray(imageUrls) || imageUrls.some(url => typeof url !== "string" || !url.trim())) throw new Error("Nano Banana 2.1 requires valid image references.");
  const ratio = String(aspectRatio).toLowerCase();
  const size = String(resolution).toUpperCase();
  if (ratio !== "auto" && !nanoBanana21AspectRatios.includes(ratio)) throw new Error("Choose a supported Nano Banana 2.1 aspect ratio.");
  if (!nanoBanana21ResolutionOptions.includes(size)) throw new Error("Choose 1K, 2K, or 4K for Nano Banana 2.1.");
  const referenceLabels = imageUrls.map((_, i) => String(imageLabels[i] || `Image ${i + 1}`).replace(/[\r\n]+/g, " ").slice(0, 100));
  const submittedPrompt = imageLabels.some(Boolean) ? referenceLabels.map((label, i) => `Image ${i + 1}: ${label}`).join("\n") + "\n\n" + brief : brief;
  if (submittedPrompt.length > 50000) throw new Error("Nano Banana 2.1 prompt and reference labels exceed 50,000 characters.");
  return { endpoint: imageUrls.length ? nanoBanana21EditEndpoint : nanoBanana21TextEndpoint,
    input: { prompt: submittedPrompt, aspect_ratio: ratio, resolution: size, num_images: 1,
      output_format: "png", limit_generations: true, thinking_level: "high", enable_web_search: false, sync_mode: false,
      ...(imageUrls.length ? { image_urls: imageUrls } : {}) },
    submittedPrompt, mode: imageUrls.length ? "edit" : "generate", referenceCount: imageUrls.length, referenceLabels };
}

export function estimateNanoBanana21Cost({ resolution = "2K", endpoint = nanoBanana21TextEndpoint } = {}) {
  const amountUsd = { "1K": 0.082, "2K": 0.122, "4K": 0.162 }[String(resolution).toUpperCase()] ?? null;
  return { amountUsd, currency: "USD", estimated: true, pricingStatus: amountUsd === null ? "unpriced" : "estimated",
    units: 1, unit: "image", mediaType: "image", endpoint,
    pricingSource: "https://fal.ai/models/google/nano-banana-2.1", pricingCheckedAt: "2026-10-06",
    pricingBasis: "Fal published resolution rate plus $0.002 high thinking; web search disabled. Account charges may differ." };
}

export const nanoBanana21KreaEndpoint = "/generate/image/google/nano-banana-2.1";
export const nanoBanana21KreaPrices = Object.freeze({ "1K": 0.03, "2K": 0.0505, "4K": 0.0755 });
export function nanoBanana21Ratios(provider = "fal") {
  return provider === "krea" ? nanoBanana21AspectRatios.filter(ratio => ratio !== "8:1") : nanoBanana21AspectRatios;
}
export function buildNanoBanana21KreaInput({ prompt, images = [], aspectRatio = "16:9", resolution = "2K", background = "auto", maskUrl } = {}) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!nanoBanana21Ratios("krea").includes(aspectRatio)) fail("Choose a supported Nano Banana 2.1 aspect ratio for Krea.");
  if (!Array.isArray(images) || images.length > 14 || images.some(url => typeof url !== "string" || !url.trim())) fail("Nano Banana 2.1 through Krea accepts up to 14 valid image references.");
  if (maskUrl || !["auto", "opaque"].includes(background)) fail("Nano Banana 2.1 does not support pixel masks or transparent backgrounds through Krea.");
  const request = buildNanoBanana21Request({ prompt, imageUrls: images, aspectRatio, resolution });
  return { prompt: request.submittedPrompt, aspect_ratio: aspectRatio, resolution: request.input.resolution, thinking_level: "high", ...(images.length ? { image_urls: images } : {}) };
}
