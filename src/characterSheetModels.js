import { imageModelNames } from "./modelOptions.js";
import { openAiImage2Quality } from "./openAiImage2.js";

export const characterSheetModelOptions = [
  imageModelNames.nanoBanana2,
  imageModelNames.nanoBananaPro,
  imageModelNames.openAiImage2
];

export function normalizeCharacterSheetModel(value) {
  return characterSheetModelOptions.includes(value) ? value : imageModelNames.nanoBanana2;
}

export function characterSheetGenerationSettings(value) {
  const model = normalizeCharacterSheetModel(value);
  return {
    model,
    resolution: "4K",
    ...(model === imageModelNames.openAiImage2 ? { quality: openAiImage2Quality } : {})
  };
}

export function mergeGeneratedCharacterSheetVariants(existingVariants = [], generatedVariants = [], wardrobeIds = []) {
  const existingByWardrobe = new Map(existingVariants.filter((variant) => variant?.wardrobeId).map((variant) => [variant.wardrobeId, variant]));
  const generatedByWardrobe = new Map(generatedVariants.filter((variant) => variant?.wardrobeId).map((variant) => [variant.wardrobeId, variant]));
  return [...new Set(wardrobeIds)]
    .map((wardrobeId) => generatedByWardrobe.get(wardrobeId) || existingByWardrobe.get(wardrobeId))
    .filter(Boolean);
}
