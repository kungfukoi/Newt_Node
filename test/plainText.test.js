import test from "node:test";
import assert from "node:assert/strict";
import { concatenatePlainTextInputs, textOutputForNode, wouldCreatePlainTextCycle } from "../src/plainText.js";

test("Text inputs concatenate in connection order before the node's own text", () => {
  const inputs = [
    { source: { type: "plainText", data: { text: "First" } } },
    { source: { type: "text", data: { text: "Draft", resultText: "Second" } } },
    { source: { type: "textAgent", data: { resultText: "Third" } } }
  ];

  assert.equal(concatenatePlainTextInputs(inputs, "Fourth"), "First\nSecond\nThird\nFourth");
});

test("Text output prefers a concatenated result while preserving an unconnected fallback", () => {
  assert.equal(textOutputForNode({ type: "plainText", data: { text: "Local", resultText: "Combined" } }), "Combined");
  assert.equal(textOutputForNode({ type: "plainText", data: { text: "Local" } }), "Local");
  assert.equal(concatenatePlainTextInputs([{ source: { type: "plainText", data: { text: "" } } }], "Local"), "Local");
});

test("Text input chains reject only connections that would create a cycle", () => {
  const nodes = [
    { id: "a", type: "plainText" },
    { id: "b", type: "plainText" },
    { id: "c", type: "plainText" }
  ];
  const edges = [
    { from: { nodeId: "a", port: "promptOut" }, to: { nodeId: "b", port: "textIn" } },
    { from: { nodeId: "b", port: "promptOut" }, to: { nodeId: "c", port: "textIn" } }
  ];

  assert.equal(wouldCreatePlainTextCycle({ edges, nodes, sourceNodeId: "c", targetNodeId: "a" }), true);
  assert.equal(wouldCreatePlainTextCycle({ edges, nodes, sourceNodeId: "a", targetNodeId: "c" }), false);
});
