import test from "node:test";
import assert from "node:assert/strict";
import {
  assemblyActiveClips,
  createAssemblyState,
  importAssemblyOutputItem,
  insertAssemblyMediaClip,
  syncAssemblyInputs
} from "../src/assembly/assemblyState.js";

const connectedVideo = {
  id: "edge-video-1",
  sourceNodeId: "video-model-1",
  sourcePort: "videoOut",
  type: "video",
  url: "/outputs/generation-v1.mp4",
  duration: 5,
  label: "Video Model 1"
};

test("connected Timeline media updates in place when its source regenerates", () => {
  const synced = syncAssemblyInputs(createAssemblyState(), [connectedVideo]);
  const mediaId = synced.media[0].id;
  const videoTrack = synced.tracks.find((track) => track.type === "video");
  const withClip = insertAssemblyMediaClip(synced, mediaId, videoTrack.id, 0);
  const regenerated = syncAssemblyInputs(withClip, [{
    ...connectedVideo,
    id: "replacement-edge-id",
    url: "/outputs/generation-v2.mp4",
    fileName: "generation-v2.mp4"
  }]);

  assert.equal(regenerated.media.length, 1);
  assert.equal(regenerated.media[0].id, mediaId);
  assert.equal(regenerated.media[0].linkedSource, true);
  assert.equal(regenerated.media[0].url, "/outputs/generation-v2.mp4");
  assert.equal(regenerated.tracks.find((track) => track.id === videoTrack.id).clips[0].mediaId, mediaId);
  assert.equal(assemblyActiveClips(regenerated, 1, "visual")[0].media.url, "/outputs/generation-v2.mp4");
});

test("directly dropped generations remain independent Timeline snapshots", () => {
  const first = importAssemblyOutputItem(createAssemblyState(), connectedVideo);
  const second = importAssemblyOutputItem(first, {
    ...connectedVideo,
    id: "dragged-generation-v2",
    url: "/outputs/generation-v2.mp4"
  });

  assert.equal(second.media.length, 2);
  assert.deepEqual(second.media.map((item) => item.linkedSource), [false, false]);
  assert.deepEqual(second.media.map((item) => item.url), [
    "/outputs/generation-v1.mp4",
    "/outputs/generation-v2.mp4"
  ]);
});

test("connecting an already dropped asset adopts it without breaking timeline clips", () => {
  const dropped = importAssemblyOutputItem(createAssemblyState(), connectedVideo);
  const mediaId = dropped.media[0].id;
  const videoTrack = dropped.tracks.find((track) => track.type === "video");
  const withClip = insertAssemblyMediaClip(dropped, mediaId, videoTrack.id, 0);
  const connected = syncAssemblyInputs(withClip, [connectedVideo]);
  const regenerated = syncAssemblyInputs(connected, [{ ...connectedVideo, url: "/outputs/generation-v2.mp4" }]);

  assert.equal(regenerated.media.length, 1);
  assert.equal(regenerated.media[0].id, mediaId);
  assert.equal(regenerated.media[0].url, "/outputs/generation-v2.mp4");
  assert.equal(regenerated.tracks.find((track) => track.id === videoTrack.id).clips[0].mediaId, mediaId);
});
