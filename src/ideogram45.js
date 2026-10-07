export const ideogram45ModelName = "Ideogram 4.5";
export const ideogram45TextEndpoint = "ideogram/v4.5";
export const ideogram45EditEndpoint = "ideogram/v4.5/edit";
export const ideogram45QualityOptions = ["low", "medium", "high"];
export const ideogram45EditQualityOptions = ["very_low", ...ideogram45QualityOptions];
export const ideogram45EditPrecisionOptions = ["regular", "high"];
export const ideogram45SizeOptions = ["1024x1024", "1024x3072", "1120x896", "1152x2944", "1152x864", "1248x3328", "1248x832", "1280x3072", "1280x720", "1280x800", "1296x3168", "1440x2560", "1440x2880", "1440x720", "1600x2560", "1664x2496", "1728x2304", "1792x2240", "2048x2048", "2240x1792", "2304x1728", "2496x1664", "2560x1440", "2560x1600", "2880x1440", "2944x1152", "3072x1024", "3072x1280", "3168x1296", "3328x1248", "720x1280", "720x1440", "800x1280", "832x1248", "864x1152", "896x1120"];
export const ideogram45ResolutionOptions = ["1K", "2K"];
const sizes = {
  "1:1": [[1024, 1024], [2048, 2048]],
  "16:9": [[1280, 720], [2560, 1440]],
  "9:16": [[720, 1280], [1440, 2560]],
  "4:3": [[1152, 864], [2304, 1728]],
  "3:4": [[864, 1152], [1728, 2304]],
  "3:2": [[1248, 832], [2496, 1664]],
  "2:3": [[832, 1248], [1664, 2496]],
  "5:4": [[1120, 896], [2240, 1792]],
  "4:5": [[896, 1120], [1792, 2240]]
};
export const ideogram45AspectRatios = Object.keys(sizes);
export const isIdeogram45Model = (model) => String(model || "").trim().toLowerCase() === ideogram45ModelName.toLowerCase();

export function ideogram45ImageSize(aspectRatio = "16:9", resolution = "1K") {
  const [width, height] = (sizes[aspectRatio] || sizes["16:9"])[resolution === "2K" ? 1 : 0];
  return { width, height };
}

function editImageSize(aspectRatio = "16:9", resolution = "1K") {
  if (sizes[aspectRatio]) return ideogram45ImageSize(aspectRatio, resolution);
  const match = String(aspectRatio).match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  const ratio = match ? Number(match[1]) / Number(match[2]) : 0;
  if (!Number.isFinite(ratio) || ratio < 1 / 6 || ratio > 6) throw new Error("Ideogram 4.5 edits support aspect ratios between 1:6 and 6:1.");
  const area = resolution === "2K" ? 4000000 : 1000000;
  return { width: Math.max(256, Math.floor(Math.sqrt(area * ratio) / 32) * 32),
    height: Math.max(256, Math.floor(Math.sqrt(area / ratio) / 32) * 32) };
}

export function buildIdeogram45Request({ prompt, imageUrls = [], imageLabels = [], aspectRatio, resolution, quality = "high", maskUrl = "", editPrecision = "regular", preserveSourceSize = false, enablePromptExpansion = false, seed = "", imageSize = "" } = {}) {
  if (!String(prompt || "").trim()) throw new Error("Prompt is required.");
  if (!(imageUrls.some(Boolean) ? ideogram45EditQualityOptions : ideogram45QualityOptions).includes(quality)) throw new Error("Choose a supported quality for Ideogram 4.5.");
  if (typeof enablePromptExpansion !== "boolean" || typeof preserveSourceSize !== "boolean") throw new Error("Invalid Ideogram 4.5 option.");
  if (seed !== "" && seed != null && !Number.isSafeInteger(Number(seed))) throw new Error("Ideogram seed must be an integer or blank.");
  if (imageSize && !ideogram45SizeOptions.includes(imageSize)) throw new Error("Choose a supported Ideogram image size.");
  if (!["regular", "high"].includes(editPrecision)) throw new Error("Invalid Ideogram edit precision.");
  const references = imageUrls.filter(Boolean);
  if (references.length > (maskUrl ? 4 : 5)) throw new Error(`Ideogram 4.5 accepts at most ${maskUrl ? 4 : 5} images${maskUrl ? " with a mask" : ""}.`);
  if (maskUrl && !references.length) throw new Error("An edit mask requires a source image.");
  const edit = references.length > 0;
  const labels = references.map((_, i) => String(imageLabels[i] || `Image ${i + 1}`).replace(/[\r\n]+/g, " ").slice(0, 100));
  const submittedPrompt = imageLabels.some(Boolean) && edit
    ? `${labels.map((label, i) => `Image ${i + 1}${i === 0 ? " (source)" : " (reference)"}: ${label}`).join("\n")}\n\n${prompt}`
    : String(prompt).trim();
  const input = { prompt: submittedPrompt, quality, num_images: 1,
    image_size: edit && (preserveSourceSize || maskUrl || editPrecision === "high") ? "auto"
      : edit ? editImageSize(aspectRatio, resolution) : ideogram45ImageSize(aspectRatio, resolution) };
  if (edit) {
    input.image_url = references[0];
    if (references.length > 1) input.reference_image_urls = references.slice(1);
    input.edit_precision = editPrecision;
    if (maskUrl) input.mask_url = maskUrl;
  } else input.enable_prompt_expansion = enablePromptExpansion;
  if (imageSize && input.image_size !== "auto") {
    const [width, height] = imageSize.split("x").map(Number);
    if (edit && (width % 32 || height % 32 || width * height > 4194304)) throw new Error("Ideogram edit dimensions must be multiples of 32 and at most 4 megapixels. Choose another exact size.");
    input.image_size = { width, height };
  }
  if (seed !== "" && seed != null) input.seed = Number(seed);
  return { endpoint: edit ? ideogram45EditEndpoint : ideogram45TextEndpoint, input, submittedPrompt,
    mode: edit ? "edit" : "generate", referenceCount: references.length, referenceLabels: labels };
}

export function ideogram45UnpricedCost({ endpoint, quality = "high" } = {}) {
  return { amountUsd: null, currency: "USD", units: 1, unit: "image", mediaType: "image", endpoint, quality,
    pricingBasis: "Ideogram 4.5 pricing has not been verified; consult Fal billing.", pricingSource: "unpriced" };
}
