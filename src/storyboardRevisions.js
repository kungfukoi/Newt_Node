export const storyboardRevisionLimit = 8;
export const storyboardDirectionFields = ["id", "number", "shot", "lens", "angle", "beat", "prompt", "notes"];
export function storyboardFrameDirection(frame) {
  return Object.fromEntries(storyboardDirectionFields.map(key => [key, frame[key] ?? (key === "number" ? 1 : "")]));
}
export function storyboardRevisionTargets(frames, ids) {
  if (!Array.isArray(frames) || !frames.length || frames.length > 35 || new Set(frames.map(f => f?.id)).size !== frames.length) throw new Error("Storyboard needs uniquely identified panels.");
  if (!Array.isArray(ids) || !ids.length || ids.length > storyboardRevisionLimit || new Set(ids).size !== ids.length) throw new Error("Select between one and eight different panels.");
  const targets = ids.map(id => frames.find(frame => frame.id === id));
  if (targets.some(frame => !frame || frame.protected || ["running", "queued", "reviewing"].includes(frame.status))) throw new Error("Selected panels must exist and be idle and unprotected.");
  return frames.filter(frame => ids.includes(frame.id));
}
export function validateStoryboardRevision(revision, frames, ids) {
  const targets = storyboardRevisionTargets(frames, ids);
  if (!Array.isArray(revision?.frames) || revision.frames.length !== targets.length) throw new Error("Revision must return every selected panel exactly once.");
  revision.frames.forEach((frame, i) => {
    if (frame.id !== targets[i].id || frame.number !== targets[i].number || !frame.prompt?.trim() || !frame.beat?.trim()) throw new Error("Revision changed panel identity, order, or omitted directions.");
  });
  return revision.frames.map(storyboardFrameDirection);
}
export function storyboardRevisionSourceMatches(current, original) {
  return Boolean(current && original) && JSON.stringify(storyboardFrameDirection(current)) === JSON.stringify(storyboardFrameDirection(original))
    && current.resultUrl === original.resultUrl && current.exportUrl === original.exportUrl && !current.protected;
}
