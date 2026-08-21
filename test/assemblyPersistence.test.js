import test from "node:test";
import assert from "node:assert/strict";
import { cloneNode, workflowStateFingerprint } from "../src/workflowState.js";

function assemblyNode(frameUrl) {
  return {
    id: "assembly-1",
    type: "assembly",
    x: 0,
    y: 0,
    data: {
      title: "Timeline",
      assembly: { version: 1, playhead: 2, tracks: [], media: [] },
      assemblyFrameUrl: frameUrl,
      assemblyFrameTime: 2
    }
  };
}

test("Timeline playhead frames remain runtime-only in workflow clones and fingerprints", () => {
  const first = assemblyNode("data:image/jpeg;base64,first");
  const second = assemblyNode("data:image/jpeg;base64,second");
  assert.equal(cloneNode(first).data.assemblyFrameUrl, "");
  assert.equal(cloneNode(first).data.assemblyFrameTime, 0);
  assert.equal(
    workflowStateFingerprint({ nodes: [first] }),
    workflowStateFingerprint({ nodes: [second] })
  );
});
