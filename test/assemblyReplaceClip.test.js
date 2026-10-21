import test from "node:test";
import assert from "node:assert/strict";
import { assemblyClipReplacementError, assemblyRenderPayload, createAssemblyHistory, createAssemblyState, importAssemblyOutputItem, insertAssemblyMediaWithLinkedAudio, normalizeAssemblyState, replaceAssemblyClipMedia, updateAssemblyClip } from "../src/assembly/assemblyState.js";

function fixture({ audio = true } = {}) {
  let state = createAssemblyState();
  for (const item of [{ id: "old", url: "/outputs/old.mp4", duration: 10, hasAudio: audio }, { id: "new", url: "/outputs/new.mp4", duration: 5, hasAudio: audio }, { id: "short", url: "/outputs/short.mp4", duration: 0.5, hasAudio: false }]) state = importAssemblyOutputItem(state, { type: "video", hasAudioKnown: true, ...item });
  const old = state.media.find(item => item.url === "/outputs/old.mp4");
  state = insertAssemblyMediaWithLinkedAudio(state, old.id, state.tracks.find(track => track.type === "video").id, 2);
  const clipId = state.selectedClipId;
  state = updateAssemblyClip(state, clipId, { duration: 2, sourceIn: 4, scale: 135, translateX: 12, opacity: 80, speed: 150, reverse: true });
  state = insertAssemblyMediaWithLinkedAudio(state, old.id, state.tracks.find(track => track.type === "video").id, 8);
  return { state, clipId, replacement: state.media.find(item => item.url === "/outputs/new.mp4").id };
}
const find = (state, id) => state.tracks.flatMap(track => track.clips).find(clip => clip.id === id);

test("replacing one clip keeps its edit slot, transforms and speed, starts at the new source beginning and leaves other uses alone", () => {
  const { state, clipId, replacement } = fixture();
  const original = structuredClone(state), before = find(state, clipId);
  const next = replaceAssemblyClipMedia(state, clipId, replacement), clip = find(next, clipId);
  assert.deepEqual(state, original);
  for (const key of ["id", "start", "duration", "scale", "translateX", "opacity", "speed", "reverse"]) assert.equal(clip[key], before[key], key);
  assert.equal(clip.mediaId, replacement); assert.equal(clip.sourceIn, 0); assert.equal(clip.sourceDuration, 5);
  assert.equal(next.selectedClipId, clipId);
  assert.equal(next.tracks[0].clips[1].mediaId, before.mediaId);
  assert.equal(next.media.find(item => item.id === before.mediaId).url, "/outputs/old.mp4");
  assert.deepEqual(normalizeAssemblyState(JSON.parse(JSON.stringify(next))), next);
  assert.equal(assemblyRenderPayload(next).tracks[0].clips[0].mediaId, replacement);
});

test("replacement updates only the targeted clip's linked embedded audio", () => {
  const { state, clipId, replacement } = fixture();
  const before = find(state, clipId), next = replaceAssemblyClipMedia(state, clipId, replacement);
  const linked = next.tracks.flatMap(track => track.clips).filter(clip => clip.linkGroupId === before.linkGroupId);
  assert.equal(linked.length, 2);
  const audio = linked.find(clip => clip.id !== clipId);
  assert.equal(next.media.find(media => media.id === audio.mediaId).derivedFromMediaId, replacement);
  assert.deepEqual([audio.start, audio.duration, audio.sourceIn, audio.speed, audio.reverse], [before.start, before.duration, 0, before.speed, before.reverse]);
  const unrelatedAudio = state.tracks.filter(track => track.type === "audio").flatMap(track => track.clips).find(clip => clip.linkGroupId !== before.linkGroupId);
  assert.deepEqual(find(next, unrelatedAudio.id), unrelatedAudio);
});

test("silent replacement removes the old linked audio and replacing silence adds the new embedded audio", () => {
  const { state, clipId, replacement } = fixture();
  const next = replaceAssemblyClipMedia({ ...state, media: state.media.map(media => media.id === replacement ? { ...media, hasAudio: false } : media) }, clipId, replacement);
  assert.equal(find(next, clipId).linkGroupId, "");
  const oldGroup = find(state, clipId).linkGroupId;
  assert.equal(next.tracks.flatMap(track => track.clips).filter(clip => clip.linkGroupId === oldGroup).length, 0);
  const restored = replaceAssemblyClipMedia(next, clipId, find(state, clipId).mediaId);
  assert.equal(restored.tracks.flatMap(track => track.clips).filter(clip => clip.linkGroupId === find(restored, clipId).linkGroupId).length, 2);
});

test("short, incompatible and locked replacements are rejected without partial audio/video edits", () => {
  const { state, clipId, replacement } = fixture();
  const short = state.media.find(item => item.url === "/outputs/short.mp4").id;
  assert.match(assemblyClipReplacementError(state, clipId, short), /at least 3.000 seconds/);
  assert.deepEqual(replaceAssemblyClipMedia(state, clipId, short), normalizeAssemblyState(state));
  const locked = structuredClone(state); locked.tracks.find(track => track.type === "audio").locked = true;
  assert.match(assemblyClipReplacementError(locked, clipId, replacement), /Unlock/);
  assert.deepEqual(replaceAssemblyClipMedia(locked, clipId, replacement), normalizeAssemblyState(locked));
  const audio = state.media.find(item => item.type === "audio");
  assert.match(assemblyClipReplacementError(state, clipId, audio.id), /video or image/);
});

test("replacement is a single undoable operation", () => {
  const { state, clipId, replacement } = fixture();
  const history = createAssemblyHistory(state);
  const next = history.commit(replaceAssemblyClipMedia(state, clipId, replacement));
  assert.deepEqual(history.undo(), normalizeAssemblyState(state));
  assert.deepEqual(history.redo(), next);
});
