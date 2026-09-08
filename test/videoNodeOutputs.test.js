import test from "node:test";
import assert from "node:assert/strict";

import {
  embeddedAudioOutputPortId,
  videoNodeOutputKind,
  videoNodeOutputLabel,
  videoNodeOutputPortDefinitions,
  videoOutputPortId
} from "../src/videoNodeOutputs.js";

test("video nodes expose video followed by embedded audio outputs", () => {
  assert.deepEqual(videoNodeOutputPortDefinitions({ video: "green", audio: "orange" }), [
    { id: videoOutputPortId, label: "Video", color: "green" },
    { id: embeddedAudioOutputPortId, label: "Audio", color: "orange" }
  ]);
});

test("video and video model audio ports resolve as audio", () => {
  assert.equal(videoNodeOutputKind("video", videoOutputPortId), "video");
  assert.equal(videoNodeOutputKind("video", embeddedAudioOutputPortId), "audio");
  assert.equal(videoNodeOutputKind("videoModel", embeddedAudioOutputPortId), "audio");
  assert.equal(videoNodeOutputKind("image", embeddedAudioOutputPortId), "");
});

test("embedded audio output labels identify the source node", () => {
  const node = { type: "videoModel", data: { title: "Dialogue Take" } };
  assert.equal(videoNodeOutputLabel(node, embeddedAudioOutputPortId), "Dialogue Take audio");
  assert.equal(videoNodeOutputLabel(node, videoOutputPortId), "");
});
