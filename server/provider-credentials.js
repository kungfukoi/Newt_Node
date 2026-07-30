export const providerCredentialNames = Object.freeze(["fal", "google", "krea", "openAi"]);

const providerLabels = Object.freeze({
  fal: "Fal",
  google: "Google",
  krea: "Krea",
  openAi: "OpenAI"
});

export function normalizeProviderCredentialStore(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  return Object.fromEntries(providerCredentialNames.map((provider) => [
    provider,
    normalizeProviderCredentialList(provider, incoming[provider])
  ]));
}

export function normalizeActiveCredentialIds(value = {}, credentials = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  const normalizedCredentials = normalizeProviderCredentialStore(credentials);
  return Object.fromEntries(providerCredentialNames.map((provider) => {
    const requestedId = normalizedCredentialId(incoming[provider]);
    const exists = normalizedCredentials[provider].some((credential) => credential.id === requestedId && credential.key);
    return [provider, exists ? requestedId : ""];
  }));
}

export function activeProviderCredentials(credentials = {}, activeCredentialIds = {}) {
  const normalizedCredentials = normalizeProviderCredentialStore(credentials);
  const normalizedIds = normalizeActiveCredentialIds(activeCredentialIds, normalizedCredentials);
  return Object.fromEntries(providerCredentialNames.map((provider) => {
    const credential = normalizedCredentials[provider].find((item) => item.id === normalizedIds[provider]);
    return [provider, credential || null];
  }));
}

export function providerCredentialSummaries(credentials = {}, activeCredentialIds = {}) {
  const normalizedCredentials = normalizeProviderCredentialStore(credentials);
  const normalizedIds = normalizeActiveCredentialIds(activeCredentialIds, normalizedCredentials);
  return Object.fromEntries(providerCredentialNames.map((provider) => [
    provider,
    normalizedCredentials[provider].map(({ id, label, key }) => ({
      id,
      label,
      configured: Boolean(key),
      active: normalizedIds[provider] === id
    }))
  ]));
}

export function legacyProviderCredentialStore({ settings = {}, env = {}, runtime = {} } = {}) {
  const credentials = {};
  const activeCredentialIds = {};
  const sourcePreferences = settings?.providerPreferences && typeof settings.providerPreferences === "object"
    ? settings.providerPreferences
    : {};

  for (const provider of providerCredentialNames) {
    const envKey = providerEnvironmentKey(provider);
    const settingsKey = providerLegacySettingsKey(provider);
    const entries = [];
    addLegacyCredential(entries, provider, settings[settingsKey], "Saved key");
    addLegacyCredential(entries, provider, env[envKey], "Imported key");
    addLegacyCredential(entries, provider, runtime[envKey], "Imported key");
    credentials[provider] = entries;

    const preferSettings = Boolean(sourcePreferences[provider]);
    const selectedValue = preferSettings
      ? normalizedCredential(settings[settingsKey])
      : normalizedCredential(env[envKey]) || normalizedCredential(runtime[envKey]);
    activeCredentialIds[provider] = entries.find((entry) => entry.key === selectedValue)?.id || "";
  }

  return {
    credentials: normalizeProviderCredentialStore(credentials),
    activeCredentialIds: normalizeActiveCredentialIds(activeCredentialIds, credentials)
  };
}

export function providerEnvironmentKey(provider) {
  if (provider === "fal") return "FAL_KEY";
  if (provider === "google") return "GOOGLE_API_KEY";
  if (provider === "krea") return "KREA_API_KEY";
  if (provider === "openAi") return "OPENAI_API_KEY";
  return "";
}

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

function normalizeProviderCredentialList(provider, value) {
  const incoming = Array.isArray(value) ? value.slice(0, 20) : [];
  const usedIds = new Set();
  const normalized = [];

  for (let index = 0; index < incoming.length; index += 1) {
    const item = incoming[index] && typeof incoming[index] === "object" ? incoming[index] : {};
    const key = normalizedCredential(item.key ?? item.value);
    if (!key) continue;
    const baseId = normalizedCredentialId(item.id) || `${provider}-${index + 1}`;
    const id = uniqueCredentialId(baseId, usedIds);
    usedIds.add(id);
    normalized.push({
      id,
      label: normalizedCredentialLabel(item.label, provider, normalized.length + 1),
      key
    });
  }

  return normalized;
}

function addLegacyCredential(entries, provider, value, label) {
  const key = normalizedCredential(value);
  if (!key || entries.some((entry) => entry.key === key)) return;
  entries.push({
    id: `${provider}-imported-${entries.length + 1}`,
    label,
    key
  });
}

function providerLegacySettingsKey(provider) {
  if (provider === "fal") return "falKey";
  if (provider === "google") return "googleApiKey";
  if (provider === "krea") return "kreaApiKey";
  if (provider === "openAi") return "openAiApiKey";
  return "";
}

function normalizedCredentialLabel(value, provider, index) {
  const label = String(value || "").replace(/[\r\n\0]+/g, " ").trim().slice(0, 80);
  return label || `${providerLabels[provider] || "API"} key ${index}`;
}

function normalizedCredentialId(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 100);
}

function uniqueCredentialId(baseId, usedIds) {
  if (!usedIds.has(baseId)) return baseId;
  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

function normalizedCredential(value) {
  const text = String(value || "").trim();
  if (!text || !credentialCanBeUsedAsHeader(text)) return "";
  return text;
}

function credentialCanBeUsedAsHeader(value) {
  return Array.from(String(value || "")).every((character) => {
    const code = character.codePointAt(0);
    return code >= 32 && code <= 255;
  });
}
