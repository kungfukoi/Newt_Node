import test from "node:test";
import assert from "node:assert/strict";
import {
  clamp,
  clampContextMenuPosition,
  droppedNodePositions,
  edgeLayerBounds,
  edgePathData,
  estimatedNodeRect,
  estimatedNodeWidth,
  maximumResizableNodeHeight,
  minimumResizableNodeHeight,
  normalizedNodeWidth,
  normalizedNodeHeight,
  pairedTextareaResizeHeights,
  graphBoundsForNodes,
  mergeMeasuredPortPositions,
  pastedNodePositions,
  positiveModulo,
  resizeGroupFromCorner,
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

test("custom node sizes are clamped and included in estimated bounds", () => {
  assert.equal(normalizedNodeWidth(640, "text"), 640);
  assert.equal(normalizedNodeWidth(120, "text"), estimatedNodeWidth("text"));
  assert.equal(normalizedNodeWidth(500, "storyboard"), 920);
  assert.equal(normalizedNodeWidth(5000, "text"), 2400);
  assert.equal(normalizedNodeWidth(5000, "preview"), 5000);
  assert.equal(normalizedNodeWidth(20000, "preview"), 12000);
  assert.equal(normalizedNodeWidth("not-a-width", "text"), null);
  assert.equal(normalizedNodeHeight(640), 640);
  assert.equal(normalizedNodeHeight(80), 180);
  assert.equal(normalizedNodeHeight(5000), 3000);
  assert.equal(normalizedNodeHeight(8000, minimumResizableNodeHeight("preview"), maximumResizableNodeHeight("preview")), 8000);
  assert.equal(normalizedNodeHeight("not-a-height"), null);
  assert.deepEqual(
    estimatedNodeRect({
      type: "text",
      x: 25,
      y: 40,
      data: { nodeWidth: 640, nodeHeight: 480 }
    }),
    { left: 25, top: 40, right: 665, bottom: 520 }
  );
});

test("media-bearing nodes keep enough height for an uncropped preview", () => {
  assert.equal(minimumResizableNodeHeight("imageModel"), 320);
  assert.equal(minimumResizableNodeHeight("preview"), 280);
  assert.equal(minimumResizableNodeHeight("image"), 250);
  assert.equal(minimumResizableNodeHeight("text"), 180);
  assert.equal(estimatedNodeWidth("textAgent"), 390);
  assert.equal(minimumResizableNodeHeight("textAgent"), 360);
  assert.equal(normalizedNodeHeight(120, minimumResizableNodeHeight("imageModel")), 320);
});

test("paired Text Model textarea resizing transfers height without changing the total", () => {
  assert.deepEqual(pairedTextareaResizeHeights(240, 240, -80), { primary: 160, paired: 320 });
  assert.deepEqual(pairedTextareaResizeHeights(240, 240, 120), { primary: 360, paired: 120 });
  assert.deepEqual(pairedTextareaResizeHeights(240, 240, -1000), { primary: 40, paired: 440 });
  assert.deepEqual(pairedTextareaResizeHeights(240, 240, 1000), { primary: 440, paired: 40 });
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

test("group corner resizing keeps the opposite corner anchored", () => {
  const group = { x: 100, y: 200, width: 300, height: 240 };
  assert.deepEqual(resizeGroupFromCorner(group, "bottom-right", 40, 30), { x: 100, y: 200, width: 340, height: 270 });
  assert.deepEqual(resizeGroupFromCorner(group, "bottom-left", 40, 30), { x: 140, y: 200, width: 260, height: 270 });
  assert.deepEqual(resizeGroupFromCorner(group, "top-right", 40, 30), { x: 100, y: 230, width: 340, height: 210 });
  assert.deepEqual(resizeGroupFromCorner(group, "top-left", 40, 30), { x: 140, y: 230, width: 260, height: 210 });
});

test("group corner resizing stops at the minimum size without moving the opposite corner", () => {
  assert.deepEqual(
    resizeGroupFromCorner({ x: 100, y: 200, width: 300, height: 240 }, "top-left", 500, 500, 20),
    { x: 380, y: 420, width: 20, height: 20 }
  );
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

test("multi-file drops place nodes in a non-overlapping grid", () => {
  assert.deepEqual(
    droppedNodePositions(["image", "video", "image", "video"], { x: 100, y: 200 }),
    [
      { x: 100, y: 200 },
      { x: 458, y: 200 },
      { x: 100, y: 518 },
      { x: 458, y: 518 }
    ]
  );
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

test("port measurements keep connected endpoints when a port is briefly missing", () => {
  const current = {
    "source:imageOut": { x: 320, y: 180 },
    "target:imageIn": { x: 640, y: 220 },
    "unused:promptOut": { x: 120, y: 80 }
  };
  const measured = {
    "source:imageOut": { x: 322, y: 181 }
  };

  assert.deepEqual(
    mergeMeasuredPortPositions(current, measured, new Set(["source:imageOut", "target:imageIn"])),
    {
      "source:imageOut": { x: 322, y: 181 },
      "target:imageIn": { x: 640, y: 220 }
    }
  );
});
