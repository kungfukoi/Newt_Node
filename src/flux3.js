export const flux3ModelName = "Flux 3";
export const flux3TextEndpoint = "blackforestlabs/flux-3/text-to-image";
export const flux3EditEndpoint = "blackforestlabs/flux-3/edit-image";
export const flux3AspectRatios = ["21:9", "2:1", "16:9", "3:2", "7:5", "4:3", "5:4", "1:1", "4:5", "3:4", "5:7", "2:3", "9:16", "1:2"];
export const flux3ResolutionOptions = ["1K", "2K", "4K", "512SQ", "768SQ"];
export const flux3OutputFormatOptions = ["png", "jpeg"];
export const isFlux3Model = model => String(model || "").trim().toLowerCase() === "flux 3";

export function buildFlux3Request({ prompt, imageUrls = [], imageLabels = [], aspectRatio = "16:9", resolution = "2K", outputFormat = "png", enablePromptExpansion = false, safetyTolerance = 2, version = "latest" } = {}) {
  if (!String(prompt || "").trim()) throw new Error("Prompt is required.");
  if (imageUrls.length > 10 || imageUrls.some(url => typeof url !== "string" || !url)) throw new Error("Flux 3 accepts up to 10 reference images.");
  const ratio = String(aspectRatio).toLowerCase();
  if (ratio !== "auto" && !flux3AspectRatios.includes(ratio)) throw new Error("Choose a supported Flux 3 aspect ratio.");
  if (!flux3ResolutionOptions.includes(String(resolution).toUpperCase())) throw new Error("Choose 512SQ, 768SQ, 1K, 2K, or 4K for Flux 3.");
  if (!flux3OutputFormatOptions.includes(outputFormat)) throw new Error("Choose PNG or JPEG for Flux 3.");
  if (typeof enablePromptExpansion !== "boolean") throw new Error("Invalid Flux 3 prompt expansion setting.");
  if (!Number.isInteger(safetyTolerance) || safetyTolerance < 0 || safetyTolerance > 4) throw new Error("Flux 3 safety tolerance must be an integer from 0 to 4.");
  if (typeof version !== "string" || !version.trim()) throw new Error("Enter a Flux 3 model version.");
  const labels = imageUrls.map((_, i) => String(imageLabels[i] || "Image " + (i + 1)).replace(/[\r\n]+/g, " ").slice(0, 100));
  const submittedPrompt = imageLabels.some(Boolean) ? labels.map((label, i) => "Image " + (i + 1) + ": " + label).join("\n") + "\n\n" + prompt : String(prompt).trim();
  const input = { prompt: submittedPrompt, aspect_ratio: ratio, resolution: String(resolution).toLowerCase(), output_format: outputFormat,
    enable_prompt_expansion: enablePromptExpansion, safety_tolerance: safetyTolerance, version: version.trim(), sync_mode: false };
  if (imageUrls.length) input.image_urls = imageUrls;
  return { endpoint: imageUrls.length ? flux3EditEndpoint : flux3TextEndpoint, input, submittedPrompt,
    mode: imageUrls.length ? "edit" : "generate", referenceCount: imageUrls.length, referenceLabels: labels };
}

export function estimateFlux3Cost({ resolution = "2K", endpoint = flux3TextEndpoint } = {}) {
  // BFL standard model rates checked 2026-10-06. Deliberately exclude the short
  // launch promotion; a matched Fal billing event supersedes this estimate.
  const amountUsd = { "1K": 0.048, "2K": 0.1, "4K": 0.607 }[String(resolution).toUpperCase()] ?? null;
  return { amountUsd, currency: "USD", estimated: amountUsd !== null, pricingStatus: amountUsd === null ? "unpriced" : "estimated", units: 1, unit: "image", mediaType: "image", endpoint,
    pricingSource: "https://docs.bfl.ai/quick_start/pricing", pricingCheckedAt: "2026-10-06",
    pricingBasis: "BFL published standard model-rate estimate before temporary promotions. Fal account charges may differ." };
}
