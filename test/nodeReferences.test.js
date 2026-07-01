import test from "node:test";
import assert from "node:assert/strict";
import { findNodeReferenceMentions } from "../src/nodeReferences.js";

const nodes = [
  { id: "node-a", type: "image", data: { title: "Hero Product" } },
  { id: "node-b", type: "text", data: { title: "Shot Notes" } },
  { id: "node-c", type: "video", data: { title: "Hero" } }
];

test("findNodeReferenceMentions matches exact node names with spaces", () => {
  const matches = findNodeReferenceMentions("Use (@Hero Product) and @Shot Notes.", nodes);
  assert.deepEqual(matches.map((match) => [match.nodeId, match.mention]), [
    ["node-a", "@Hero Product"],
    ["node-b", "@Shot Notes"]
  ]);
});

test("findNodeReferenceMentions prefers longest node names", () => {
  const matches = findNodeReferenceMentions("Use @Hero Product, not only @Hero.", nodes);
  assert.deepEqual(matches.map((match) => match.nodeId), ["node-a", "node-c"]);
});

test("findNodeReferenceMentions supports compact and dashed title aliases", () => {
  const matches = findNodeReferenceMentions("Compare @HeroProduct with @Shot-Notes.", nodes);
  assert.deepEqual(matches.map((match) => match.nodeId), ["node-a", "node-b"]);
});

test("findNodeReferenceMentions ignores the current node", () => {
  const matches = findNodeReferenceMentions("Use @Shot Notes.", nodes, { currentNodeId: "node-b" });
  assert.equal(matches.length, 0);
});
