export const nodeTypeDefinitions = [
  { type: "batch", label: "Batch", catalog: false },
  { type: "plainText", label: "Text" },
  { type: "text", label: "Text Model", catalog: false },
  { type: "textAgent", label: "Text Agent" },
  { type: "imageModel", label: "Image Model" },
  { type: "videoModel", label: "Video Model" },
  { type: "audioModel", label: "Audio Model" },
  { type: "preview", label: "Preview" },
  { type: "explore", label: "Explore" },
  { type: "autoAspect", label: "Auto Aspect", catalog: false },
  { type: "coverage", label: "Coverage", catalog: false },
  { type: "style", label: "Style" },
  { type: "transfer", label: "Mood Board" },
  { type: "character", label: "Character" },
  { type: "camera", label: "Camera" },
  { type: "composer", label: "Composer" },
  { type: "frameIt", label: "Frame It", catalog: false },
  { type: "skillDirector", label: "Director" },
  { type: "edit", label: "Edit" },
  { type: "keyer", label: "Keyer", catalog: false },
  { type: "assembly", label: "Timeline" },
  { type: "storyboard", label: "Storyboard" },
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
  { type: "audio", label: "Audio" },
  { type: "model3d", label: "3D" },
  { type: "output", label: "Output" },
  { type: "utility", label: "Utility" }
];

const nodeTypeMap = new Map(nodeTypeDefinitions.map((definition) => [definition.type, definition]));

export const catalogNodeTypeDefinitions = nodeTypeDefinitions.filter((definition) => definition.catalog !== false);

export function nodeTypeDefinition(type) {
  return nodeTypeMap.get(type) || null;
}

export function nodeTypeLabel(type, fallback = "Node") {
  return nodeTypeDefinition(type)?.label || fallback;
}

export function timelineNodeTitle(value = "") {
  const title = String(value || "");
  const normalized = title.trim();
  if (!normalized) return "Timeline";
  if (/^Assembly(?:\s+\d+)?$/.test(normalized)) return normalized.replace(/^Assembly/, "Timeline");
  return title;
}

export function nodeTypeForOutputItem(item) {
  if (item?.type === "image") return "image";
  if (item?.type === "video") return "video";
  if (item?.type === "audio") return "audio";
  if (item?.type === "model3d") return "model3d";
  return "";
}
