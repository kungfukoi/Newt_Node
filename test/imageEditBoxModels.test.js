import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { boxFromSelectionPixels, fluxBoxInstructions, objectMaskForBox, validateBoxObject, boxNeedsCutout } from "../src/imageEditBoxModels.js";
import { boxFromDrag } from "../src/imageEditBoxes.js";
import { prepareImageEdit, finishImageEdit } from "../server/image-edit.js";
const box = boxFromDrag({ x: .1, y: .1 }, { x: .3, y: .3 }, "cat");
const mask = { width: 10, height: 10, runs: [11, 2, 21, 2], area: 4 };
test("selection becomes a bounded named box with holes preserved", () => {
  const data = Buffer.alloc(400); for (const p of [22, 23, 32]) data[p * 4 + 3] = 255;
  const converted = boxFromSelectionPixels({ data, width: 10, height: 10, id: "jacket", label: "the red jacket" });
  assert.deepEqual(converted.sourceMask.runs, [22, 2, 32, 1]);
  assert.ok(Math.abs(converted.source.x - .3) < 1e-10); assert.equal(converted.label, "the red jacket");
  assert.throws(() => boxFromSelectionPixels({ data: Buffer.alloc(400), width: 10, height: 10, id: "empty" }), /empty/);
});
test("object masks are bounded, ordered, and selected within the source box", () => {
  for (const runs of [[1, 1000], [1, -1], [2, 3, 1, 1], [1], []]) assert.throws(() => validateBoxObject({ width: 10, height: 10, runs }));
  assert.deepEqual(objectMaskForBox([{ width: 10, height: 10, runs: [0, 100], area: 100 }, mask], box), mask);
  assert.equal(objectMaskForBox([{ width: 10, height: 10, runs: [88, 2], area: 2 }], box), null);
});
test("Flux rows use y/x 1000 coordinates and correct reference slots for every mode", () => {
  const boxes = ["move", "keep", "new", "text", "remove", "reference"].map(mode => ({ ...box, mode, text: "Hello", referenceUrl: "ref", target: { ...box.target, x: .7 } }));
  const result = fluxBoxInstructions(boxes, 200, 300, { ref: 4 });
  assert.deepEqual(result.rows[0].src_bbox, [100, 100, 300, 300]);
  assert.deepEqual(result.rows[0].tgt_bbox, [100, 600, 300, 800]);
  assert.equal(result.rows[0].from, "ref_image_0"); assert.equal(result.rows[5].from, "ref_image_3");
  assert.equal(result.rows[2].src_bbox, null); assert.equal(result.rows[4].tgt_bbox, null);
  assert.match(result.caption, /right/); assert.match(result.rows[3].desc, /Hello/);
  assert.equal(boxNeedsCutout(box, "Flux 3"), false);
  assert.equal(boxNeedsCutout({ ...box, target: { ...box.target, rotation: 90 } }, "Flux 3"), true);
  assert.equal(boxNeedsCutout({ ...box, sourceMask: mask }, "Flux 3"), true);
});
test("cutout relocation provides identity reference but allows model relighting only inside context regions", async () => {
  const source = await sharp({ create: { width: 200, height: 200, channels: 4, background: "#112233" } })
    .composite([{ input: await sharp({ create: { width: 40, height: 40, channels: 4, background: "#00ff00" } }).png().toBuffer(), left: 20, top: 20 }]).png().toBuffer();
  const moved = { ...box, target: { ...box.target, x: .7, y: .7, rotation: 90 } };
  const prepared = await prepareImageEdit({ source, mode: "edit", model: "Nano Banana 2.1", boxes: [moved], boxObjects: { cat: mask } });
  assert.equal(prepared.boxStrategy, "cutout-cleanup");
  const generated = await sharp({ create: { width: 200, height: 200, channels: 4, background: "#ff0000" } }).png().toBuffer();
  const result = await sharp(await finishImageEdit(prepared, generated)).raw().toBuffer();
  const pixel = (x, y) => [...result.subarray((y * 200 + x) * 4, (y * 200 + x) * 4 + 4)];
  const reference = await sharp(prepared.images[0]).raw().toBuffer();
  assert.deepEqual([...reference.subarray((140 * 200 + 140) * 4, (140 * 200 + 140) * 4 + 4)], [0, 255, 0, 255]);
  assert.deepEqual(pixel(140, 140), [255, 0, 0, 255]);
  assert.deepEqual(pixel(40, 66), [255, 0, 0, 255]);
  assert.deepEqual(pixel(140, 166), [255, 0, 0, 255]);
  assert.deepEqual(pixel(40, 40), [255, 0, 0, 255]);
  assert.deepEqual(pixel(180, 20), [17, 34, 51, 255]);
  await assert.rejects(prepareImageEdit({ source, mode: "edit", model: "Nano Banana 2.1", boxes: [moved] }), /Select the object/);
  const native = await prepareImageEdit({ source, mode: "edit", model: "Flux 3", boxes: [{ ...moved, target: { ...moved.target, rotation: 0 } }] });
  assert.equal(native.boxStrategy, "flux-structured");
  assert.ok(native.submittedPrompt.endsWith('"desc":"Object"}]'));
});


test("overlapping moves sample the original and annotation restoration does not refill source holes", async () => {
  const solid = color => sharp({ create: { width: 200, height: 200, channels: 4, background: color } }).png().toBuffer();
  const patch = color => sharp({ create: { width: 40, height: 40, channels: 4, background: color } }).png().toBuffer();
  const source = await sharp(await solid("#112233")).composite([{ input: await patch("#00ff00"), left: 20, top: 20 }, { input: await patch("#ff0000"), left: 120, top: 20 }]).png().toBuffer();
  const first = { ...box, target: { ...box.target, x: .7 } };
  const second = { ...box, id: "other", source: { ...box.source, x: .7 }, target: { ...box.target, y: .7 } };
  const prepared = await prepareImageEdit({ source, drawing: await solid("#ffffff"), mode: "edit", model: "Nano Banana 2.1", boxes: [first, second], boxObjects: { cat: mask, other: { width: 10, height: 10, runs: [16, 2, 26, 2] } } });
  const pixels = await sharp(await finishImageEdit(prepared, await solid("#0000ff"))).raw().toBuffer();
  const at = (x, y) => [...pixels.subarray((y * 200 + x) * 4, (y * 200 + x) * 4 + 4)];
  assert.deepEqual(at(140, 40), [0, 0, 255, 255]);
  assert.deepEqual(at(40, 140), [0, 0, 255, 255]);
  assert.deepEqual(at(40, 40), [0, 0, 255, 255]);
});


test("cutout references never reintroduce the original subject and Flux explicitly removes the vacancy", async () => {
  const source = await sharp({ create: { width: 200, height: 200, channels: 4, background: "#112233" } }).composite([{ input: await sharp({ create: { width: 40, height: 40, channels: 4, background: "#00ff00" } }).png().toBuffer(), left: 20, top: 20 }]).png().toBuffer();
  const drawing = await sharp({ create: { width: 200, height: 200, channels: 4, background: "#00000000" } }).composite([{ input: await sharp({ create: { width: 3, height: 3, channels: 4, background: "white" } }).png().toBuffer(), left: 180, top: 180 }]).png().toBuffer();
  const moved = { ...box, target: { ...box.target, x: .7, y: .7 } };
  const prepared = await prepareImageEdit({ source, drawing, mode: "edit", model: "Flux 3", boxes: [moved], boxObjects: { cat: mask }, prompt: "Move the object to the right." });
  assert.equal(prepared.images.length, 3);
  for (const reference of prepared.images) {
    const data = await sharp(reference).ensureAlpha().raw().toBuffer();
    assert.deepEqual([...data.subarray((40 * 200 + 40) * 4, (40 * 200 + 40) * 4 + 4)], [128, 128, 128, 255]);
  }
  const rows = JSON.parse(prepared.submittedPrompt.split("\n").at(-1));
  const vacancy = rows.find(row => row.id === "vacancy_1");
  assert.equal(vacancy.tgt_bbox, null); assert.deepEqual(vacancy.src_bbox, [30, 30, 370, 370]);
  assert.match(prepared.submittedPrompt, /background only/);
  assert.match(prepared.submittedPrompt, /already been applied geometrically/);
});
