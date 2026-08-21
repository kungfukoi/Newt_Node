import test from "node:test";
import assert from "node:assert/strict";
import { buildAssemblyFfmpegArgs, createAssemblyRenderPlan } from "../server/assembly-render.js";
import { createAssemblyState, insertAssemblyMediaClip, syncAssemblyInputs, updateAssemblyMedia } from "../src/assembly/assemblyState.js";

test("timeline render plan keeps multiple visual and audio tracks", () => {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", sourceNodeId: "v", sourcePort: "videoOut", url: "/v.mp4", type: "video", duration: 4 },
    { id: "audio", sourceNodeId: "a", sourcePort: "audioOut", url: "/a.wav", type: "audio", duration: 6 },
    { id: "still", sourceNodeId: "i", sourcePort: "imageOut", url: "/i.png", type: "image", duration: 5 }
  ]);
  state = updateAssemblyMedia(state, "video", { duration: 4, hasAudio: true });
  const videoTracks = state.tracks.filter((track) => track.type === "video");
  const audioTrack = state.tracks.find((track) => track.type === "audio");
  state = insertAssemblyMediaClip(state, "video", videoTracks[0].id, 0);
  state = insertAssemblyMediaClip(state, "still", videoTracks[1].id, 0);
  state = insertAssemblyMediaClip(state, "audio", audioTrack.id, 0);
  const resolved = [
    { id: "video", filePath: "C:/media/v.mp4", hasAudio: true },
    { id: "audio", filePath: "C:/media/a.wav", hasAudio: true },
    { id: "still", filePath: "C:/media/i.png", hasAudio: false }
  ];
  const plan = createAssemblyRenderPlan(state, resolved);
  assert.equal(plan.inputs.length, 3);
  assert.equal(plan.visualClips.length, 2);
  assert.equal(plan.audioClips.length, 2);
  const args = buildAssemblyFfmpegArgs(plan, "C:/out/render.mp4");
  const filter = args[args.indexOf("-filter_complex") + 1];
  assert.match(filter, /overlay=/);
  assert.match(filter, /amix=inputs=2/);
  assert.equal(args.at(-1), "C:/out/render.mp4");
});
