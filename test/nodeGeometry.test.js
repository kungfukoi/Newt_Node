import test from "node:test";
import assert from "node:assert/strict";
import {
  clamp,
  clampContextMenuPosition,
  edgeLayerBounds,
  edgePathData,
  graphBoundsForNodes,
  pastedNodePositions,
  positiveModulo,
  rectsOverlap
} from "../src/nodeGeometry.js";

test("graphBoundsForNodes uses estimated node dimensions", () => {
  assert.deepEqual(
    graphBoundsForNodes([
      { type: "image", x: 10, y: 20 },
      { type: "character", x: 500, y: -30 }
    ]),
    { left: 10, top: -30, right: 1260, bottom: 490 }
  );
});

test("rectsOverlap detects separated and overlapping rectangles", () => {
  assert.equal(rectsOverlap({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 9, top: 9, right: 20, bottom: 20 }), true);
  assert.equal(rectsOverlap({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 10, right: 20, bottom: 20 }), false);
});

test("clamp helpers bound values predictably", () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-4, 0, 10), 0);
  assert.equal(positiveModulo(-3, 28), 25);
  assert.deepEqual(clampContextMenuPosition(500, -20, { width: 320, height: 180 }, { width: 100, height: 80, inset: 8 }), { x: 212, y: 8 });
});

test("pasted nodes anchor at the cursor while preserving relative spacing", () => {
  assert.deepEqual(
    pastedNodePositions(
      [{ x: 100, y: 80 }, { x: 340, y: 210 }],
      { x: 900, y: 500 }
    ),
    [{ x: 900, y: 500 }, { x: 1140, y: 630 }]
  );
});

test("pasted nodes retain the legacy offset when no canvas cursor is available", () => {
  assert.deepEqual(pastedNodePositions([{ x: 100, y: 80 }]), [{ x: 142, y: 122 }]);
});

test("edge geometry creates a padded SVG viewport around paths", () => {
  assert.equal(edgePathData({ x: 100, y: 20 }, { x: 300, y: 140 }), "M 100 20 C 184 20, 216 140, 300 140");
  assert.deepEqual(
    edgeLayerBounds(
      [{ from: { x: 100, y: 20 }, to: { x: 300, y: 140 } }],
      [{ x: -10, y: 50 }],
      10
    ),
    { left: -20, top: 10, width: 330, height: 140, viewBox: "-20 10 330 140" }
  );
});

test("edge geometry keeps an addressable viewport when no wires exist", () => {
  assert.deepEqual(edgeLayerBounds(), { left: 0, top: 0, width: 1, height: 1, viewBox: "0 0 1 1" });
});
