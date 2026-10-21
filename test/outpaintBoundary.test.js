import test from "node:test";
import assert from "node:assert/strict";
import { boundaryRegions, measureBoundary, boundaryReport, improvesBoundary, overlapBlendFilters } from "../server/outpaint-boundary.js";

test("native-spacing strips detect a one-pixel matte throughout the clip", () => {
  const [region] = boundaryRegions({ width: 1080, height: 1920, outputWidth: 1080, outputHeight: 1920, sourceWidth: 1080, sourceHeight: 920, left: 0, top: 500 });
  assert.equal(region.height, 16); assert.match(region.filter, /crop=1080:16:0:492/);
  const clean = Buffer.alloc(region.stride * 3, 100), line = Buffer.from(clean);
  for (let f = 0; f < 3; f++) line.fill(180, f * region.stride + (region.radius - 1) * region.width * 3, f * region.stride + region.radius * region.width * 3);
  assert.equal(measureBoundary(clean, region, 3).worst, 0);
  assert.equal(measureBoundary(line, region, 3).worst, 80);
});

test("candidate selection rolls back a worse edge or flickering repair", () => {
  const report = (top, bottom, temporal = 0) => boundaryReport({ top: { mean: top, worst: top, temporal }, bottom: { mean: bottom, worst: bottom, temporal } });
  const baseline = report(20, 10);
  assert.equal(improvesBoundary(report(5, 5), baseline), true);
  assert.equal(improvesBoundary(report(2, 14), baseline), false);
  assert.equal(improvesBoundary(report(5, 5, 20), baseline), false);
  assert.equal(improvesBoundary(baseline, baseline), false);
});

test("inward blending cannot extrude edge colors or create an interior correction cut", () => {
  const filters = overlapBlendFilters({ w: 1080, h: 1920, sw: 1080, sh: 920, x: 0, y: 500, feather: 32, colorWidth: 128 }).join(";");
  assert.doesNotMatch(filters, /crop=|gblur|interiorMatched|delta-|lutrgb/);
  assert.match(filters, /overlay=0:500/);
  assert.match(filters, /max\(0,min\(Y,919-Y\)\)\/32/);
  assert.match(filters, /yuva444p10le/);
});
