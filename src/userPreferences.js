export const defaultUserPreferences = Object.freeze({
  showPresetPanel: true,
  showPriceSnapshot: true,
  directorProcessingModel: "astra"
});

export const directorProcessingModelOptions = Object.freeze([
  Object.freeze({ value: "astra", label: "GPT-6 Astra" }),
  Object.freeze({ value: "sol", label: "GPT-5.6 Sol" })
]);

export function normalizeUserPreferences(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    showPresetPanel: typeof source.showPresetPanel === "boolean"
      ? source.showPresetPanel
      : defaultUserPreferences.showPresetPanel,
    showPriceSnapshot: typeof source.showPriceSnapshot === "boolean"
      ? source.showPriceSnapshot
      : defaultUserPreferences.showPriceSnapshot,
    directorProcessingModel: normalizeDirectorProcessingModel(source.directorProcessingModel)
  };
}

export function normalizeDirectorProcessingModel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return directorProcessingModelOptions.some((option) => option.value === normalized)
    ? normalized
    : defaultUserPreferences.directorProcessingModel;
}

export function directorProcessingModelIds(value) {
  const preference = normalizeDirectorProcessingModel(value);
  const openAiModel = preference === "sol" ? "gpt-5.6-sol" : "gpt-6-astra";
  return {
    preference,
    openAiModel,
    falModel: `openai/${openAiModel}`
  };
}
