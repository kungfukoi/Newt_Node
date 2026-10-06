import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { buildFlux3Request, estimateFlux3Cost, flux3AspectRatios, flux3ResolutionOptions } from "../src/flux3.js";
import { generateFlux3, prepareFlux3Reference } from "../server/flux3.js";
import { enabledImageModelOptions } from "../src/modelOptions.js";
import { imageEditModelOptions, normalizeImageEditModel } from "../src/imageEdit.js";
import { providerSupportedModels } from "../src/modelProviderRouting.js";
import { characterSheetGenerationSettings } from "../src/characterSheetModels.js";
import { imageModelReferenceLimit } from "../src/imageReferenceLimits.js";
import { estimateImageRunCost } from "../src/generationPricing.js";
const solid = (width, height) => sharp({ create: { width, height, channels: 3, background: "red" } }).png().toBuffer();
test("Flux 3 is available across image choices, preferences and Fal only", () => {
  assert.ok(enabledImageModelOptions({}).includes("Flux 3")); assert.ok(imageEditModelOptions.includes("Flux 3"));
  assert.equal(normalizeImageEditModel("Flux 3"), "Flux 3");
  assert.deepEqual(characterSheetGenerationSettings("Flux 3"), { model: "Flux 3", resolution: "4K" });
  assert.equal(imageModelReferenceLimit("Flux 3", "fal"), 10);
  for (const provider of ["fal", "atlas", "krea", "google"]) assert.equal(providerSupportedModels("imageGeneration", provider).includes("Flux 3"), provider === "fal");
});
test("Flux 3 submits supported controls to exact generation and edit endpoints", () => {
  for (const aspectRatio of flux3AspectRatios) for (const resolution of flux3ResolutionOptions) {
    const request = buildFlux3Request({ prompt: "Poster", aspectRatio, resolution });
    assert.equal(request.endpoint, "blackforestlabs/flux-3/text-to-image");
    assert.equal(request.input.resolution, resolution.toLowerCase()); assert.equal(request.input.aspect_ratio, aspectRatio);
    assert.equal(request.input.output_format, "png"); assert.equal(request.input.quality, undefined);
  }
  const refs = Array.from({ length: 10 }, (_, i) => "ref-" + i);
  const edit = buildFlux3Request({ prompt: "Edit", imageUrls: refs, imageLabels: ["Base", "Face"], aspectRatio: "auto" });
  assert.equal(edit.endpoint, "blackforestlabs/flux-3/edit-image"); assert.deepEqual(edit.input.image_urls, refs);
  assert.match(edit.submittedPrompt, /Image 2: Face/);
  assert.throws(() => buildFlux3Request({ prompt: "Edit", imageUrls: [...refs, "extra"] }), /10 reference/);
  assert.throws(() => buildFlux3Request({ prompt: "Edit", resolution: "8K" }), /1K, 2K, or 4K/);
});
test("Flux references meet pixel bounds without cropping", async () => {
  for (const [w, h] of [[4000, 3000], [64, 96], [1000, 750]]) {
    const result = await prepareFlux3Reference(await solid(w, h)); const { width, height } = await sharp(result.buffer).metadata();
    assert.ok(width * height <= 4000000); assert.ok(Math.min(width, height) >= 256);
    assert.ok(Math.abs(width / height - w / h) < 0.01);
  }
  await assert.rejects(prepareFlux3Reference(await solid(16000, 100)), /too narrow/);
});
test("Flux selection guide is a final reference, with no unsupported native mask or paid retry", async () => {
  let generations = 0; const uploads = [], submissions = [];
  const image = await solid(300, 400);
  const deps = { upload: async asset => { uploads.push(asset); return "ref-" + uploads.length; },
    subscribe: async (endpoint, options) => { generations++; submissions.push({ endpoint, ...options }); return { requestId: "id", data: { images: [{ url: "result" }] } }; }, firstImage: data => data.images[0] };
  const result = await generateFlux3({ prompt: "Edit", images: [image], mask: image, aspectRatio: "auto", resolution: "4K" }, deps);
  assert.equal(generations, 1); assert.equal(uploads.length, 2); assert.deepEqual(submissions[0].input.image_urls, ["ref-1", "ref-2"]);
  assert.equal(submissions[0].input.mask_url, undefined); assert.equal(result.requestId, "id"); assert.equal(result.cost.estimated, true);
  await assert.rejects(generateFlux3({ prompt: "Edit", images: Array(11).fill(image) }, deps), /10 reference/);
  assert.equal(generations, 1); assert.equal(uploads.length, 2);
});
test("Flux pricing explicitly estimates standard rates and scales batches", () => {
  assert.equal(estimateFlux3Cost({ resolution: "4K" }).amountUsd, 0.607);
  assert.match(estimateFlux3Cost().pricingBasis, /Fal account charges may differ/);
  assert.equal(estimateImageRunCost({ model: "Flux 3", resolution: "2K", batchCount: 3, provider: "fal" }), 0.3);
});
