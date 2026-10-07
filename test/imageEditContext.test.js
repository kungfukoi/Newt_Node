import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { contextMask, objectPixels } from "../server/image-edit-context.js";
import { boxFromDrag } from "../src/imageEditBoxes.js";
import { objectMaskForBox } from "../src/imageEditBoxModels.js";
import { prepareImageEdit } from "../server/image-edit.js";

test("mask rasterization preserves normalized positions on non-square images", async () => {
  const pixels = await objectPixels({ width: 10, height: 10, runs: [11, 2, 21, 2] }, 200, 300);
  assert.equal(pixels[60 * 200 + 40], 255);
  assert.equal(pixels[60 * 200 + 10], 0);
  assert.equal(pixels[100 * 200 + 40], 0);
});

test("context follows an irregular subject, preserves its core, and fades gradually", async () => {
  const width = 200, height = 200, core = Buffer.alloc(width * height);
  for (let y = 60; y < 140; y++) for (let x = 60; x < 140; x++) if (Math.hypot(x - 100, y - 100) < 30) core[y * width + x] = 255;
  const output = await contextMask(core, width, height, { w: .4, h: .4 }, .35);
  const alpha = await sharp(output).extractChannel(3).raw().toBuffer();
  for (let p = 0; p < core.length; p++) if (core[p]) assert.equal(alpha[p], 255);
  assert.equal(alpha[10 * width + 10], 0);
  const tail = Array.from({ length: 50 }, (_, i) => alpha[100 * width + 130 + i]);
  assert.ok(new Set(tail.filter(value => value > 0 && value < 255)).size > 10);
  assert.ok(alpha[60 * width + 60] < alpha[100 * width + 140], "corners must not become a filled rectangle");
});

test("selected subject crossing box edges is moved whole and Remove uses its actual shape", async () => {
  const box = boxFromDrag({ x: .2, y: .2 }, { x: .4, y: .4 }, "subject");
  const mask = { width: 10, height: 10, runs: [22, 3, 32, 3] };
  assert.ok(objectMaskForBox([mask], box));
  const source = await sharp({ create: { width: 200, height: 200, channels: 4, background: "#112233" } })
    .composite([{ input: await sharp({ create: { width: 60, height: 40, channels: 4, background: "#00ff00" } }).png().toBuffer(), left: 40, top: 40 }]).png().toBuffer();
  const moved = await prepareImageEdit({ source, mode: "edit", model: "Flux 3", boxes: [{ ...box, target: { ...box.target, x: .7 } }], boxObjects: { subject: mask } });
  const data = await sharp(moved.images[0]).raw().toBuffer();
  const at = (x, y) => [...data.subarray((y * 200 + x) * 4, (y * 200 + x) * 4 + 4)];
  assert.deepEqual(at(90, 50), [128, 128, 128, 255], "source beyond the drawn box must be erased");
  assert.deepEqual(at(170, 50), [0, 255, 0, 255], "destination beyond the target box must not be clipped");
  const removed = await prepareImageEdit({ source, mode: "edit", model: "Flux 3", boxes: [{ ...box, mode: "remove" }], boxObjects: { subject: mask } });
  const alpha = await sharp(removed.selection).extractChannel(3).raw().toBuffer();
  assert.equal(alpha[50 * 200 + 90], 255);
  assert.match(removed.submittedPrompt, /PHOTOGRAPHIC FINISH/);
  await assert.rejects(prepareImageEdit({ source, mode: "edit", model: "Flux 3", boxes: [{ ...box, mode: "remove" }], boxObjects: { subject: { ...mask, runs: [1, 9000] } } }), /Invalid box/);
});
