import test from "node:test";
import assert from "node:assert/strict";
import { catalogNodeTypeDefinitions, nodeTypeLabel, timelineNodeTitle } from "../src/nodeRegistry.js";

test("consolidated legacy node types remain loadable but are hidden from the catalog", () => {
  assert.equal(nodeTypeLabel("autoAspect"), "Auto Aspect");
  assert.equal(nodeTypeLabel("coverage"), "Coverage");
  assert.equal(catalogNodeTypeDefinitions.some(({ type }) => type === "autoAspect"), false);
  assert.equal(catalogNodeTypeDefinitions.some(({ type }) => type === "coverage"), false);
  assert.equal(nodeTypeLabel("frameIt"), "Frame It");
  assert.equal(catalogNodeTypeDefinitions.some(({ type }) => type === "frameIt"), false);
});


test("Timeline is the public label for the legacy assembly node type", () => {
  assert.equal(nodeTypeLabel("assembly"), "Timeline");
});

test("legacy default Assembly titles migrate to Timeline without changing custom names", () => {
  assert.equal(timelineNodeTitle("Assembly"), "Timeline");
  assert.equal(timelineNodeTitle("Assembly 3"), "Timeline 3");
  assert.equal(timelineNodeTitle("My Rough Cut"), "My Rough Cut");
});
