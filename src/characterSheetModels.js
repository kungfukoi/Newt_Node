import { imageModelNames, normalizeGptImage25Model, isGptImage25Model } from "./modelOptions.js";
import { openAiImage2Quality } from "./openAiImage2.js";

export const characterSheetModelOptions = [
  imageModelNames.nanoBanana2,
  imageModelNames.nanoBananaPro,
  imageModelNames.openAiImage2,
  imageModelNames.openAiImage25Sunburst,
  imageModelNames.ideogram45
];

export function normalizeCharacterSheetModel(value) {
  const model = normalizeGptImage25Model(value);
  return characterSheetModelOptions.includes(model) ? model : imageModelNames.nanoBanana2;
}

export function characterSheetGenerationSettings(value) {
  const model = normalizeCharacterSheetModel(value);
  return {
    model,
    resolution: model === imageModelNames.ideogram45 ? "2K" : "4K",
    ...(isGptImage25Model(model) ? { quality: openAiImage2Quality } : {})
  };
}

export function mergeGeneratedCharacterSheetVariants(existingVariants = [], generatedVariants = [], wardrobeIds = []) {
  const existingByWardrobe = new Map(existingVariants.filter((variant) => variant?.wardrobeId).map((variant) => [variant.wardrobeId, variant]));
  const generatedByWardrobe = new Map(generatedVariants.filter((variant) => variant?.wardrobeId).map((variant) => [variant.wardrobeId, variant]));
  return [...new Set(wardrobeIds)]
    .map((wardrobeId) => generatedByWardrobe.get(wardrobeId) || existingByWardrobe.get(wardrobeId))
    .filter(Boolean);
}
