import test from "node:test";
import assert from "node:assert/strict";
import { assemblyOutputPortState, selectAssemblyPreviewSource } from "../src/assembly/assemblyPreview.js";

test("Timeline frameOut remains connectable before the first playhead frame", () => {
  assert.equal(assemblyOutputPortState("frameOut", "").disabled, false);
  assert.equal(assemblyOutputPortState("videoOut", "").disabled, true);
  assert.equal(assemblyOutputPortState("videoOut", "/render.mp4").disabled, false);
});

test("Timeline live preview prefers frameOut when render and frame outputs share a Preview", () => {
  const sources = [
    { id: "assembly-1:videoOut", sourceNodeId: "assembly-1", sourcePort: "videoOut" },
    { id: "assembly-1:frameOut", sourceNodeId: "assembly-1", sourcePort: "frameOut" }
  ];
  assert.equal(selectAssemblyPreviewSource(sources, "assembly-1")?.sourcePort, "frameOut");
});
