import assert from "node:assert/strict";
import test from "node:test";
import {
  canvasDistantZoomEnterThreshold,
  canvasDistantZoomExitThreshold,
  flowOnlyRenderVisibleElements,
  flowOverviewEnabled,
  flowRenderMode,
  shouldUseDistantCanvasVisuals,
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

test("distant canvas visuals use hysteresis around the legacy 15% boundary", () => {
  assert.equal(canvasDistantZoomEnterThreshold, 0.13);
  assert.equal(canvasDistantZoomExitThreshold, 0.17);
  assert.equal(shouldUseDistantCanvasVisuals(0.15, false), false);
  assert.equal(shouldUseDistantCanvasVisuals(0.12, false), true);
  assert.equal(shouldUseDistantCanvasVisuals(0.15, true), true);
  assert.equal(shouldUseDistantCanvasVisuals(0.18, true), false);
});
