export const openAiImage26Models = Object.freeze({
  flare: "OpenAI Image 2.6 Flare",
  sunburst: "OpenAI Image 2.6 Sunburst"
});

export function isOpenAiImage26Model(value) {
  return /^(?:openai image 2\.[56]|gpt image 2\.[56]|gpt-image-2\.[56])(?:[ /-](?:flare|sunburst))?$/i.test(String(value || "").trim());
}

export function openAiImage26Variant(model, legacyVariant = "flare") {
  if (/sunburst/i.test(String(model))) return "sunburst";
  if (/flare/i.test(String(model))) return "flare";
  return legacyVariant === "sunburst" ? "sunburst" : "flare";
}

export function normalizeOpenAiImage26Model(model, legacyVariant = "flare") {
  return isOpenAiImage26Model(model) ? openAiImage26Models[openAiImage26Variant(model, legacyVariant)] : model;
}

// Migrate only model selections; never rewrite past results or cost records.
export function migrateImageModelSelections(data = {}) {
  const next = { ...data };
  for (const field of ["model", "characterSheetModel", "frameItImageModel", "storyboardImageModel", "autoAspectModel", "favoriteImageModel"]) {
    if (typeof next[field] === "string") next[field] = normalizeOpenAiImage26Model(next[field], data.openAiImageVariant);
  }
  if (isOpenAiImage26Model(next.model)) next.openAiImageVariant = openAiImage26Variant(next.model);
  if (Array.isArray(next.exploreQueue)) next.exploreQueue = next.exploreQueue.map(item => ({ ...item, settings: migrateImageModelSelections(item.settings) }));
  return next;
}
