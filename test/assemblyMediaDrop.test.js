import test from "node:test";
import assert from "node:assert/strict";
import { createAssemblyState, importAssemblyOutputItem, insertAssemblyMediaClip, removeAssemblyMedia } from "../src/assembly/assemblyState.js";

const videoOutput = {
  id: "video-node-1:/outputs/shot.mp4",
  sourceNodeId: "video-node-1",
  sourcePort: "videoOut",
  url: "/outputs/shot.mp4",
  type: "video",
  label: "Shot",
  fileName: "shot.mp4",
  mimeType: "video/mp4"
};

test("dropping a Video output imports it into the Timeline media bin", () => {
  const state = importAssemblyOutputItem(createAssemblyState(), videoOutput);
  assert.equal(state.media.length, 1);
  assert.deepEqual(
    {
      sourceNodeId: state.media[0].sourceNodeId,
      sourcePort: state.media[0].sourcePort,
      url: state.media[0].url,
      type: state.media[0].type
    },
    {
      sourceNodeId: "video-node-1",
      sourcePort: "videoOut",
      url: "/outputs/shot.mp4",
      type: "video"
    }
  );
});

test("repeated drops of the same output do not duplicate bin media", () => {
  const first = importAssemblyOutputItem(createAssemblyState(), videoOutput);
  const second = importAssemblyOutputItem(first, { ...videoOutput, id: "another-drag-id" });
  assert.equal(second.media.length, 1);
});

test("a directly dropped output and its later connection share one bin asset", () => {
  const dropped = importAssemblyOutputItem(createAssemblyState(), { ...videoOutput, sourceNodeId: "", sourcePort: "videoOut" });
  const connected = importAssemblyOutputItem(dropped, videoOutput);
  assert.equal(connected.media.length, 1);
});

test("Timeline direct drops reject unsupported output types", () => {
  const state = createAssemblyState();
  assert.equal(importAssemblyOutputItem(state, { ...videoOutput, type: "model3d", url: "/outputs/model.glb" }).media.length, 0);
});

test("removing Timeline bin media also removes every clip that uses it", () => {
  const imported = importAssemblyOutputItem(createAssemblyState(), videoOutput);
  const mediaId = imported.media[0].id;
  const videoTrackId = imported.tracks.find((track) => track.type === "video").id;
  const withClip = insertAssemblyMediaClip(imported, mediaId, videoTrackId, 0);
  const removed = removeAssemblyMedia(withClip, mediaId);

  assert.equal(removed.media.length, 0);
  assert.equal(removed.tracks.flatMap((track) => track.clips).length, 0);
  assert.equal(removed.selectedClipId, "");
});

test("extracted stills prepend to the bin without changing clips or playhead", () => {
  let state = importAssemblyOutputItem(createAssemblyState(), videoOutput);
  state = insertAssemblyMediaClip(state, state.media[0].id, state.tracks[0].id, 2);
  const before = structuredClone(state);
  const first = importAssemblyOutputItem(state, { url: "/outputs/frame-one.png", type: "image", width: 1920, height: 1080 }, { prepend: true });
  const second = importAssemblyOutputItem(first, { url: "/outputs/frame-two.png", type: "image" }, { prepend: true });
  assert.deepEqual(second.media.map(media => media.url), ["/outputs/frame-two.png", "/outputs/frame-one.png", videoOutput.url]);
  assert.deepEqual(second.tracks, state.tracks);
  assert.equal(second.playhead, state.playhead);
  assert.equal(second.media[1].width, 1920);
  assert.equal(second.media[1].linkedSource, false);
  assert.deepEqual(state, before);
});
