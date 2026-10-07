import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { boxFromDrag, boxCorners, boxContextRect, transformEditBox, validateEditBoxes, editBoxModes } from "../src/imageEditBoxes.js";
import { prepareImageEdit, finishImageEdit } from "../server/image-edit.js";
const box = (id = "cat") => boxFromDrag({ x: .1, y: .1 }, { x: .3, y: .3 }, id);
const solid = color => sharp({ create: { width: 200, height: 300, channels: 4, background: color } }).png().toBuffer();
async function pixel(buffer, x, y) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
}

test("box transforms use image pixels for rotation and preserve the original source", () => {
  const original = box();
  const moved = transformEditBox(original, "translate", { x: .2, y: .2 }, { x: .7, y: .6 }, 200, 300);
  assert.deepEqual(moved.source, original.source); assert.equal(moved.target.x, .7);
  const scaled = transformEditBox(original, "scale", { x: .3, y: .3 }, { x: .4, y: .4 }, 200, 300);
  assert.ok(Math.abs(scaled.target.w - .4) < .0001);
  const rotated = transformEditBox(original, "rotate", { x: .3, y: .2 }, { x: .2, y: .3 }, 200, 300);
  assert.equal(rotated.target.rotation, 90);
  const corners = boxCorners({ x: .5, y: .5, w: .2, h: .2, rotation: 90 }, 200, 300);
  assert.deepEqual(corners[0], { x: 130, y: 130 });
  const keep = transformEditBox({ ...original, mode: "keep" }, "translate", { x: .2, y: .2 }, { x: 1, y: 1 }, 200, 300);
  assert.doesNotThrow(() => validateEditBoxes([keep]));
});

test("box validation rejects incomplete modes, duplicate IDs and unbounded transforms", () => {
  for (const patch of [{ contextPadding: -1 }, { contextPadding: 1.1 }, { contextPadding: "large" }, { mode: "other" }, { mode: "text", text: "" }, { mode: "reference" }, { label: "" }, { target: { ...box().target, rotation: Infinity } }])
    assert.throws(() => validateEditBoxes([{ ...box(), ...patch }]));
  assert.throws(() => validateEditBoxes([box(), box()]));
  assert.throws(() => validateEditBoxes(Array.from({ length: 9 }, (_, i) => box(`box-${i}`))));
});

test("context margins contain rotated geometry and default safely for older boxes", () => {
  assert.equal(validateEditBoxes([box()])[0].contextPadding, .35);
  const rect = { x: .5, y: .5, w: .2, h: .4, rotation: 90 };
  const context = boxContextRect(rect, 200, 300, .5);
  assert.equal(context.rotation, 0);
  assert.ok(Math.abs(context.w - .8) < 1e-10);
  assert.ok(Math.abs(context.h - 80 / 300) < 1e-10);
});

test("every editable box mode includes context beyond its footprint while Keep still wins", async () => {
  const source = await solid("#123456");
  for (const mode of ["remove", "new", "reference", "text", "move"]) {
    const item = { ...box(), mode, text: "Hello", referenceUrl: "ref" };
    const keep = { ...boxFromDrag({ x: .16, y: .315 }, { x: .24, y: .36 }, "protected"), mode: "keep" };
    const args = { source, mode: "edit", model: "Flux 3", references: [{ url: "ref", buffer: source }] };
    const prepared = await prepareImageEdit({ ...args, boxes: [item, keep] });
    const result = await finishImageEdit(prepared, await solid("#ff0000"));
    assert.deepEqual(await pixel(result, 40, 100), [18, 52, 86, 255], `${mode}: Keep protects context`);
    assert.deepEqual(await pixel(result, 55, 98), [255, 0, 0, 255], `${mode}: shadow outside footprint is editable`);
    assert.match(prepared.submittedPrompt, /SCENE CONTEXT/);
    assert.match(prepared.submittedPrompt, /TRANSFORMS/);
    const tight = await prepareImageEdit({ ...args, boxes: [{ ...item, contextPadding: 0 }] });
    assert.deepEqual(await pixel(await finishImageEdit(tight, await solid("#ff0000")), 55, 103), [18, 52, 86, 255], `${mode}: zero margin limits editing`);
  }
});

for (const model of ["OpenAI Image 2.5 Sunburst", "OpenAI Image 2.5 Flare", "Ideogram 4.5", "Flux 3", "Nano Banana 2.1"]) {
  test(`${model}: source and transformed destination edit, Keep and outside pixels survive`, async () => {
    const source = await solid("#123456");
    const moving = { ...box(), target: { x: .7, y: .7, w: .25, h: .2, rotation: 45 } };
    const keep = { ...boxFromDrag({ x: .65, y: .65 }, { x: .75, y: .75 }, "keep"), mode: "keep" };
    const prepared = await prepareImageEdit({ source, mode: "edit", model, boxes: [moving, keep], boxObjects: { cat: { width: 10, height: 10, runs: [11, 2, 21, 2] } } });
    assert.equal(prepared.images.length, 2); assert.equal(prepared.annotationMask, null);
    assert.match(prepared.submittedPrompt, /ALREADY positioned/); assert.match(prepared.submittedPrompt, /45.00 degrees/);
    const result = await finishImageEdit(prepared, await solid("#ff0000"));
    assert.deepEqual(await pixel(result, 40, 60), [255, 0, 0, 255]);
    assert.deepEqual(await pixel(result, 140, 210), [18, 52, 86, 255]);
    assert.deepEqual(await pixel(result, 180, 30), [18, 52, 86, 255]);
    assert.deepEqual(await pixel(result, 123, 193), [255, 0, 0, 255]);
  });
}

test("all box modes produce explicit instructions; references are normalized and correctly numbered", async () => {
  const source = await solid("#123456");
  const boxes = Object.keys(editBoxModes).map(mode => ({ ...box(mode), mode, text: "Hello", referenceUrl: "/uploads/reference.jpg", target: { ...box().target, x: .7, y: .7 } }));
  const reference = await sharp(source).jpeg().toBuffer();
  const prepared = await prepareImageEdit({ source, drawing: await solid("#00000000"), mode: "edit", model: "Flux 3", boxes, references: [{ url: "/uploads/reference.jpg", buffer: reference }] });
  assert.equal(prepared.images.length, 3);
  assert.equal((await sharp(prepared.images[2]).metadata()).format, "png");
  for (const text of [/ADD the described/, /KEEP this original/, /MOVE the original/, /REMOVE the described/, /reference image 3/, /Render exactly this visible text: "Hello"/]) assert.match(prepared.submittedPrompt, text);
  await assert.rejects(prepareImageEdit({ source, mode: "sketch", boxes: [box()] }), /Boxes require/);
  const full = { ...boxFromDrag({ x: 0, y: 0 }, { x: 1, y: 1 }, "keep"), mode: "keep" };
  await assert.rejects(prepareImageEdit({ source, mode: "edit", boxes: [full] }), /entire edit area/);
});
