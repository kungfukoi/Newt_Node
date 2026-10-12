import { storyboardImageDefaultModel, storyboardImageModelOptions, imageModelNames, seedream5ResolutionOptions } from "./modelOptions.js";

export function normalizeStoryboardImageModel(value) {
  return storyboardImageModelOptions.includes(value) ? value : storyboardImageDefaultModel;
}

export function storyboardImageSettings(data = {}) {
  const model = normalizeStoryboardImageModel(data.model);
  const settings = { model, resolution: data.resolution || "1K", aspectRatio: data.aspectRatio || "16:9", quality: "high", background: "auto" };
  if (model === imageModelNames.seedream5Pro && !seedream5ResolutionOptions.includes(settings.resolution)) settings.resolution = "2K";
  return settings;
}

export function storyboardCharacterImageSettings(data = {}) {
  return storyboardImageSettings({ ...data, resolution: "4K", aspectRatio: "16:9" });
}
