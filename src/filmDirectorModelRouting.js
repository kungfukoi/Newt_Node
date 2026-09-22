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

function uniqueConnectionItems(items = []) {
  const seen = new Set();
  return items.filter(({ source, edge }) => {
    const key = `${source?.id || ""}:${edge?.from?.port || ""}:${edge?.to?.port || ""}`;
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
