import test from "node:test";
import assert from "node:assert/strict";
import {
  assemblyActiveClips,
  createAssemblyClipClipboard,
  createAssemblyState,
  insertAssemblyMediaClip,
  insertAssemblyMediaWithLinkedAudio,
  moveAssemblyClip,
  pasteAssemblyClip,
  removeAssemblyClip,
  retimeAssemblyClip,
  splitAssemblyClip,
  syncAssemblyInputs,
  trimAssemblyClip,
  updateAssemblyMedia,
  updateAssemblyTrack
} from "../src/assembly/assemblyState.js";
import { createAssemblyRenderPlan } from "../server/assembly-render.js";

test("realtime audio selection follows video-track mute independently from visibility", () => {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", sourceNodeId: "video", sourcePort: "videoOut", url: "/video.mp4", type: "video", duration: 3 }
  ]);
  state = updateAssemblyMedia(state, "video", { duration: 3, hasAudio: true });
  const videoTrack = state.tracks.find((track) => track.type === "video");
  state = insertAssemblyMediaClip(state, "video", videoTrack.id, 0);
  assert.equal(assemblyActiveClips(state, 1, "visual").length, 1);
  assert.equal(assemblyActiveClips(state, 1, "audio").length, 1);

  state = updateAssemblyTrack(state, videoTrack.id, { muted: true });
  assert.equal(assemblyActiveClips(state, 1, "visual").length, 1);
  assert.equal(assemblyActiveClips(state, 1, "audio").length, 0);

  state = updateAssemblyTrack(state, videoTrack.id, { hidden: true, muted: false });
  assert.equal(assemblyActiveClips(state, 1, "visual").length, 0);
  assert.equal(assemblyActiveClips(state, 1, "audio").length, 1);
});

test("Timeline accepts a video container through an embedded-audio output", () => {
  const state = syncAssemblyInputs(createAssemblyState(), [{
    id: "video-audio-edge",
    sourceNodeId: "video-model",
    sourcePort: "audioOut",
    sourcePortTarget: "audioIn",
    url: "/dialogue-take.mp4",
    type: "audio",
    fileName: "dialogue-take.mp4",
    mimeType: "video/mp4",
    duration: 5,
    hasAudio: true
  }]);

  assert.equal(state.media.length, 1);
  assert.equal(state.media[0].type, "audio");
  assert.equal(state.media[0].url, "/dialogue-take.mp4");
  assert.equal(state.tracks.some((track) => track.type === "audio"), true);
});

test("dropping a video with embedded audio creates linked video and audio clips", () => {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", sourceNodeId: "video-model", sourcePort: "videoOut", url: "/dialogue.mp4", type: "video", duration: 5 }
  ]);
  state = updateAssemblyMedia(state, "video", { duration: 5, hasAudio: true, hasAudioKnown: true, waveformUrl: "/dialogue-waveform.png" });
  const videoTrack = state.tracks.find((track) => track.type === "video");
  state = insertAssemblyMediaWithLinkedAudio(state, "video", videoTrack.id, 2);

  const videoClip = state.tracks.flatMap((track) => track.clips).find((clip) => clip.mediaId === "video");
  const audioMedia = state.media.find((media) => media.derivedFromMediaId === "video");
  const audioClip = state.tracks.flatMap((track) => track.clips).find((clip) => clip.mediaId === audioMedia.id);
  assert.equal(audioMedia.type, "audio");
  assert.equal(audioMedia.url, "/dialogue.mp4");
  assert.equal(audioMedia.waveformUrl, "/dialogue-waveform.png");
  assert.equal(videoClip.linkGroupId, audioClip.linkGroupId);
  assert.equal(audioClip.start, 2);
  assert.equal(audioClip.duration, 5);
  assert.equal(assemblyActiveClips(state, 3, "audio").length, 1);
});

test("a completed media probe adds linked audio to video clips already on the Timeline", () => {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", sourceNodeId: "video", sourcePort: "videoOut", url: "/late-audio.mp4", type: "video", duration: 4 }
  ]);
  const videoTrack = state.tracks.find((track) => track.type === "video");
  state = insertAssemblyMediaClip(state, "video", videoTrack.id, 0);
  assert.equal(state.tracks.filter((track) => track.type === "audio").flatMap((track) => track.clips).length, 0);

  state = updateAssemblyMedia(state, "video", { duration: 4, hasAudio: true, hasAudioKnown: true });
  assert.equal(state.tracks.filter((track) => track.type === "audio").flatMap((track) => track.clips).length, 1);
});

test("a silent replacement removes its derived audio and can regain linked audio later", () => {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", sourceNodeId: "video", sourcePort: "videoOut", url: "/with-audio.mp4", type: "video", duration: 4 }
  ]);
  state = updateAssemblyMedia(state, "video", { duration: 4, hasAudio: true, hasAudioKnown: true });
  const videoTrack = state.tracks.find((track) => track.type === "video");
  state = insertAssemblyMediaWithLinkedAudio(state, "video", videoTrack.id, 0);

  state = updateAssemblyMedia(state, "video", { hasAudio: false, hasAudioKnown: true });
  const videoClip = state.tracks.flatMap((track) => track.clips).find((clip) => clip.mediaId === "video");
  assert.equal(state.media.some((media) => media.derivedFromMediaId === "video"), false);
  assert.equal(state.tracks.filter((track) => track.type === "audio").flatMap((track) => track.clips).length, 0);
  assert.equal(videoClip.linkGroupId, "");

  state = updateAssemblyMedia(state, "video", { hasAudio: true, hasAudioKnown: true });
  assert.equal(state.media.some((media) => media.derivedFromMediaId === "video"), true);
  assert.equal(state.tracks.filter((track) => track.type === "audio").flatMap((track) => track.clips).length, 1);
});

test("regenerated connected video sources update their linked audio media", () => {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", sourceNodeId: "video-model", sourcePort: "videoOut", url: "/first.mp4", type: "video", duration: 4 }
  ]);
  state = updateAssemblyMedia(state, "video", { duration: 4, hasAudio: true, hasAudioKnown: true, waveformUrl: "/first-waveform.png" });
  const videoTrack = state.tracks.find((track) => track.type === "video");
  state = insertAssemblyMediaWithLinkedAudio(state, "video", videoTrack.id, 0);

  state = syncAssemblyInputs(state, [
    { id: "replacement-id", sourceNodeId: "video-model", sourcePort: "videoOut", url: "/second.mp4", type: "video", duration: 6 }
  ]);
  let audioMedia = state.media.find((media) => media.derivedFromMediaId === "video");
  assert.equal(audioMedia.url, "/second.mp4");
  assert.equal(audioMedia.waveformUrl, "");

  state = updateAssemblyMedia(state, "video", { duration: 6, hasAudio: true, hasAudioKnown: true, waveformUrl: "/second-waveform.png" });
  audioMedia = state.media.find((media) => media.derivedFromMediaId === "video");
  assert.equal(audioMedia.url, "/second.mp4");
  assert.equal(audioMedia.duration, 6);
  assert.equal(audioMedia.waveformUrl, "/second-waveform.png");
});

test("linked video and audio clips edit, copy, render, and delete as one unit", () => {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", sourceNodeId: "video", sourcePort: "videoOut", url: "/linked.mp4", type: "video", duration: 8 }
  ]);
  state = updateAssemblyMedia(state, "video", { duration: 8, hasAudio: true, hasAudioKnown: true });
  const videoTracks = state.tracks.filter((track) => track.type === "video");
  state = insertAssemblyMediaWithLinkedAudio(state, "video", videoTracks[0].id, 0);
  const videoClip = state.tracks.flatMap((track) => track.clips).find((clip) => clip.mediaId === "video");

  state = moveAssemblyClip(state, videoClip.id, videoTracks[1].id, 3);
  state = trimAssemblyClip(state, videoClip.id, "right", 9, false);
  state = retimeAssemblyClip(state, videoClip.id, 200, false);
  let linked = state.tracks.flatMap((track) => track.clips).filter((clip) => clip.linkGroupId === videoClip.linkGroupId);
  assert.deepEqual(linked.map((clip) => clip.start), [3, 3]);
  assert.deepEqual(linked.map((clip) => clip.duration), [3, 3]);
  assert.deepEqual(linked.map((clip) => clip.speed), [200, 200]);

  const clipboard = createAssemblyClipClipboard(state, videoClip.id);
  state = pasteAssemblyClip(state, clipboard, 10);
  const pasted = state.tracks.flatMap((track) => track.clips).filter((clip) => clip.id === state.selectedClipId || (clip.linkGroupId && clip.linkGroupId === state.tracks.flatMap((track) => track.clips).find((item) => item.id === state.selectedClipId)?.linkGroupId));
  assert.equal(pasted.length, 2);
  assert.deepEqual(pasted.map((clip) => clip.start), [10, 10]);

  const split = splitAssemblyClip(state, videoClip.id, 4);
  assert.equal(split.tracks.flatMap((track) => track.clips).length, 6);

  const audioMedia = state.media.find((media) => media.derivedFromMediaId === "video");
  const plan = createAssemblyRenderPlan(state, [
    { id: "video", filePath: "C:/media/linked.mp4", hasAudio: true },
    { id: audioMedia.id, filePath: "C:/media/linked.mp4", hasAudio: true }
  ]);
  assert.equal(plan.visualClips.length, 2);
  assert.equal(plan.audioClips.length, 2);

  const removed = removeAssemblyClip(state, videoClip.id, false);
  assert.equal(removed.tracks.flatMap((track) => track.clips).length, 2);
});
