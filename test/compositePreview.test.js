import test from "node:test";
import assert from "node:assert/strict";
import { compositeBlendChannel, compositePreviewPixels, compositePreviewMask } from "../src/compositePreview.js";
import { compositeVideoBlendModeOptions } from "../src/modelOptions.js";

test("thumbnail mix retains transparency and applies individual masks", () => {
  const background = () => new Uint8ClampedArray([255, 0, 0, 255]);
  const blue = new Uint8ClampedArray([0, 0, 255, 255]);
  assert.deepEqual([...compositePreviewPixels(background(), blue, { mixAmount: 50, blendMode: "normal" })], [128, 0, 128, 255]);
  assert.deepEqual([...compositePreviewPixels(background(), blue, { mixAmount: 100, blendMode: "normal" }, new Float32Array([0]))], [...background()]);
  assert.deepEqual([...compositePreviewPixels(background(), new Uint8ClampedArray([0, 255, 0, 0]), { mixAmount: 100, blendMode: "normal" })], [...background()]);
});
test("all thumbnail blend modes are bounded and implement the expected layer order", () => {
  for (const [mode] of compositeVideoBlendModeOptions) for (const base of [0, 0.25, 0.5, 1]) for (const layer of [0, 0.25, 0.5, 1]) {
    const value = compositeBlendChannel(base, layer, mode);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, mode);
  }
  assert.equal(compositeBlendChannel(0.75, 0.25, "subtract"), 0.5);
  assert.equal(compositeBlendChannel(0.25, 0.5, "divide"), 0.5);
  assert.equal(compositeBlendChannel(0.5, 0.5, "multiply"), 0.25);
  assert.equal(compositeBlendChannel(0.5, 0.5, "screen"), 0.75);
});
test("mask inversion, dilation and erosion update thumbnail coverage", () => {
  const mask = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
  assert.deepEqual([...compositePreviewMask(mask, 3, 1)], [0, 1, 0]);
  assert.deepEqual([...compositePreviewMask(mask, 3, 1, true)], [1, 0, 1]);
  assert.deepEqual([...compositePreviewMask(mask, 3, 1, false, 1)], [1, 1, 1]);
  assert.deepEqual([...compositePreviewMask(mask, 3, 1, false, -1)], [0, 0, 0]);
});
