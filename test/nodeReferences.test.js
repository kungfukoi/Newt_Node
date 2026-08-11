import test from "node:test";
import assert from "node:assert/strict";
import {
  findNodeReferenceMentions,
  nodeReferenceBindingKey,
  renameBoundNodeReferenceTokenInData,
  replaceNodeReferenceToken
} from "../src/nodeReferences.js";

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

test("findNodeReferenceMentions honors a saved node-id binding after the node is renamed", () => {
  const renamedNodes = [
    { id: "node-a", type: "image", data: { title: "Renamed Product" } },
    { id: "node-b", type: "image", data: { title: "Hero Product" } }
  ];
  const matches = findNodeReferenceMentions("Use @Hero Product.", renamedNodes, {
    bindings: { "hero product": "node-a" }
  });

  assert.deepEqual(matches.map((match) => match.nodeId), ["node-a"]);
});

test("findNodeReferenceMentions uses node rank to disambiguate duplicate display names", () => {
  const duplicateNodes = [
    { id: "far", type: "video", data: { title: "Depth" } },
    { id: "near", type: "video", data: { title: "Depth" } }
  ];
  const matches = findNodeReferenceMentions("Use @depth.", duplicateNodes, {
    rankForNode: (node) => node.id === "near" ? 100 : 0
  });

  assert.deepEqual(matches.map((match) => match.nodeId), ["near"]);
  assert.equal(nodeReferenceBindingKey(matches[0].mention), "depth");
});

test("replaceNodeReferenceToken updates the visible token without touching surrounding text", () => {
  assert.equal(
    replaceNodeReferenceToken("Match @depth, then keep @depthMap unchanged.", "depth", "dogpile"),
    "Match @dogpile, then keep @depthMap unchanged."
  );
});

test("renaming a bound node updates visible tokens while preserving the node id", () => {
  const data = renameBoundNodeReferenceTokenInData({
    prompt: "Match @depth for camera motion.",
    storyboardFrames: [{ prompt: "Preserve @depth." }],
    nodeReferenceBindings: { depth: "node-depth" }
  }, "node-depth", "dogpile");

  assert.equal(data.prompt, "Match @dogpile for camera motion.");
  assert.equal(data.storyboardFrames[0].prompt, "Preserve @dogpile.");
  assert.deepEqual(data.nodeReferenceBindings, { dogpile: "node-depth" });
});
