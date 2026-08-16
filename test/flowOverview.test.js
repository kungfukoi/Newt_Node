import assert from "node:assert/strict";
import test from "node:test";
import {
  flowDetailEnterZoomThreshold,
  flowDetailExitZoomThreshold,
  flowMapEnterZoomThreshold,
  flowMapExitZoomThreshold,
  flowOverviewNodeCountThreshold,
  flowRenderMode,
  shouldUseFlowOverview
} from "../src/flowOverview.js";

test("large workflows enter map rendering at the distant zoom threshold", () => {
  assert.equal(flowRenderMode(271, flowMapEnterZoomThreshold, "compact"), "map");
  assert.equal(shouldUseFlowOverview(271, flowMapEnterZoomThreshold - 0.01, "compact"), true);
});

test("map rendering uses an exit threshold to prevent zoom-boundary flapping", () => {
  assert.equal(flowRenderMode(271, flowMapExitZoomThreshold - 0.01, "map"), "map");
  assert.equal(flowRenderMode(271, flowMapExitZoomThreshold, "map"), "compact");
});

test("detail rendering uses separate enter and exit thresholds", () => {
  assert.equal(flowRenderMode(271, flowDetailEnterZoomThreshold, "compact"), "detail");
  assert.equal(flowRenderMode(271, flowDetailExitZoomThreshold + 0.01, "detail"), "detail");
  assert.equal(flowRenderMode(271, flowDetailExitZoomThreshold, "detail"), "compact");
});

test("the middle zoom range uses the compact canvas renderer", () => {
  assert.equal(flowRenderMode(271, 0.2, "map"), "compact");
  assert.equal(flowRenderMode(271, 0.2, "detail"), "compact");
});

test("small workflows keep complete nodes at every supported zoom", () => {
  assert.equal(flowRenderMode(flowOverviewNodeCountThreshold - 1, 0.05), "detail");
});
