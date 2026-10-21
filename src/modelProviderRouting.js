import { kreaEndpoints } from "./kreaApi.js";

export const defaultModelProviderPreferences = Object.freeze({
  seedance: "fal",
  veo: "google",
  imageGeneration: "google",
  model3d: "fal",
  utilityImage: "fal",
  utilityVideo: "fal",
  minimaxH3: "google",
  llm: "fal"
});

const providerModelSupport = Object.freeze({
  model3d: Object.freeze({ fal: Object.freeze(["Hunyuan 3D 3.1 Pro", "Rodin 2.5"]), krea: Object.freeze(["Hunyuan 3D 3.1 Pro", "Rodin 2.5"]) }),
  utilityImage: Object.freeze({ fal: Object.freeze(["Qwen Camera Edit", "Image to Color ID", "DWPose", "Depth Anything", "Topaz Image Upscale", "Patina", "BiRefNet Image", "SAM 3 Image"]), krea: Object.freeze(["Topaz Image Upscale", "Image to Color ID"]) }),
  utilityVideo: Object.freeze({ fal: Object.freeze(["Video Outpaint", "DWPose Video", "Depth Anything Video", "Wan VACE Mask-to-Video", "Wan VACE 14B Inpainting", "Wan 2.2 A14B LoRA Text-to-Video", "Wan 2.2 A14B LoRA Image-to-Video", "Wan 2.2 VACE Fun A14B Depth", "Wan 2.2 VACE Fun A14B Pose", "Wan 2.2 VACE Fun A14B Inpainting", "SAM 3 Video", "VOID Video Inpainting", "BiRefNet Video", "RIFE Video", "Bytedance Upscaler", "Flux Video Upscale", "Topaz SDR to HDR", "Topaz Video Upscale"]), krea: Object.freeze(["Flux Video Upscale", "Topaz SDR to HDR", "Topaz Video Upscale"]) }),
  minimaxH3: Object.freeze({
    fal: Object.freeze(["MiniMax H3"]),
    krea: Object.freeze(["MiniMax H3"]),
    atlas: Object.freeze(["MiniMax H3"]),
    local: Object.freeze(["MiniMax H3 (576P)"])
  }),
  seedance: Object.freeze({
    fal: Object.freeze(["Seedance 2.0", "Seedance 2.5"]),
    krea: Object.freeze(["Seedance 2.0", "Seedance 2.5"]),
    atlas: Object.freeze(["Seedance 2.0", "Seedance 2.5"])
  }),
  veo: Object.freeze({
    google: Object.freeze(["Gemini Omni Flash"]),
    fal: Object.freeze(["MiniMax H3", "FLUX 3 Max", "Gemini Omni Flash", "Kling O3 Pro", "Kling O3 4K", "Wan 2.7 Reference-to-Video", "Creatify Aurora"]),
    krea: Object.freeze(["MiniMax H3", "FLUX 3 Max", "Gemini Omni Flash", "Kling O3 Pro", "Kling O3 4K"]),
    atlas: Object.freeze(["MiniMax H3"]),
    local: Object.freeze(["MiniMax H3 (576P)"])
  }),
  imageGeneration: Object.freeze({
    krea: Object.freeze(Object.keys(kreaEndpoints.image)),
    google: Object.freeze(["Nano Banana Pro"]),
    fal: Object.freeze([
      "Z-Image",
      "Seedream 5.0 Pro",
      "Nano Banana 2",
      "Nano Banana Pro",
      "OpenAI Image 2.5 Flare",
      "OpenAI Image 2.5 Sunburst",
      "OpenAI Image 2",
      "Ideogram 4.5",
      "Flux 3",
      "Nano Banana 2.1",
      "REVE 2.1",
      "Krea 2 Large"
    ]),
    atlas: Object.freeze([
      "OpenAI Image 2.5 Flare",
      "OpenAI Image 2.5 Sunburst",
      "OpenAI Image 2",
      "Nano Banana 2",
      "Nano Banana Pro",
      "REVE 2.1"
    ])
  }),
  llm: Object.freeze({
    krea: Object.freeze(["GPT-5.6 Luna", "GPT-6 Astra", "GPT-5.6 Sol"]),
    fal: Object.freeze(["GPT-5.6 Terra", "GPT-6 Astra", "GPT-5.6 Sol"]),
    openai: Object.freeze(["GPT-5.6 Luna", "GPT-6 Astra", "GPT-5.6 Sol"]),
    atlas: Object.freeze(["GPT-5.6 Luna", "GPT-6 Astra", "GPT-5.6 Sol"])
  })
});

export function normalizeModelProviderPreferences(value = {}, availability = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  const videoProvider = normalizedProvider(incoming.veo, ["google", "fal", "krea", "atlas", "local"])
    || normalizedProvider(incoming.minimaxH3, ["fal", "krea", "atlas", "local"])
    || (!availability.google && availability.fal ? "fal" : !availability.fal && availability.krea ? "krea" : defaultModelProviderPreferences.veo);
  return {
    seedance: normalizedProvider(incoming.seedance, ["fal", "krea", "atlas"])
      || (!availability.fal && availability.krea ? "krea" : defaultModelProviderPreferences.seedance),
    // Keep the persisted veo key for compatibility; the UI now calls this Video Model.
    veo: videoProvider,
    imageGeneration: normalizedProvider(incoming.imageGeneration, ["google", "fal", "krea", "atlas"])
      || (!availability.google && availability.fal ? "fal" : defaultModelProviderPreferences.imageGeneration),
    model3d: normalizedProvider(incoming.model3d, ["fal", "krea"]) || (!availability.fal && availability.krea ? "krea" : "fal"),
    utilityImage: normalizedProvider(incoming.utilityImage, ["fal", "krea"]) || "fal",
    utilityVideo: normalizedProvider(incoming.utilityVideo, ["fal", "krea"]) || (!availability.fal && availability.krea ? "krea" : "fal"),
    // Compatibility alias for existing runners and saved settings. Video Model owns routing.
    minimaxH3: videoProvider,
    llm: normalizedProvider(incoming.llm, ["fal", "openai", "atlas", "krea"])
      || defaultModelProviderPreferences.llm
  };
}

export function providerPreferenceLabel(provider) {
  if (provider === "local") return "Local";
  if (provider === "krea") return "Krea";
  if (provider === "google") return "Google";
  if (provider === "atlas") return "Atlas Cloud";
  if (provider === "openai") return "OpenAI";
  return "Fal";
}

export function providerSupportedModels(route, provider) {
  return [...(providerModelSupport[route]?.[provider] || [])];
}

// Match the generation routes, including Google's Nano Banana-only override
// and the dedicated Seedance provider preference.
export function modelProviderOptionState(model, mediaType, preferences = {}, availability = {}) {
  const normalized = normalizeModelProviderPreferences(preferences, availability);
  let route = "imageGeneration";
  if (mediaType === "video") {
    route = /^Seedance /.test(model) ? "seedance" : "veo";
  }
  let provider = normalized[route];
  if (route === "imageGeneration" && provider === "google" && model !== "Nano Banana Pro") provider = "fal";
  const supported = providerSupportedModels(route, provider).some((candidate) =>
    candidate === model || (provider === "local" && model === "MiniMax H3")
  );
  return {
    disabled: !supported,
    reason: supported ? "" : `Unavailable with ${providerPreferenceLabel(provider)}. Change the provider in Settings > Model Providers.`
  };
}

export function providerSupportedModelsLabel(route, provider) {
  const models = providerSupportedModels(route, provider);
  return models.length ? `Models: ${models.join(", ")}` : "Models: None configured";
}

export function missingModelProviderCredentials(value = {}, availability = {}) {
  const preferences = normalizeModelProviderPreferences(value);
  const requiredProviders = new Set(Object.values(preferences).filter((provider) => provider !== "local"));
  return [...requiredProviders].filter((provider) => !availability[provider]);
}

export function missingModelProviderApiKeyMessage(feature, provider) {
  const providerLabel = providerPreferenceLabel(provider);
  return `${feature} is routed to ${providerLabel}, but the ${providerLabel} API key field is empty or no saved key is active. Open Settings > API Credentials > ${providerLabel}, paste or select a key, then choose Save & Validate before running again.`;
}

export function activateSoleModelProviderCredentials(value = {}, credentials = {}, activeCredentialIds = {}) {
  const preferences = normalizeModelProviderPreferences(value);
  const requiredProviders = new Set(Object.values(preferences).filter((provider) => provider !== "local"));
  const next = { ...(activeCredentialIds && typeof activeCredentialIds === "object" ? activeCredentialIds : {}) };
  for (const provider of requiredProviders) {
    const credentialProvider = provider === "openai" ? "openAi" : provider;
    const candidates = Array.isArray(credentials?.[credentialProvider])
      ? credentials[credentialProvider].filter((credential) => String(credential?.key || "").trim())
      : [];
    const activeId = String(next[credentialProvider] || "");
    if (candidates.some((credential) => credential.id === activeId)) continue;
    if (candidates.length === 1) next[credentialProvider] = candidates[0].id;
  }
  return next;
}

function normalizedProvider(value, supported) {
  const provider = String(value || "").trim().toLowerCase();
  return supported.includes(provider) ? provider : "";
}
