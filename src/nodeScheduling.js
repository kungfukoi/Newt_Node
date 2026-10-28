import { normalizeModelProviderPreferences } from "./modelProviderRouting.js";
import { isKeyerNode } from "./keyer.js";

// Scheduling hints only. Provider selection still belongs to the existing runners.
export function nodeSchedulingKey(node, preferences) {
  if (isKeyerNode(node)) return "localGpu";
  if (node?.type === "audioModel") return "elevenLabs";
  const routes = normalizeModelProviderPreferences(preferences);
  const model = String(node?.data?.model || "").toLowerCase();
  if (model.includes("seedance")) return routes.seedance;
  if (model.includes("minimax h3")) return routes.minimaxH3 === "local" ? "localGpu" : routes.minimaxH3;
  if (/veo|gemini omni|kling|flux 3 max|wan 2.7|creatify aurora/.test(model)) return routes.veo;
  if (model.includes("nano banana") || model.includes("imagen")) return routes.imageGeneration;
  if (model.includes("openai image") || model.includes("gpt-image") || model.includes("reve")) return ["atlas", "krea"].includes(routes.imageGeneration) ? routes.imageGeneration : "fal";
  if (["text", "textAgent"].includes(node?.type)) return routes.llm;
  if (model.includes("openai") || model.includes("gpt")) return routes.llm;
  if (model.includes("krea")) return "krea";
  if (model.includes("wanwarp") || model.includes("wanblend")) return "localGpu";
  if (/z-image|seedream|ideogram|flux 3/.test(model)) return routes.imageGeneration === "krea" ? "krea" : "fal";
  if (["edit", "assembly", "output"].includes(node?.type)) return "localMedia";
  return "other";
}

export function nodeBatchConcurrency(node, preferences) {
  if (["keyer", "explore", "skillDirector", "storyboard"].includes(node?.type)) return 1;
  const model = node?.type === "utility" ? node.data?.utilityMode === "video" ? node.data.utilityVideoModel : node.data.utilityImageModel : node?.data?.model;
  const resource = nodeSchedulingKey({ ...node, data: { ...node?.data, model } }, preferences);
  return resource === "localGpu" ? 1 : resource === "localMedia" ? 2 : 3;
}
