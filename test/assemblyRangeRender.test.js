import assert from "node:assert/strict";
import test from "node:test";

import { buildAssemblyFfmpegArgs, createAssemblyRenderPlan } from "../server/assembly-render.js";
import {
  createAssemblyState,
  insertAssemblyMediaClip,
  setAssemblyInPoint,
  setAssemblyOutPoint,
  syncAssemblyInputs,
  updateAssemblyClip,
  updateAssemblyMedia
} from "../src/assembly/assemblyState.js";

function rangedVideoState({ reverse = false } = {}) {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", sourceNodeId: "v", sourcePort: "videoOut", url: "/v.mp4", type: "video", duration: 10 }
  ]);
  state = updateAssemblyMedia(state, "video", { duration: 10, hasAudio: true });
  const videoTrack = state.tracks.find((track) => track.type === "video");
  state = insertAssemblyMediaClip(state, "video", videoTrack.id, 0);
  const clip = state.tracks.flatMap((track) => track.clips).find((item) => item.mediaId === "video");
  state = updateAssemblyClip(state, clip.id, { reverse });
  state = setAssemblyInPoint(state, 2);
  return setAssemblyOutPoint(state, 6);
}

test("Timeline render defaults to the active In and Out range", () => {
  const plan = createAssemblyRenderPlan(rangedVideoState(), [
    { id: "video", filePath: "C:/media/v.mp4", hasAudio: true }
  ]);

  assert.equal(plan.usesRange, true);
  assert.equal(plan.rangeStart, 2);
  assert.equal(plan.rangeEnd, 6);
  assert.equal(plan.duration, 4);
  assert.equal(plan.visualClips[0].clip.start, 0);
  assert.equal(plan.visualClips[0].clip.duration, 4);
  assert.equal(plan.visualClips[0].clip.sourceIn, 2);

  const args = buildAssemblyFfmpegArgs(plan, "C:/out/range.mp4");
  assert.equal(args[args.indexOf("-ss") + 1], "2.000000");
  assert.equal(args[args.lastIndexOf("-t") + 1], "4.000000");
  assert.match(args[args.indexOf("-filter_complex") + 1], /adelay=0:all=1/);
});

test("Timeline range rendering trims reversed clips from the correct source edge", () => {
  const plan = createAssemblyRenderPlan(rangedVideoState({ reverse: true }), [
    { id: "video", filePath: "C:/media/v.mp4", hasAudio: true }
  ]);

  assert.equal(plan.visualClips[0].clip.sourceIn, 4);
  assert.equal(plan.visualClips[0].clip.duration, 4);
  assert.match(buildAssemblyFfmpegArgs(plan, "C:/out/reverse-range.mp4").join(" "), /reverse/);
});
