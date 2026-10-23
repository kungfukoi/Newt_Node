import test from "node:test";
import assert from "node:assert/strict";
import {
  assemblyActiveClips,
  createAssemblyState,
  importAssemblyOutputItem,
  insertAssemblyMediaClip,
  insertAssemblyMediaWithLinkedAudio,
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

test("disconnecting one video removes its bin entry and audio while preserving the remaining source", () => {
  const second = { ...connectedVideo, id: "second-edge", sourceNodeId: "second-video", url: "/outputs/second.mp4", hasAudio: true };
  let state = syncAssemblyInputs(createAssemblyState(), [{ ...connectedVideo, hasAudio: true }, second]);
  const firstId = state.media[0].id;
  const secondId = state.media[1].id;
  const trackId = state.tracks.find(track => track.type === "video").id;
  state = insertAssemblyMediaWithLinkedAudio(state, firstId, trackId, 0);
  state = insertAssemblyMediaWithLinkedAudio(state, secondId, trackId, 6);
  state = importAssemblyOutputItem(state, { type: "video", url: "/outputs/dropped.mp4" });
  const remainingClips = state.tracks.flatMap(track => track.clips).filter(clip => clip.mediaId === secondId);
  const removed = syncAssemblyInputs(JSON.parse(JSON.stringify(state)), [second]);
  assert.equal(removed.media.some(item => item.id === firstId || item.derivedFromMediaId === firstId), false);
  assert.equal(removed.media.some(item => item.derivedFromMediaId === secondId), true);
  assert.equal(removed.media.some(item => item.url === "/outputs/dropped.mp4"), true);
  assert.deepEqual(removed.tracks.flatMap(track => track.clips).filter(clip => clip.mediaId === secondId), remainingClips);
  const updated = syncAssemblyInputs(removed, [{ ...second, url: "/outputs/second-new.mp4" }]);
  assert.equal(updated.media.find(item => item.id === secondId).url, "/outputs/second-new.mp4");
  const empty = syncAssemblyInputs(updated, []);
  assert.deepEqual(empty.media.map(item => item.url), ["/outputs/dropped.mp4"]);
  assert.equal(empty.tracks.flatMap(track => track.clips).length, 0);
});

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


test("multiple videos on one source port keep independent linked bin entries", () => {
  const inputs = [0, 1, 2].map(index => ({ ...connectedVideo,
    id: `edge-video-1:${index}`, sourceItemIndex: index,
    url: `/outputs/shot-${index}.mp4`
  }));
  const state = syncAssemblyInputs(createAssemblyState(), inputs);
  assert.deepEqual(state.media.map(item => item.url), inputs.map(item => item.url));
  const restored = JSON.parse(JSON.stringify(state));
  const updated = syncAssemblyInputs(restored, inputs.map(item => ({ ...item, url: item.url.replace('shot-', 'new-') })));
  assert.equal(updated.media.length, 3);
  assert.deepEqual(updated.media.map(item => item.id), state.media.map(item => item.id));
  assert.deepEqual(updated.media.map(item => item.url), inputs.map(item => item.url.replace('shot-', 'new-')));
});
