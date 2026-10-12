import test from "node:test";
import assert from "node:assert/strict";
import { boxFromDrag, editBoxTags, editBoxesPrompt } from "../src/imageEditBoxes.js";
import { boxSelectionDocument, importBoxSelections } from "../src/imageEditBoxExport.js";
const box = (id, label) => ({ ...boxFromDrag({ x: .1, y: .1 }, { x: .3, y: .3 }, id), label });
test("description tags remain unique even when descriptions already contain suffixes", () => {
  const boxes = [box("a", "Water bottle"), box("b", "Water bottle"), box("c", "water-bottle-2"), box("d", "猫")];
  assert.deepEqual(editBoxTags(boxes), ["@water-bottle", "@water-bottle-2", "@water-bottle-2-2", "@猫"]);
  assert.match(editBoxesPrompt(boxes, 2), /Box 2 \(@water-bottle-2\)/);
});
test("selections round-trip all boxes and masks; invalid files fail before loading", () => {
  const boxes = Array.from({ length: 12 }, (_, i) => box(`box-${i}`, `Object ${i}`));
  boxes[0].sourceMask = { width: 10, height: 10, runs: [22, 2], area: 2 };
  boxes[0].selectionDerived = true;
  const size = { width: 200, height: 300 }, saved = boxSelectionDocument(boxes, size, {}, "Move @object-0");
  const loaded = importBoxSelections(JSON.parse(JSON.stringify(saved)), size);
  assert.equal(loaded.boxes.length, 12); assert.deepEqual(loaded.boxes[0].sourceMask, boxes[0].sourceMask);
  assert.equal(loaded.boxes[0].layer, "boxes"); assert.equal(loaded.prompt, "Move @object-0");
  assert.throws(() => importBoxSelections(saved, { width: 10, height: 10 }), /dimensions/);
  assert.throws(() => importBoxSelections({ ...saved, version: 2 }, size), /selections file/);
  assert.throws(() => importBoxSelections({ ...saved, boxes: [{ ...saved.boxes[0], sourceMask: { width: -1 } }] }, size));
});
