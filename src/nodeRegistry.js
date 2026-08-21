export const nodeTypeDefinitions = [
  { type: "plainText", label: "Text" },
  { type: "text", label: "Text Model" },
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
  { type: "preview", label: "Preview" },
  { type: "output", label: "Output" },
  { type: "autoAspect", label: "Auto Aspect" },
  { type: "skillDirector", label: "Film Director" },
  { type: "storyboard", label: "Storyboard" },
  { type: "coverage", label: "Coverage" },
  { type: "character", label: "Character" },
  { type: "camera", label: "Camera" },
  { type: "composer", label: "Composer" },
  { type: "frameIt", label: "Frame It" },
  { type: "style", label: "Style" },
  { type: "transfer", label: "Mood Board" },
  { type: "utility", label: "Utility" },
  { type: "edit", label: "Edit" },
  { type: "assembly", label: "Timeline" },
  { type: "audio", label: "Audio" },
  { type: "model3d", label: "3D" },
  { type: "imageModel", label: "Image Model" },
  { type: "videoModel", label: "Video Model" }
];

const nodeTypeMap = new Map(nodeTypeDefinitions.map((definition) => [definition.type, definition]));

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
