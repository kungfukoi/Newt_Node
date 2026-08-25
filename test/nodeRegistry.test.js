import test from "node:test";
import assert from "node:assert/strict";
import { nodeTypeDefinitions, nodeTypeLabel, timelineNodeTitle } from "../src/nodeRegistry.js";

test("Coverage appears directly beneath Storyboard in the node sidebar", () => {
  const storyboardIndex = nodeTypeDefinitions.findIndex(({ type }) => type === "storyboard");
  assert.notEqual(storyboardIndex, -1);
  assert.equal(nodeTypeDefinitions[storyboardIndex + 1]?.type, "coverage");
});

test("Text Agent appears alongside Text Model without replacing saved Text Model nodes", () => {
  const textModelIndex = nodeTypeDefinitions.findIndex(({ type }) => type === "text");
  assert.notEqual(textModelIndex, -1);
  assert.equal(nodeTypeDefinitions[textModelIndex + 1]?.type, "textAgent");
  assert.equal(nodeTypeLabel("textAgent"), "Text Agent");
});


test("Timeline is the public label for the legacy assembly node type", () => {
  assert.equal(nodeTypeLabel("assembly"), "Timeline");
});

test("legacy default Assembly titles migrate to Timeline without changing custom names", () => {
  assert.equal(timelineNodeTitle("Assembly"), "Timeline");
  assert.equal(timelineNodeTitle("Assembly 3"), "Timeline 3");
  assert.equal(timelineNodeTitle("My Rough Cut"), "My Rough Cut");
});
