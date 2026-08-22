import test from "node:test";
import assert from "node:assert/strict";
import {
  addAssemblyTrack,
  assemblyActiveClips,
  assemblyDuration,
  createAssemblyClipClipboard,
  createAssemblyHistory,
  createAssemblyState,
  insertAssemblyMediaClip,
  moveAssemblyClip,
  normalizeAssemblyState,
  pasteAssemblyClip,
  removeAssemblyClip,
  slipAssemblyClip,
  snapAssemblyClipMoveStart,
  splitAssemblyClip,
  syncAssemblyInputs,
  trimAssemblyClip,
  updateAssemblyMedia,
  updateAssemblyTrack
} from "../src/assembly/assemblyState.js";

function stateWithVideo() {
  const synced = syncAssemblyInputs(createAssemblyState(), [{
    id: "media-1",
    sourceNodeId: "video-1",
    sourcePort: "videoOut",
    type: "video",
    url: "/outputs/clip.mp4",
    duration: 8,
    label: "Clip"
  }]);
  const probed = updateAssemblyMedia(synced, "media-1", { duration: 8, hasAudio: true });
  const videoTrack = probed.tracks.find((track) => track.type === "video");
  return insertAssemblyMediaClip(probed, "media-1", videoTrack.id, 0);
}

test("timeline imports each connected source once into the media bin", () => {
  const first = syncAssemblyInputs(createAssemblyState(), [{
    id: "media-1",
    sourceNodeId: "video-1",
    sourcePort: "videoOut",
    type: "video",
    url: "/outputs/clip.mp4",
    duration: 8
  }]);
  const second = syncAssemblyInputs(first, [{
    id: "another-input-id",
    sourceNodeId: "video-1",
    sourcePort: "videoOut",
    type: "video",
    url: "/outputs/clip.mp4",
    duration: 8
  }]);
  assert.equal(second.media.length, 1);
  assert.equal(second.tracks.flatMap((track) => track.clips).length, 0);
  assert.equal(assemblyDuration(second), 10);
});

test("media-bin sources can be inserted repeatedly as independent clips", () => {
  const synced = syncAssemblyInputs(createAssemblyState(), [{
    id: "media-1",
    sourceNodeId: "video-1",
    sourcePort: "videoOut",
    type: "video",
    url: "/outputs/clip.mp4",
    duration: 8
  }]);
  const videoTrack = synced.tracks.find((track) => track.type === "video");
  const first = insertAssemblyMediaClip(synced, "media-1", videoTrack.id, 0);
  const second = insertAssemblyMediaClip(first, "media-1", videoTrack.id, 4);
  assert.equal(second.tracks.find((track) => track.id === videoTrack.id).clips.length, 2);
  assert.notEqual(second.tracks.find((track) => track.id === videoTrack.id).clips[0].id, second.tracks.find((track) => track.id === videoTrack.id).clips[1].id);
  assert.deepEqual(second.tracks.find((track) => track.id === videoTrack.id).clips.map((clip) => clip.start), [0, 4]);
});

test("Timeline clip clipboard preserves edits and pastes a fresh clip at the playhead", () => {
  let state = stateWithVideo();
  const original = state.tracks.flatMap((track) => track.clips)[0];
  state = trimAssemblyClip(state, original.id, "right", 5, false);
  state = slipAssemblyClip(state, original.id, 2);
  const clipboard = createAssemblyClipClipboard(state, original.id);
  const pasted = pasteAssemblyClip(state, clipboard, 11.25);
  const clips = pasted.tracks.flatMap((track) => track.clips);
  const duplicate = clips.find((clip) => clip.id === pasted.selectedClipId);

  assert.equal(clips.length, 2);
  assert.notEqual(duplicate.id, original.id);
  assert.equal(duplicate.mediaId, original.mediaId);
  assert.equal(duplicate.start, 11.25);
  assert.equal(duplicate.duration, 5);
  assert.equal(duplicate.sourceIn, 2);
  assert.equal(duplicate.sourceDuration, 8);
});

test("Timeline clip paste falls back from a locked source track", () => {
  const state = stateWithVideo();
  const sourceTrack = state.tracks.find((track) => track.clips.length);
  const fallbackTrack = state.tracks.find((track) => track.type === "video" && track.id !== sourceTrack.id);
  const clipboard = createAssemblyClipClipboard(state);
  const locked = updateAssemblyTrack(state, sourceTrack.id, { locked: true });
  const pasted = pasteAssemblyClip(locked, clipboard, 3);

  assert.equal(pasted.tracks.find((track) => track.id === sourceTrack.id).clips.length, 1);
  assert.equal(pasted.tracks.find((track) => track.id === fallbackTrack.id).clips.length, 1);
  assert.equal(pasted.tracks.find((track) => track.id === fallbackTrack.id).clips[0].start, 3);
});

test("media-bin insertion respects video, still, and audio track compatibility", () => {
  const synced = syncAssemblyInputs(createAssemblyState(), [
    { id: "still-1", sourceNodeId: "image-1", sourcePort: "imageOut", type: "image", url: "/outputs/still.png", duration: 5 },
    { id: "audio-1", sourceNodeId: "audio-1", sourcePort: "audioOut", type: "audio", url: "/outputs/music.wav", duration: 12 }
  ]);
  const videoTrack = synced.tracks.find((track) => track.type === "video");
  const audioTrack = synced.tracks.find((track) => track.type === "audio");
  const withStill = insertAssemblyMediaClip(synced, "still-1", videoTrack.id, 1);
  const withAudio = insertAssemblyMediaClip(withStill, "audio-1", audioTrack.id, 2);
  const rejectedStill = insertAssemblyMediaClip(withAudio, "still-1", audioTrack.id, 3);
  const rejectedAudio = insertAssemblyMediaClip(rejectedStill, "audio-1", videoTrack.id, 4);
  assert.equal(rejectedAudio.tracks.find((track) => track.id === videoTrack.id).clips.length, 1);
  assert.equal(rejectedAudio.tracks.find((track) => track.id === audioTrack.id).clips.length, 1);
});

test("split preserves source timing and total duration", () => {
  const state = stateWithVideo();
  const clip = state.tracks.flatMap((track) => track.clips)[0];
  const split = splitAssemblyClip(state, clip.id, 3);
  const clips = split.tracks.flatMap((track) => track.clips);
  assert.equal(clips.length, 2);
  assert.equal(clips[0].duration, 3);
  assert.equal(clips[1].start, 3);
  assert.equal(clips[1].sourceIn, 3);
  assert.equal(clips[0].duration + clips[1].duration, 8);
});

test("trim and slip clamp edits to available source media", () => {
  const state = stateWithVideo();
  const clip = state.tracks.flatMap((track) => track.clips)[0];
  const trimmed = trimAssemblyClip(state, clip.id, "right", 5, false);
  const slipped = slipAssemblyClip(trimmed, clip.id, 2);
  const edited = slipped.tracks.flatMap((track) => track.clips)[0];
  assert.equal(edited.duration, 5);
  assert.equal(edited.sourceIn, 2);
  const clamped = slipAssemblyClip(slipped, clip.id, 20).tracks.flatMap((track) => track.clips)[0];
  assert.equal(clamped.sourceIn, 3);
});

test("clips move between compatible tracks and ripple delete closes the gap", () => {
  let state = stateWithVideo();
  const first = state.tracks.flatMap((track) => track.clips)[0];
  state = splitAssemblyClip(state, first.id, 3);
  const clips = state.tracks.flatMap((track) => track.clips);
  const secondTrack = state.tracks.filter((track) => track.type === "video")[1];
  const moved = moveAssemblyClip(state, clips[1].id, secondTrack.id, 4);
  assert.equal(secondTrack.id, moved.tracks.find((track) => track.clips.some((clip) => clip.id === clips[1].id)).id);
  const returned = moveAssemblyClip(moved, clips[1].id, moved.tracks[0].id, 3);
  const rippled = removeAssemblyClip(returned, clips[0].id, true);
  assert.equal(rippled.tracks[0].clips[0].start, 0);
});

test("clip moves magnetically snap their start and end edges to neighboring clips", () => {
  let state = stateWithVideo();
  const videoTrack = state.tracks.find((track) => track.type === "video");
  state = insertAssemblyMediaClip(state, "media-1", videoTrack.id, 10);
  const movingClip = state.tracks.find((track) => track.id === videoTrack.id).clips.at(-1);
  assert.equal(snapAssemblyClipMoveStart(state, movingClip.id, videoTrack.id, 7.9, 72, 12), 8);
  assert.equal(snapAssemblyClipMoveStart(state, movingClip.id, videoTrack.id, 8.5, 72, 12), 8.5);
});

test("history provides stable undo and redo snapshots", () => {
  const initial = createAssemblyState();
  const history = createAssemblyHistory(initial);
  const changed = addAssemblyTrack(initial, "audio");
  history.commit(changed);
  assert.equal(history.current().tracks.length, 5);
  assert.equal(history.undo().tracks.length, 4);
  assert.equal(history.redo().tracks.length, 5);
});

test("video tracks always remain above audio tracks", () => {
  const normalized = normalizeAssemblyState({
    tracks: [
      { id: "a1", type: "audio", name: "A1" },
      { id: "v1", type: "video", name: "V1" },
      { id: "a2", type: "audio", name: "A2" },
      { id: "v2", type: "video", name: "V2" }
    ],
    media: []
  });
  assert.deepEqual(normalized.tracks.map((track) => track.id), ["v1", "v2", "a1", "a2"]);

  const withVideo = addAssemblyTrack(normalized, "video");
  assert.deepEqual(withVideo.tracks.map((track) => track.type), ["video", "video", "video", "audio", "audio"]);
  assert.equal(withVideo.tracks[2].name, "V3");
});

test("active clips resolve visual layers at the owned playhead", () => {
  const state = stateWithVideo();
  assert.equal(assemblyActiveClips(state, 2, "visual").length, 1);
  assert.equal(assemblyActiveClips(state, 9, "visual").length, 0);
});
