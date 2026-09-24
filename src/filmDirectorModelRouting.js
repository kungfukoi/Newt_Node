import { filmDirectorUsesReference } from "./filmDirectorScenes.js";

export const filmDirectorInputPortId = "directorIn";

const filmDirectorConsumerTypes = new Set(["imageModel", "videoModel", "storyboard"]);

export function filmDirectorInputPortForNodeType(nodeType = "") {
  return filmDirectorConsumerTypes.has(nodeType) ? filmDirectorInputPortId : "";
}

export function filmDirectorInputPort(color) {
  return { id: filmDirectorInputPortId, label: "Director", color };
}

export function isFilmDirectorConnection({ sourceType = "", sourcePort = "", targetType = "", targetPort = "" } = {}) {
  return sourceType === "skillDirector"
    && sourcePort === "directorOut"
    && targetPort === filmDirectorInputPortForNodeType(targetType);
}

export function composeFilmDirectorPrompt({ directorPrompt, connectedPrompt, fallbackPrompt } = {}) {
  const director = String(directorPrompt || "").trim();
  const supplemental = String(connectedPrompt || fallbackPrompt || "").trim();
  if (!director) return supplemental;
  if (!supplemental || supplemental === director || director.includes(supplemental)) return director;
  return `${director}\n\nAdditional direction:\n${supplemental}`;
}

export function filmDirectorReferenceIsActive(directorData = {}, {
  tag = "",
  label = "",
  type = "image",
  categoryCount = 0
} = {}) {
  return filmDirectorUsesReference(directorData, {
    tag,
    label,
    type,
    categoryCount,
    useSavedTags: true
  });
}

export function applyFilmDirectorImageOverrides({ prompt, styleInstructions = [], cameraInstructions = [] } = {}) {
  const basePrompt = String(prompt || "").trim();
  const style = (Array.isArray(styleInstructions) ? styleInstructions : [styleInstructions])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const camera = (Array.isArray(cameraInstructions) ? cameraInstructions : [cameraInstructions])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const styleOverride = style.length
    ? [
        "CONNECTED STYLE OVERRIDE — The connected Style node is authoritative and overrides conflicting visual style, medium, palette, lighting treatment, texture, and color-grade direction earlier in this prompt, including Director direction.",
        ...style
      ].join("\n")
    : "";
  const cameraOverride = camera.length
    ? [
        "CONNECTED CAMERA OVERRIDE — The connected Camera node is authoritative and overrides conflicting shot type, framing, angle, composition, camera position, lens, depth of field, and camera movement earlier in this prompt, including Director and Style direction.",
        ...camera
      ].join("\n")
    : "";

  return [basePrompt, styleOverride, cameraOverride].filter(Boolean).join("\n\n");
}

export function explicitFilmDirectorImageIncoming(incoming = {}) {
  return Object.fromEntries(Object.entries(incoming).map(([port, items]) => [
    port,
    Array.isArray(items)
      ? items.filter((item) => item?.edge?.to?.port !== "nodeReferenceIn")
      : items
  ]));
}

function uniqueConnectionItems(items = []) {
  const seen = new Set();
  return items.filter(({ source, edge }) => {
    // A reference may arrive directly, through a prompt tag, and through a
    // Director. Its original output owns the identity, not the receiving port.
    const key = `${source?.id || ""}:${edge?.from?.port || ""}`;
    if (!source || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeFilmDirectorVisualIncoming(incoming = {}, packages = [], {
  imagePort = "referenceImageIn",
  characterPort = "characterIn",
  includeCharacters = true
} = {}) {
  const imageItems = [...(incoming[imagePort] || [])];
  const characterItems = [...(incoming[characterPort] || [])];

  packages.forEach((directorPackage) => {
    imageItems.push(...(directorPackage?.imageItems || []));
    if (includeCharacters) characterItems.push(...(directorPackage?.characterItems || []));
  });

  return {
    ...incoming,
    [imagePort]: uniqueConnectionItems(imageItems),
    [characterPort]: includeCharacters ? uniqueConnectionItems(characterItems) : incoming[characterPort] || []
  };
}
