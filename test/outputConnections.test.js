import assert from "node:assert/strict";
import test from "node:test";
import { isOutputSinkConnection, outputAcceptedSourceKinds } from "../src/outputConnections.js";

test("Output accepts every Newt Node output port kind", () => {
  assert.deepEqual(outputAcceptedSourceKinds, [
    "prompt",
    "image",
    "camera",
    "style",
    "transfer",
    "character",
    "director",
    "video",
    "audio",
    "model3d"
  ]);

  outputAcceptedSourceKinds.forEach((sourceKind) => {
    assert.equal(isOutputSinkConnection("output", "sourceIn", sourceKind), true);
  });
});

test("Output sink matching stays limited to the Output Source port", () => {
  assert.equal(isOutputSinkConnection("preview", "sourceIn", "image"), false);
  assert.equal(isOutputSinkConnection("output", "imageIn", "image"), false);
  assert.equal(isOutputSinkConnection("output", "sourceIn", "preview"), false);
});
