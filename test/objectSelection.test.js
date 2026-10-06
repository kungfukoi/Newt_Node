import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { maskContains, objectAtPoint, selectObjectMarks, objectSelectionInput } from "../src/objectSelection.js";
import { encodeObjectMask, prepareObjectSource } from "../server/object-selection.js";

const big = { id: "big", width: 4, height: 2, runs: [0, 8], area: 8 };
const small = { id: "small", width: 4, height: 2, runs: [1, 2, 5, 2], area: 4 };
test("hover chooses the smallest containing object and respects mask holes and borders", () => {
  assert.equal(objectAtPoint([big, small], { x: .4, y: .3 }), small);
  assert.equal(objectAtPoint([big, small], { x: .01, y: .3 }), big);
  assert.equal(maskContains(small, { x: .99, y: .99 }), false);
  assert.equal(maskContains(big, { x: 1, y: .5 }), false);
});
test("normal object click replaces selection, Shift adds, Alt subtracts without erasing annotations", () => {
  const drawing = { layer: "drawing", tool: "pen" }, previous = { layer: "selection", tool: "rectangle" };
  assert.deepEqual(selectObjectMarks([drawing, previous], small).slice(0, -1), [drawing]);
  assert.equal(selectObjectMarks([drawing, previous], small, { shiftKey: true }).length, 3);
  assert.equal(selectObjectMarks([previous], small, { shiftKey: true, altKey: true }).at(-1).subtract, true);
});
test("Fal inputs distinguish auto masks, pixel point prompts, and text selection", () => {
  assert.equal(objectSelectionInput({ imageUrl: "source" }).points_per_side, 32);
  const point = objectSelectionInput({ imageUrl: "source", point: { x: 1, y: .5 }, width: 640, height: 360 });
  assert.equal(point.prompt, "");
  assert.deepEqual(point.point_prompts, [{ x: 639, y: 180, label: 1 }]);
  assert.equal(point.apply_mask, false);
  assert.equal(objectSelectionInput({ imageUrl: "source", prompt: "all people" }).prompt, "all people");
});
test("opaque grayscale masks become selectable runs, not opaque rectangles", async () => {
  const buffer = await sharp(Buffer.from([0, 255, 255, 0, 0, 255, 255, 0]), { raw: { width: 4, height: 2, channels: 1 } }).png().toBuffer();
  assert.deepEqual(await encodeObjectMask(buffer, 4, 2, "small"), small);
  const source = await sharp({ create: { width: 2048, height: 1024, channels: 3, background: "red" } }).png().toBuffer();
  const prepared = await prepareObjectSource(source);
  assert.deepEqual([prepared.info.width, prepared.info.height], [1024, 512]);
});
