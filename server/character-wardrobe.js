export function normalizeCharacterWardrobeRequest(body = {}) {
  const labels = body.imagePromptLabels;
  const legacyWardrobe = /^character(?:-|$)/.test(String(body.nodeId || ""))
    && / Wardrobe Edit$/.test(String(body.nodeTitle || ""))
    && Array.isArray(body.imagePromptUrls) && body.imagePromptUrls.length === 2
    && Array.isArray(labels) && labels.length === 2
    && /^Locked Base Identity (?:Character|CU Video) Sheet$/.test(String(labels[0]))
    && /^Selected wardrobe reference;? clothing only$/.test(String(labels[1]));
  if (body.characterWardrobeEdit !== true && !legacyWardrobe) return body;
  // Old open tabs still submit rectangles. Whole-sheet wardrobe edits must never
  // pass those masks to a provider or composite faces back over its finished image.
  const { editMaskDataUrl: _obsoleteMask, ...request } = body;
  return { ...request, characterWardrobeEdit: true };
}
