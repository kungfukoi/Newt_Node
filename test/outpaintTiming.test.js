import test from "node:test";
import assert from "node:assert/strict";
import { estimateOutpaintTiming } from "../server/outpaint-timing.js";

test("alignment corrects advanced motion but refuses static or inconsistent evidence", () => {
  const stride = 32, frames = 100, start = 12, count = 70;
  const reference = Uint8Array.from({ length: stride * frames }, (_, i) => (Math.floor(i / stride) * 73 + i % stride * 17) % 256);
  const generated = new Uint8Array(reference.length);
  for (let i = 0; i < frames - 3; i++) generated.set(reference.subarray((i + 3) * stride, (i + 4) * stride), i * stride);
  const result = estimateOutpaintTiming(reference, generated, { stride, start, count, radius: 6 });
  assert.equal(result.applied, true); assert.equal(result.offsetFrames, -3);
  assert.equal(estimateOutpaintTiming(reference, reference, { stride, start, count, radius: 6 }).applied, false);
  const flat = new Uint8Array(reference.length).fill(127);
  assert.equal(estimateOutpaintTiming(flat, flat, { stride, start, count, radius: 6 }).applied, false);
  generated.set(reference.subarray(50 * stride), 50 * stride);
  assert.equal(estimateOutpaintTiming(reference, generated, { stride, start, count, radius: 6 }).applied, false);
});

test("a small moving subject cannot be outvoted by static lead-in, background or tail", () => {
  const stride = 100, frames = 100, start = 12, count = 70;
  const reference = new Uint8Array(stride * frames).fill(80);
  for (let f = 32; f < 55; f++) for (let p = 0; p < 8; p++) reference[f * stride + p] = 100 + (f * 31 + p * 17) % 150;
  const generated = new Uint8Array(reference.length).fill(80);
  for (let f = 0; f < frames - 7; f++) generated.set(reference.subarray((f + 7) * stride, (f + 8) * stride), f * stride);
  const aligned = estimateOutpaintTiming(reference, generated, { stride, start, count, radius: 12 });
  assert.equal(aligned.applied, true);
  assert.equal(aligned.offsetFrames, -7);
  // With no lead-in, the same shift would require frames before the paid raw.
  const missing = estimateOutpaintTiming(reference, generated, { stride, start: 0, count: 82, radius: 12 });
  assert.equal(missing.applied, false);
  assert.equal(missing.status, "needs_review");
  assert.match(missing.reason, /frame handles/);
  assert.equal(missing.suggestedOffsetFrames, -7);
  // Compress the latter half of the action. An overall shift cannot fix it.
  for (let f = 38; f < 55; f++) generated.set(reference.subarray((f + 3) * stride, (f + 4) * stride), f * stride);
  const drift = estimateOutpaintTiming(reference, generated, { stride, start, count, radius: 12 });
  assert.equal(drift.applied, false);
  assert.equal(drift.status, "needs_review");
  assert.match(drift.reason, /changes timing/);
});
