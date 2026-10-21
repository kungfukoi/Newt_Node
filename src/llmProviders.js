export const llmProviderIds = Object.freeze(["fal", "openai", "atlas", "krea"]);

export function normalizeLlmProvider(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "openai") return "openai";
  if (normalized === "fal" || normalized === "falai") return "fal";
  if (normalized === "atlas" || normalized === "atlascloud") return "atlas";
  if (normalized === "krea") return "krea";
  return "";
}

export function resolveLlmProvider({ preferredProvider = "", falKey = "", openAiKey = "", atlasKey = "", kreaKey = "" } = {}) {
  const configured = {
    fal: Boolean(String(falKey || "").trim()),
    openai: Boolean(String(openAiKey || "").trim()),
    atlas: Boolean(String(atlasKey || "").trim()),
    krea: Boolean(String(kreaKey || "").trim())
  };
  const preferred = normalizeLlmProvider(preferredProvider);
  if (preferred === "krea") return configured.krea ? "krea" : "";
  const order = [preferred, "fal", "openai", "atlas"].filter((provider, index, providers) => (
    provider && providers.indexOf(provider) === index
  ));
  return order.find((provider) => configured[provider]) || "";
}

export function llmProviderUnavailableMessage({ kreaKey = "" } = {}) {
  return "Select an active Fal, OpenAI, Atlas Cloud, or Krea API key in Settings for LLM features. If Krea is selected, enable its key or change Text / Agent / Director LLM.";
}
