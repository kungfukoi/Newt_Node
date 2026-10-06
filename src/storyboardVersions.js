import { storyboardFrameDirection } from "./storyboardRevisions.js";
export const storyboardVersionLimit = 8;
export function normalizeStoryboardVersions(versions) {
  return Array.isArray(versions) ? versions.filter(v => v && (v.resultUrl || v.exportUrl)).slice(-storyboardVersionLimit).map(({ versions, generatedDirection, protected: locked, status, error, ...v }) => ({ ...v })) : [];
}
export function storyboardFrameSnapshot(frame, now = Date.now()) {
  const { versions, generatedDirection, protected: locked, status, error, ...snapshot } = frame;
  return structuredClone({ ...snapshot, ...(generatedDirection || storyboardFrameDirection(frame)), savedAt: now });
}
export function versionStoryboardReplacement(original, next, now = Date.now()) {
  if (!original) return { ...next, versions: normalizeStoryboardVersions(next.versions), generatedDirection: next.resultUrl || next.exportUrl ? storyboardFrameDirection(next) : undefined };
  if (original.protected) return original;
  const changed = next.resultUrl !== original.resultUrl || next.exportUrl !== original.exportUrl;
  if (!changed || !(next.resultUrl || next.exportUrl)) return next;
  const versions = normalizeStoryboardVersions(original.versions);
  if (original.resultUrl || original.exportUrl) versions.push(storyboardFrameSnapshot(original, now));
  return { ...next, versions: versions.slice(-storyboardVersionLimit), generatedDirection: storyboardFrameDirection(next) };
}
export function restoreStoryboardVersion(frame, index, now = Date.now()) {
  if (frame.protected || ["running", "queued", "reviewing"].includes(frame.status)) throw new Error("Unprotect the idle panel before restoring a version.");
  const version = normalizeStoryboardVersions(frame.versions)[index];
  if (!version) throw new Error("That panel version is no longer available.");
  const versions = normalizeStoryboardVersions(frame.versions).filter((_, i) => i !== index);
  if (frame.resultUrl || frame.exportUrl) versions.push(storyboardFrameSnapshot(frame, now));
  return { ...frame, ...version, id: frame.id, number: frame.number, protected: false, versions: versions.slice(-storyboardVersionLimit), generatedDirection: storyboardFrameDirection({ ...version, id: frame.id, number: frame.number }), resultVersion: now, status: "complete", error: "" };
}
export function canMoveStoryboardFrame(frames, fromId, toId) {
  const from = frames.findIndex(f => f.id === fromId), to = frames.findIndex(f => f.id === toId);
  return from >= 0 && to >= 0 && !frames.slice(Math.min(from,to), Math.max(from,to)+1).some(f => f.protected);
}
