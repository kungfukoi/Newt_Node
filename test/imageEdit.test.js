import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { buildImageEditPrompt, imageEditPoint, imageEditProvider, imageEditSize } from "../src/imageEdit.js";
import { finishImageEdit, prepareImageEdit } from "../server/image-edit.js";

const solid = (width, height, background) => sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();

test("Ideogram masks use black to edit and white to preserve with exact local preservation", async () => {
  const source = await solid(64, 96, "#224466");
  const selection = await sharp({ create: { width: 64, height: 96, channels: 4, background: "#00000000" } })
    .composite([{ input: await solid(16, 16, "#ffffff"), left: 0, top: 0 }]).png().toBuffer();
  const prepared = await prepareImageEdit({ source, selection, mode: "remove", model: "Ideogram 4.5" });
  assert.deepEqual((await pixel(prepared.mask, 0, 0)).slice(0, 3), [0, 0, 0]);
  assert.deepEqual((await pixel(prepared.mask, 40, 40)).slice(0, 3), [255, 255, 255]);
  assert.match(prepared.submittedPrompt, /black area/);
  const result = await finishImageEdit(prepared, await solid(64, 96, "#ff0000"));
  assert.deepEqual(await pixel(result, 40, 40), await pixel(source, 40, 40));
  assert.deepEqual(await pixel(result, 0, 0), [255, 0, 0, 255]);
  await assert.rejects(prepareImageEdit({ source, selection: await solid(64, 96, "#fff"), mode: "remove", model: "Ideogram 4.5" }), /both selected and unselected/);
});

async function pixel(buffer, x, y) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
}

test("image edit sizes preserve supported aspect ratios within provider limits", () => {
  for (const [width, height] of [[1, 1], [3, 1], [1, 3], [1920, 1080], [1080, 1920], [4000, 6000], [6000, 4000], [3840, 2160]]) {
    const size = imageEditSize(width, height);
    assert.ok(size.width > 0 && size.height > 0);
    assert.ok(size.width <= 3840 && size.height <= 3840);
    assert.ok(size.width * size.height >= 655360 && size.width * size.height <= 8294400);
  }
  assert.throws(() => imageEditSize(4000, 1000), /aspect ratios/);
  assert.throws(() => imageEditSize(5000, 5000), /24 megapixels/);
});

test("image edit provider follows supported preferences and available fallbacks", () => {
  assert.equal(imageEditProvider({ imageGeneration: "atlas" }, { atlas: true, fal: true }), "atlas");
  assert.equal(imageEditProvider({ imageGeneration: "fal" }, { atlas: true, fal: true }), "fal");
  assert.equal(imageEditProvider({ imageGeneration: "google" }, { fal: true }), "fal");
  assert.equal(imageEditProvider({ imageGeneration: "google" }, { atlas: true }), "atlas");
  assert.equal(imageEditProvider({ imageGeneration: "google" }, { google: true }), "");
});

test("drawing coordinates stay normalized", () => {
  assert.deepEqual(imageEditPoint(200, 300, { left: 100, top: 100, width: 400, height: 800 }), { x: 0.25, y: 0.25 });
  assert.deepEqual(imageEditPoint(-40, 1200, { left: 100, top: 100, width: 400, height: 800 }), { x: 0, y: 1 });
});

test("image edit prompts distinguish annotations, sketches, selections, and removal", () => {
  assert.match(buildImageEditPrompt({ prompt: "Make the circled jacket blue", hasDrawing: true }), /annotations/);
  assert.match(buildImageEditPrompt({ prompt: "Make the circled jacket blue", hasDrawing: true }), /Remove every guide mark/);
  assert.match(buildImageEditPrompt({ mode: "sketch", blank: true, hasDrawing: true }), /Create one finished image/);
  assert.match(buildImageEditPrompt({ mode: "remove", hasSelection: true }), /Remove the selected content/);
  assert.throws(() => buildImageEditPrompt({ mode: "remove" }), /Select the area/);
  assert.throws(() => buildImageEditPrompt({ prompt: "hello", blank: true }), /only available/);
});

test("annotations retain a clean original as the first reference", async () => {
  const source = await solid(60, 90, "#224466");
  const drawing = await solid(60, 90, { r: 250, g: 20, b: 20, alpha: 0.5 });
  const prepared = await prepareImageEdit({ source, drawing, prompt: "Change the circled object" });
  assert.equal(prepared.images.length, 2);
  assert.deepEqual(await pixel(prepared.images[0], 10, 10), [34, 68, 102, 255]);
  assert.notDeepEqual(await pixel(prepared.images[1], 10, 10), [34, 68, 102, 255]);
});

for (const model of ["OpenAI Image 2.5 Sunburst", "Ideogram 4.5", "Flux 3", "Nano Banana 2.1"]) {
  test(`${model} removes copied annotation ink while keeping the circled edit`, async () => {
    const source = await solid(96, 96, "#224466");
    const drawing = await sharp(Buffer.from('<svg width="96" height="96"><circle cx="48" cy="48" r="28" fill="none" stroke="red" stroke-width="4"/></svg>')).png().toBuffer();
    const prepared = await prepareImageEdit({ source, drawing, prompt: "Make the circled area green", mode: "edit", model });
    // Simulate a provider that makes the requested change but copies the circle.
    const generated = await sharp(await solid(96, 96, "#00ff00")).composite([{ input: drawing }]).png().toBuffer();
    const result = await finishImageEdit(prepared, generated);
    assert.deepEqual(await pixel(result, 76, 48), await pixel(source, 76, 48));
    assert.deepEqual(await pixel(result, 48, 48), [0, 255, 0, 255]);
    assert.deepEqual(await pixel(result, 2, 2), [0, 255, 0, 255]);
    const annotationPixels = await sharp(drawing).ensureAlpha().raw().toBuffer();
    const resultPixels = await sharp(result).ensureAlpha().raw().toBuffer();
    const sourcePixels = await sharp(source).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < annotationPixels.length; i += 4) {
      if (annotationPixels[i + 3]) assert.deepEqual(resultPixels.subarray(i, i + 4), sourcePixels.subarray(i, i + 4));
    }
  });
}

test("sketch rendering preserves generated artwork at drawing locations", async () => {
  const source = await solid(96, 96, "#224466");
  const drawing = await solid(96, 96, "#ff0000");
  const prepared = await prepareImageEdit({ source, drawing, prompt: "Render my drawing", mode: "sketch", model: "Nano Banana 2.1" });
  assert.equal(prepared.annotationMask, null);
  const result = await finishImageEdit(prepared, await solid(96, 96, "#00ff00"));
  assert.deepEqual(await pixel(result, 48, 48), [0, 255, 0, 255]);
});

test("selection preservation and annotation removal compose without losing the edit", async () => {
  const source = await solid(96, 96, "#224466");
  const drawing = await sharp(Buffer.from('<svg width="96" height="96"><circle cx="48" cy="48" r="20" fill="none" stroke="red" stroke-width="3"/></svg>')).png().toBuffer();
  const selection = await sharp(Buffer.from('<svg width="96" height="96"><rect x="15" y="15" width="66" height="66" fill="white"/></svg>')).png().toBuffer();
  const prepared = await prepareImageEdit({ source, drawing, selection, mode: "remove", model: "Flux 3" });
  const result = await finishImageEdit(prepared, await solid(96, 96, "#00ff00"));
  assert.deepEqual(await pixel(result, 2, 2), await pixel(source, 2, 2));
  assert.deepEqual(await pixel(result, 68, 48), await pixel(source, 68, 48));
  assert.deepEqual(await pixel(result, 48, 48), [0, 255, 0, 255]);
});

test("blank sketches send only the drawing on white", async () => {
  const source = await solid(60, 90, "#224466");
  const drawing = await solid(60, 90, { r: 250, g: 20, b: 20, alpha: 0.5 });
  const prepared = await prepareImageEdit({ source, drawing, mode: "sketch", blank: true });
  assert.equal(prepared.images.length, 1);
  assert.ok((await pixel(prepared.images[0], 10, 10))[1] > 100);
});

test("masked edits preserve every unselected RGBA pixel", async () => {
  const source = await solid(60, 90, { r: 20, g: 60, b: 120, alpha: 0.8 });
  const selection = await sharp({ create: { width: 60, height: 90, channels: 4, background: "#00000000" } })
    .composite([{ input: await solid(10, 20, "#ffffff"), left: 20, top: 30 }]).png().toBuffer();
  const prepared = await prepareImageEdit({ source, selection, mode: "remove" });
  const result = await finishImageEdit(prepared, await solid(64, 96, "#fa1414"));
  assert.deepEqual(await pixel(result, 0, 0), await pixel(prepared.original, 0, 0));
  assert.deepEqual(await pixel(result, 25, 35), [250, 20, 20, 255]);
});

test("invalid image edit layers fail before provider submission", async () => {
  const source = await solid(32, 48, "#446688");
  await assert.rejects(prepareImageEdit({ source, selection: await solid(32, 48, "#00000000"), mode: "remove" }), /Select the area/);
  await assert.rejects(prepareImageEdit({ source, drawing: await solid(33, 48, "#ffffff"), prompt: "change" }), /matching/);
  await assert.rejects(prepareImageEdit({ source: Buffer.from("broken"), prompt: "change" }));
});

test("EXIF orientation is normalized before edit layers align", async () => {
  const source = await sharp(await solid(60, 90, "#ffffff")).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const prepared = await prepareImageEdit({ source, prompt: "change" });
  assert.equal(prepared.width, 90);
  assert.equal(prepared.height, 60);
});

test("Flux selection guide marks edits white and preserves unselected original pixels", async () => {
  const source = await solid(64, 96, "#224466");
  const selection = await sharp({ create: { width: 64, height: 96, channels: 4, background: "#00000000" } })
    .composite([{ input: await solid(16, 16, "#ffffff"), left: 0, top: 0 }]).png().toBuffer();
  const prepared = await prepareImageEdit({ source, selection, mode: "remove", model: "Flux 3" });
  assert.deepEqual((await pixel(prepared.mask, 0, 0)).slice(0, 3), [255, 255, 255]);
  assert.deepEqual((await pixel(prepared.mask, 40, 40)).slice(0, 3), [0, 0, 0]);
  assert.match(prepared.submittedPrompt, /last reference/);
  const result = await finishImageEdit(prepared, await solid(64, 96, "#ff0000"));
  assert.deepEqual(await pixel(result, 40, 40), await pixel(source, 40, 40));
  assert.deepEqual(await pixel(result, 0, 0), [255, 0, 0, 255]);
});
