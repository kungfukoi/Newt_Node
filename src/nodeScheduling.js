import { normalizeModelProviderPreferences } from "./modelProviderRouting.js";

// Scheduling hints only. Provider selection still belongs to the existing runners.
export function nodeSchedulingKey(node, preferences) {
  const routes = normalizeModelProviderPreferences(preferences);
  const model = String(node?.data?.model || "").toLowerCase();
  if (model.includes("seedance")) return routes.seedance;
  if (model.includes("minimax h3")) return routes.minimaxH3 === "local" ? "localGpu" : routes.minimaxH3;
  if (model.includes("veo")) return routes.veo;
  if (model.includes("nano banana") || model.includes("imagen")) return routes.imageGeneration;
  if (model.includes("openai") || model.includes("gpt")) return "openai";
  if (model.includes("krea")) return "krea";
  if (model.includes("wanwarp") || model.includes("wanblend")) return "localGpu";
  if (/z-image|seedream|reve|kling/.test(model)) return "fal";
  if (["edit", "assembly", "output"].includes(node?.type)) return "localMedia";
  return "other";
}
