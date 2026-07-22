export const defaultModelProviderPreferences = Object.freeze({
  seedance: "fal",
  veo: "google",
  imageGeneration: "google"
});

export function normalizeModelProviderPreferences(value = {}, availability = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  return {
    seedance: normalizedProvider(incoming.seedance, ["fal", "krea"])
      || (!availability.fal && availability.krea ? "krea" : defaultModelProviderPreferences.seedance),
    veo: normalizedProvider(incoming.veo, ["google", "fal"])
      || (!availability.google && availability.fal ? "fal" : defaultModelProviderPreferences.veo),
    imageGeneration: normalizedProvider(incoming.imageGeneration, ["google", "fal"])
      || (!availability.google && availability.fal ? "fal" : defaultModelProviderPreferences.imageGeneration)
  };
}

export function providerPreferenceLabel(provider) {
  if (provider === "krea") return "Krea";
  if (provider === "google") return "Google";
  return "Fal";
}

function normalizedProvider(value, supported) {
  const provider = String(value || "").trim().toLowerCase();
  return supported.includes(provider) ? provider : "";
}
