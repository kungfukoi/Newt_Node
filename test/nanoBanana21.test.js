import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { buildNanoBanana21Request, estimateNanoBanana21Cost, nanoBanana21AspectRatios, nanoBanana21ResolutionOptions } from "../src/nanoBanana21.js";
import { generateNanoBanana21 } from "../server/nano-banana-21.js";
import { isNanoBanana2Model } from "../src/nanoBanana2.js";
import { enabledImageModelOptions } from "../src/modelOptions.js";
import { normalizeImageEditModel, imageEditModelOptions } from "../src/imageEdit.js";
import { prepareImageEdit, finishImageEdit } from "../server/image-edit.js";
import { characterSheetGenerationSettings } from "../src/characterSheetModels.js";
import { modelProviderOptionState, providerSupportedModels } from "../src/modelProviderRouting.js";
import { estimateImageRunCost, generationProviderForModel } from "../src/generationPricing.js";
import { imageModelReferenceLimit } from "../src/imageReferenceLimits.js";
import { buildImageGenerationRequest } from "../src/nodeRunners/mediaModels.js";

const model = "Nano Banana 2.1";
test("Nano Banana 2.1 is a distinct Fal model across catalogs and saved settings", () => {
  assert.ok(enabledImageModelOptions({}).includes(model));
  assert.ok(imageEditModelOptions.includes(model));
  assert.equal(normalizeImageEditModel(model), model);
  assert.equal(isNanoBanana2Model(model), false);
  assert.equal(isNanoBanana2Model("Nano Banana 2"), true);
  assert.equal(isNanoBanana2Model("Gemini 3.1 Flash Image"), true);
  assert.deepEqual(characterSheetGenerationSettings(model), { model, resolution: "4K" });
  assert.equal(imageModelReferenceLimit(model), null);
  for (const provider of ["fal", "atlas", "krea", "google"]) {
    assert.equal(providerSupportedModels("imageGeneration", provider).includes(model), provider === "fal");
    assert.equal(modelProviderOptionState(model, "image", { imageGeneration: provider }).disabled, ["atlas", "krea"].includes(provider));
    assert.equal(generationProviderForModel({ model, mediaType: "image", providerPreferences: { imageGeneration: provider } }), ["atlas", "krea"].includes(provider) ? null : "fal");
  }
  const request = buildImageGenerationRequest({ node: { id: "image", data: { model, resolution: "4K", aspectRatio: "8:1" } }, prompt: "A panorama", imagePromptItems: [{ url: "/outputs/ref.png", label: "Subject" }] });
  assert.equal(request.model, model);
  assert.equal(request.resolution, "4K");
  assert.deepEqual(request.imagePromptUrls, ["/outputs/ref.png"]);
});

test("Nano Banana 2.1 uses its published schema and does not truncate references", () => {
  for (const aspectRatio of [...nanoBanana21AspectRatios, "auto"]) for (const resolution of nanoBanana21ResolutionOptions) {
    const { endpoint, input } = buildNanoBanana21Request({ prompt: "A landscape", aspectRatio, resolution });
    assert.equal(endpoint, "google/nano-banana-2.1");
    assert.equal(input.resolution, resolution);
    assert.equal(input.aspect_ratio, aspectRatio);
    assert.equal(input.num_images, 1);
    assert.equal(input.thinking_level, "high");
    assert.equal(input.enable_web_search, false);
    assert.equal(input.limit_generations, true);
    assert.equal(input.quality, undefined);
    assert.equal(input.mask_url, undefined);
  }
  const refs = Array.from({ length: 15 }, (_, i) => `https://example.com/${i}.png`);
  const edit = buildNanoBanana21Request({ prompt: "Keep the face", imageUrls: refs, imageLabels: ["Face"] });
  assert.equal(edit.endpoint, "google/nano-banana-2.1/edit");
  assert.deepEqual(edit.input.image_urls, refs);
  assert.match(edit.submittedPrompt, /Image 1: Face/);
  assert.throws(() => buildNanoBanana21Request({ prompt: "test", resolution: "0.5K" }), /1K, 2K, or 4K/);
  assert.throws(() => buildNanoBanana21Request({ prompt: "test", aspectRatio: "2:1" }), /aspect ratio/);
  assert.throws(() => buildNanoBanana21Request({ prompt: "" }), /prompt/);
});

test("generation sends one request, preserves metadata, and fails before upload on invalid controls", async () => {
  const uploads = [], calls = [];
  const deps = { upload: async asset => { uploads.push(asset); return `ref-${uploads.length}`; },
    subscribe: async (endpoint, options) => { calls.push({ endpoint, ...options }); return { requestId: "paid-id", data: { images: [{ url: "result" }], description: "Edited" } }; },
    firstImage: data => data.images?.[0] };
  const result = await generateNanoBanana21({ prompt: "Edit image", images: [Buffer.from("image")], mask: Buffer.from("mask"), resolution: "4K" }, deps);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, "google/nano-banana-2.1/edit");
  assert.deepEqual(calls[0].input.image_urls, ["ref-1", "ref-2"]);
  assert.equal(calls[0].input.mask_url, undefined);
  assert.equal(result.resultText, "Edited");
  assert.equal(result.requestId, "paid-id");
  assert.equal(result.cost.amountUsd, 0.162);
  await assert.rejects(generateNanoBanana21({ prompt: "Edit image", images: [Buffer.from("image")], resolution: "8K" }, deps), /1K, 2K, or 4K/);
  assert.equal(calls.length, 1); assert.equal(uploads.length, 2);
  let failures = 0;
  await assert.rejects(generateNanoBanana21({ prompt: "A landscape" }, { ...deps, subscribe: async () => { failures++; throw new Error("Provider unavailable"); } }), /Provider unavailable/);
  assert.equal(failures, 1);
  await assert.rejects(generateNanoBanana21({ prompt: "A landscape" }, { ...deps, subscribe: async () => ({ data: {} }) }), /Check Fal history/);
});

test("Nano Banana 2.1 selected edits use a guide and preserve unselected pixels", async () => {
  const source = await sharp({ create: { width: 64, height: 64, channels: 4, background: "red" } }).png().toBuffer();
  const selection = await sharp({ create: { width: 64, height: 64, channels: 4, background: "transparent" } }).composite([{ input: await sharp({ create: { width: 32, height: 64, channels: 4, background: "white" } }).png().toBuffer(), left: 0, top: 0 }]).png().toBuffer();
  const prepared = await prepareImageEdit({ source, selection, model, mode: "remove" });
  assert.match(prepared.submittedPrompt, /last reference.*selection guide/);
  const mask = await sharp(prepared.mask).raw().toBuffer();
  assert.equal(mask[0], 255); assert.equal(mask[mask.length - 1], 0);
  const blue = await sharp({ create: { width: 64, height: 64, channels: 4, background: "blue" } }).png().toBuffer();
  const output = await sharp(await finishImageEdit(prepared, blue)).raw().toBuffer();
  assert.deepEqual([...output.subarray(0, 4)], [0, 0, 255, 255]);
  assert.deepEqual([...output.subarray(-4)], [255, 0, 0, 255]);
});

test("Nano Banana 2.1 pricing includes high thinking and batch size", () => {
  assert.equal(estimateNanoBanana21Cost({ resolution: "1K" }).amountUsd, 0.082);
  assert.equal(estimateImageRunCost({ model, resolution: "2K", batchCount: 3, provider: "fal" }), 0.366);
  assert.equal(estimateImageRunCost({ model, resolution: "2K", provider: "atlas" }), null);
});
