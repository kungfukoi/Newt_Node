export const openAiImage25Models = Object.freeze({
  flare: "OpenAI Image 2.5 Flare",
  sunburst: "OpenAI Image 2.5 Sunburst"
});

export function isOpenAiImage25Model(value) {
  return /^(?:openai image 2\.5|gpt image 2\.5|gpt-image-2\.5)(?:[ /-](?:flare|sunburst))?$/i.test(String(value || "").trim());
}

export function openAiImage25Variant(model, legacyVariant = "flare") {
  if (/sunburst/i.test(String(model))) return "sunburst";
  if (/flare/i.test(String(model))) return "flare";
  return legacyVariant === "sunburst" ? "sunburst" : "flare";
}

export function normalizeOpenAiImage25Model(model, legacyVariant = "flare") {
  return isOpenAiImage25Model(model) ? openAiImage25Models[openAiImage25Variant(model, legacyVariant)] : model;
}

// Migrate only model selections; never rewrite past results or cost records.
export function migrateImageModelSelections(data = {}) {
  const next = { ...data };
  for (const field of ["model", "characterSheetModel", "frameItImageModel", "storyboardImageModel"]) {
    if (typeof next[field] === "string") next[field] = normalizeOpenAiImage25Model(next[field], data.openAiImageVariant);
  }
  if (isOpenAiImage25Model(next.model)) next.openAiImageVariant = openAiImage25Variant(next.model);
  if (Array.isArray(next.exploreQueue)) next.exploreQueue = next.exploreQueue.map(item => ({ ...item, settings: migrateImageModelSelections(item.settings) }));
  return next;
}
