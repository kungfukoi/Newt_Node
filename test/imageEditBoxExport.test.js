import test from "node:test";
import assert from "node:assert/strict";
import { boxFromDrag, editBoxTags, editBoxesPrompt } from "../src/imageEditBoxes.js";
import sharp from "sharp";
import { boxSelectionDocument, embedSelectionMetadata, readSelectionMetadata } from "../src/imageEditBoxExport.js";
const box = (id, label) => ({ ...boxFromDrag({ x: .1, y: .1 }, { x: .3, y: .3 }, id), label });
test("description tags remain unique even when descriptions already contain suffixes", () => {
  const boxes = [box("a", "Water bottle"), box("b", "Water bottle"), box("c", "water-bottle-2"), box("d", "猫")];
  assert.deepEqual(editBoxTags(boxes), ["@water-bottle", "@water-bottle-2", "@water-bottle-2-2", "@猫"]);
  assert.match(editBoxesPrompt(boxes, 2), /Box 2 \(@water-bottle-2\)/);
});
test("one PNG retains all boxes, Unicode descriptions and masks without altering pixels", async () => {
  const boxes = Array.from({ length: 12 }, (_, i) => box(`box-${i}`, `Object ${i}`));
  boxes[0].sourceMask = { width: 10, height: 10, runs: [22, 2], area: 2 };
  boxes[0].selectionDerived = true;
  boxes[11].label = "猫 — Café lamp";
  const size = { width: 200, height: 300 }, saved = boxSelectionDocument(boxes, size, {}, "Move @object-0");
  const original = await sharp({ create: { ...size, channels: 4, background: "#12345677" } }).png().toBuffer();
  const png = Buffer.from(embedSelectionMetadata(original, saved)), loaded = readSelectionMetadata(png);
  assert.deepEqual(loaded, saved);
  assert.deepEqual(await sharp(png).raw().toBuffer(), await sharp(original).raw().toBuffer());
  assert.equal(readSelectionMetadata(original), null);
  assert.throws(() => readSelectionMetadata(png.subarray(0, png.length - 20)), /Truncated|Incomplete/);
  const damaged = Buffer.from(png); damaged[damaged.indexOf(Buffer.from("@object-0"))] ^= 1;
  assert.throws(() => readSelectionMetadata(damaged), /Damaged/);
  assert.throws(() => embedSelectionMetadata(new Uint8Array(20), saved), /Invalid/);
  assert.throws(() => boxSelectionDocument([{ ...boxes[0], sourceMask: { width: -1 } }], size, {}));
});
