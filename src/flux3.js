export const flux3ModelName = "Flux 3";
export const flux3TextEndpoint = "blackforestlabs/flux-3/text-to-image";
export const flux3EditEndpoint = "blackforestlabs/flux-3/edit-image";
export const flux3AspectRatios = ["21:9", "2:1", "16:9", "3:2", "7:5", "4:3", "5:4", "1:1", "4:5", "3:4", "5:7", "2:3", "9:16", "1:2"];
export const flux3ResolutionOptions = ["1K", "2K", "4K"];
export const isFlux3Model = model => String(model || "").trim().toLowerCase() === "flux 3";

export function buildFlux3Request({ prompt, imageUrls = [], imageLabels = [], aspectRatio = "16:9", resolution = "2K" } = {}) {
  if (!String(prompt || "").trim()) throw new Error("Prompt is required.");
  if (imageUrls.length > 10 || imageUrls.some(url => typeof url !== "string" || !url)) throw new Error("Flux 3 accepts up to 10 reference images.");
  const ratio = String(aspectRatio).toLowerCase();
  if (ratio !== "auto" && !flux3AspectRatios.includes(ratio)) throw new Error("Choose a supported Flux 3 aspect ratio.");
  if (!flux3ResolutionOptions.includes(String(resolution).toUpperCase())) throw new Error("Choose 1K, 2K, or 4K for Flux 3.");
  const labels = imageUrls.map((_, i) => String(imageLabels[i] || "Image " + (i + 1)).replace(/[\r\n]+/g, " ").slice(0, 100));
  const submittedPrompt = imageLabels.some(Boolean) ? labels.map((label, i) => "Image " + (i + 1) + ": " + label).join("\n") + "\n\n" + prompt : String(prompt).trim();
  const input = { prompt: submittedPrompt, aspect_ratio: ratio, resolution: String(resolution).toLowerCase(), output_format: "png",
    enable_prompt_expansion: false, safety_tolerance: 2, sync_mode: false };
  if (imageUrls.length) input.image_urls = imageUrls;
  return { endpoint: imageUrls.length ? flux3EditEndpoint : flux3TextEndpoint, input, submittedPrompt,
    mode: imageUrls.length ? "edit" : "generate", referenceCount: imageUrls.length, referenceLabels: labels };
}

export function estimateFlux3Cost({ resolution = "2K", endpoint = flux3TextEndpoint } = {}) {
  // BFL standard model rates checked 2026-10-06. Deliberately exclude the short
  // launch promotion; a matched Fal billing event supersedes this estimate.
  const amountUsd = { "1K": 0.048, "2K": 0.1, "4K": 0.607 }[String(resolution).toUpperCase()] ?? null;
  return { amountUsd, currency: "USD", estimated: true, pricingStatus: "estimated", units: 1, unit: "image", mediaType: "image", endpoint,
    pricingSource: "https://docs.bfl.ai/quick_start/pricing", pricingCheckedAt: "2026-10-06",
    pricingBasis: "BFL published standard model-rate estimate before temporary promotions. Fal account charges may differ." };
}
