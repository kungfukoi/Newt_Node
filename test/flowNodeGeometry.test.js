import assert from "node:assert/strict";
import test from "node:test";
import { nodePortGeometrySignature, observeNodePortGeometry } from "../src/flowNodeGeometry.js";

function geometry() {
  let zoom = 1, top = 40;
  const card = {
    offsetWidth: 300, offsetHeight: 200,
    getBoundingClientRect: () => ({ x: 10 * zoom, y: 20 * zoom, width: 300 * zoom, height: 200 * zoom }),
    querySelectorAll: () => [port], contains: (element) => element === port || element === card,
    addEventListener() {}, removeEventListener() {}
  };
  const port = { dataset: { portKey: "node:output" }, parentElement: card,
    getBoundingClientRect: () => ({ x: 300 * zoom, y: top * zoom, width: 18 * zoom, height: 18 * zoom }) };
  return { card, zoom: (value) => { zoom = value; }, top: (value) => { top = value; } };
}

test("port geometry is invariant to canvas zoom, but tracks actual layout", () => {
  const f = geometry();
  const initial = nodePortGeometrySignature(f.card);
  for (const zoom of [0.05, 0.08, 0.15, 0.3, 1, 2.5]) {
    f.zoom(zoom);
    assert.equal(nodePortGeometrySignature(f.card), initial);
  }
  f.top(80);
  assert.notEqual(nodePortGeometrySignature(f.card), initial);
});

test("geometry observer coalesces unchanged layout and cancels pending work", () => {
  const f = geometry();
  let notify, frame, calls = 0, canceled = false;
  const runtime = {
    ResizeObserver: class { constructor(callback) { notify = callback; } observe() {} unobserve() {} disconnect() {} },
    requestAnimationFrame(callback) { frame = callback; return 1; },
    cancelAnimationFrame() { canceled = true; }
  };
  const close = observeNodePortGeometry(f.card, () => { calls++; }, runtime);
  assert.equal(calls, 1);
  notify(); notify(); frame();
  assert.equal(calls, 1);
  f.top(100); notify(); frame();
  assert.equal(calls, 2);
  notify(); close(); frame();
  assert.equal(canceled, true);
  assert.equal(calls, 2);
});
