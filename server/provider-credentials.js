export function selectProviderCredential({ settingsValue, envValue, runtimeValue, useSettingsOverride = false } = {}) {
  if (useSettingsOverride) {
    return {
      value: normalizedCredential(settingsValue),
      source: normalizedCredential(settingsValue) ? "settings" : ""
    };
  }

  const envCredential = normalizedCredential(envValue);
  if (envCredential) return { value: envCredential, source: "env" };
  const runtimeCredential = normalizedCredential(runtimeValue);
  return {
    value: runtimeCredential,
    source: runtimeCredential ? "runtime" : ""
  };
}

function normalizedCredential(value) {
  return String(value || "").trim();
}
