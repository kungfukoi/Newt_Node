import assert from "node:assert/strict";
import test from "node:test";

import { assemblyTimeAtClientX } from "../src/assembly/assemblyPointer.js";
import {
  assemblyRulerSpacing,
  maximumAssemblyZoom,
  minimumAssemblyZoom,
  normalizeAssemblyZoom,
  stepAssemblyZoom
} from "../src/assembly/assemblyZoom.js";

test("Timeline zoom steps beyond the former slider range", () => {
  assert.ok(stepAssemblyZoom(24, -1) < 24);
  assert.ok(stepAssemblyZoom(360, 1) > 360);
});

test("Timeline zoom remains bounded only at practical extreme scales", () => {
  assert.equal(normalizeAssemblyZoom(0), minimumAssemblyZoom);
  assert.equal(normalizeAssemblyZoom(Number.POSITIVE_INFINITY), 72);
  assert.equal(stepAssemblyZoom(minimumAssemblyZoom, -1), minimumAssemblyZoom);
  assert.equal(stepAssemblyZoom(maximumAssemblyZoom, 1), maximumAssemblyZoom);
});

test("Timeline pointer mapping remains accurate below one pixel per second", () => {
  const element = {
    getBoundingClientRect: () => ({ left: 0, width: 100 }),
    offsetWidth: 100
  };
  assert.equal(assemblyTimeAtClientX(element, 50, 0.5), 100);
});

test("Timeline ruler density adapts to long sequences at low zoom", () => {
  const duration = 60 * 60;
  const spacing = assemblyRulerSpacing(duration, 0.25, 24);
  assert.ok(spacing.majorStep * 0.25 >= 50);
  assert.ok(Math.ceil(duration / spacing.minorStep) <= 10000);
});
