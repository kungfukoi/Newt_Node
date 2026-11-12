export const settingsGroups = [
  { label: "General", sections: [["overview", "Status"], ["userPreferences", "User Preferences"]] },
  { label: "Providers & Models", sections: [
    ["credentials", "API Credentials"],
    ["providers", "Model Providers"],
    ["models", "Enabled Models"]
  ] },
  { label: "Usage & Costs", sections: [["usage", "Feature Usage"], ["pricing", "API Pricing"]] },
  { label: "System", sections: [["comfy", "Comfy Engine"], ["repository", "Repository"], ["diagnostics", "Diagnostics"]] }
];

export const settingsSectionStorageKey = "newtnode.settings.active-section.v1";

function normalizeSettingsSection(value) {
  return settingsGroups.some(({ sections }) => sections.some(([id]) => id === value)) ? value : "overview";
}

export function readSettingsSection(storage = globalThis.localStorage) {
  try {
    return normalizeSettingsSection(storage?.getItem(settingsSectionStorageKey));
  } catch {
    return "overview";
  }
}

export function writeSettingsSection(section, storage = globalThis.localStorage) {
  const selected = normalizeSettingsSection(section);
  try {
    storage?.setItem(settingsSectionStorageKey, selected);
  } catch {
    // Settings navigation still works when storage is unavailable.
  }
  return selected;
}
