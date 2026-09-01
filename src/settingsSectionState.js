export const settingsSectionStorageKey = "newtnode.settings.open-sections.v1";

export const defaultSettingsOpenSections = Object.freeze({
  credentials: true,
  providers: true,
  models: false,
  repository: false,
  restart: false,
  status: true,
  comfy: false
});

export function normalizeSettingsOpenSections(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(defaultSettingsOpenSections).map(([section, defaultOpen]) => [
      section,
      typeof source[section] === "boolean" ? source[section] : defaultOpen
    ])
  );
}

export function readSettingsOpenSections(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem?.(settingsSectionStorageKey);
    return normalizeSettingsOpenSections(saved ? JSON.parse(saved) : null);
  } catch {
    return normalizeSettingsOpenSections();
  }
}

export function writeSettingsOpenSections(openSections, storage = globalThis.localStorage) {
  const normalized = normalizeSettingsOpenSections(openSections);
  try {
    storage?.setItem?.(settingsSectionStorageKey, JSON.stringify(normalized));
  } catch {
    // Settings remain usable when storage is unavailable.
  }
  return normalized;
}
