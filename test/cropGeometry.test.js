import test from "node:test";
import assert from "node:assert/strict";
import { clampCropRect, dragCropRect } from "../src/cropGeometry.js";

const rect = { x: 20, y: 30, width: 50, height: 40 };

test("freeform crops retain independent dimensions through normalization", () => {
  assert.deepEqual(clampCropRect(rect), rect);
  assert.deepEqual(clampCropRect({ x: 0, y: 0, width: 2, height: 90 }), { x: 0, y: 0, width: 2, height: 90 });
});

test("side handles resize only their axis and keep the opposite side anchored", () => {
  assert.deepEqual(dragCropRect(rect, "e", 12, 19), { ...rect, width: 62 });
  assert.deepEqual(dragCropRect(rect, "s", 12, 19), { ...rect, height: 59 });
  assert.deepEqual(dragCropRect(rect, "w", 12, 19), { ...rect, x: 32, width: 38 });
  assert.deepEqual(dragCropRect(rect, "n", 12, 19), { ...rect, y: 49, height: 21 });
});

test("all corners resize freely without changing the opposite corner", () => {
  assert.deepEqual(dragCropRect(rect, "se", 10, -15), { ...rect, width: 60, height: 25 });
  assert.deepEqual(dragCropRect(rect, "nw", 10, -15), { x: 30, y: 15, width: 40, height: 55 });
  assert.deepEqual(dragCropRect(rect, "ne", 10, -15), { x: 20, y: 15, width: 60, height: 55 });
  assert.deepEqual(dragCropRect(rect, "sw", 10, -15), { x: 30, y: 30, width: 40, height: 25 });
});

test("resizing stops at image edges and prevents inversion; moving never shrinks", () => {
  assert.deepEqual(dragCropRect(rect, "se", 500, 500), { ...rect, width: 80, height: 70 });
  assert.deepEqual(dragCropRect(rect, "nw", -500, -500), { x: 0, y: 0, width: 70, height: 70 });
  assert.deepEqual(dragCropRect(rect, "se", -500, -500), { ...rect, width: 1, height: 1 });
  assert.deepEqual(dragCropRect(rect, "nw", 500, 500), { x: 69, y: 69, width: 1, height: 1 });
  assert.deepEqual(dragCropRect(rect, "move", 500, 500), { ...rect, x: 50, y: 60 });
  assert.deepEqual(dragCropRect(rect, "move", -500, -500), { ...rect, x: 0, y: 0 });
});
