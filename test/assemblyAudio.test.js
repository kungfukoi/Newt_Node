import test from "node:test";
import assert from "node:assert/strict";
import { assemblyActiveClips, createAssemblyState, insertAssemblyMediaClip, syncAssemblyInputs, updateAssemblyMedia, updateAssemblyTrack } from "../src/assembly/assemblyState.js";

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

\n