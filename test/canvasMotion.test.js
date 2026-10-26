import test from "node:test";
import assert from "node:assert/strict";
import { createViewportMotion } from "../src/canvasMotion.js";

function rig(initial = { x: 0, y: 0, scale: 1 }, options = {}) {
  let viewport = { ...initial }, clock = 0, queue = [];
  const motion = createViewportMotion({ get: () => viewport, apply: next => { viewport = { ...next }; }, now: () => clock,
    raf: cb => { queue.push(cb); return queue.length; }, caf: () => { queue = []; }, minScale: 0.1, maxScale: 4, ...options });
  const frames = (count = 400) => { for (let i = 0; i < count && queue.length; i++) { const cb = queue.shift(); clock += 16; cb(clock); } };
  return { motion, frames, get viewport() { return viewport; }, set viewport(value) { viewport = value; }, advance: ms => { clock += ms; } };
}

test("wheel zoom eases to the target and keeps the pointer's scene point fixed", () => {
  const r = rig({ x: 100, y: 50, scale: 1 });
  const pointer = { x: 300, y: 200 }, scene = { x: (300 - 100) / 1, y: (200 - 50) / 1 };
  r.motion.zoomBy(pointer, 1.15); r.motion.zoomBy(pointer, 1.15);
  r.frames(1);
  assert.ok(r.viewport.scale > 1 && r.viewport.scale < 1.15 ** 2, "moves part-way on the first frame");
  assert.ok(Math.abs((pointer.x - r.viewport.x) / r.viewport.scale - scene.x) < 0.001, "cursor anchor is stable during easing, not just after it");
  r.frames();
  assert.ok(Math.abs(r.viewport.scale - 1.15 ** 2) < 1e-3);
  assert.ok(Math.abs((pointer.x - r.viewport.x) / r.viewport.scale - scene.x) < 0.5);
  assert.ok(Math.abs((pointer.y - r.viewport.y) / r.viewport.scale - scene.y) < 0.5);
  assert.equal(r.motion.active, false);
});

test("zoom is clamped to the allowed range", () => {
  const r = rig();
  for (let i = 0; i < 30; i++) r.motion.zoomBy({ x: 0, y: 0 }, 1.5);
  r.frames();
  assert.ok(Math.abs(r.viewport.scale - 4) < 1e-3);
});

test("a fast drag release keeps gliding and then settles", () => {
  const r = rig();
  r.motion.begin();
  for (let i = 1; i <= 6; i++) { r.advance(16); r.motion.dragTo({ x: i * 20, y: 0, scale: 1 }); r.frames(1); }
  const atRelease = r.viewport.x;
  assert.equal(r.motion.release(), true);
  r.frames();
  assert.ok(r.viewport.x > atRelease + 50, "travelled further after release");
  assert.equal(r.motion.active, false);
});

test("pausing before release means no momentum", () => {
  const r = rig();
  r.motion.begin();
  for (let i = 1; i <= 4; i++) { r.advance(16); r.motion.dragTo({ x: i * 20, y: 0, scale: 1 }); r.frames(1); }
  r.advance(300);
  r.frames();
  const rest = r.viewport.x;
  r.motion.release(); r.frames();
  assert.ok(Math.abs(r.viewport.x - rest) < 1);
});

test("an outside viewport change is followed, not overwritten", () => {
  const r = rig();
  r.motion.panBy(500, 0);
  r.frames(1);
  r.viewport = { x: -40, y: -40, scale: 2 };
  r.frames();
  assert.deepEqual(r.viewport, { x: -40, y: -40, scale: 2 });
});
