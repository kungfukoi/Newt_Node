import assert from "node:assert/strict";
import test from "node:test";
import {
  flowOnlyRenderVisibleElements,
  flowOverviewEnabled,
  flowRenderMode,
  shouldUseFlowOverview
} from "../src/flowOverview.js";

test("semantic proxy rendering is disabled at every workflow size and zoom", () => {
  assert.equal(flowOverviewEnabled, false);
  assert.equal(flowOnlyRenderVisibleElements, false);
  assert.equal(flowRenderMode(271, 0.28, "compact"), "detail");
  assert.equal(flowRenderMode(271, 0.05, "map"), "detail");
  assert.equal(flowRenderMode(1000, 0.001, "map"), "detail");
  assert.equal(shouldUseFlowOverview(1000, 0.001, "map"), false);
});

test("small workflows keep complete nodes at every supported zoom", () => {
  assert.equal(flowRenderMode(20, 0.05), "detail");
});
