export const defaultUserPreferences = Object.freeze({
  showPresetPanel: true
});

export function normalizeUserPreferences(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    showPresetPanel: typeof source.showPresetPanel === "boolean"
      ? source.showPresetPanel
      : defaultUserPreferences.showPresetPanel
  };
}
