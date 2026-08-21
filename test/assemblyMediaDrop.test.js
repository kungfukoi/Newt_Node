import test from "node:test";
import assert from "node:assert/strict";
import { createAssemblyState, importAssemblyOutputItem } from "../src/assembly/assemblyState.js";

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
