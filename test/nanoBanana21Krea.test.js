import test from "node:test";
import assert from "node:assert/strict";
import { buildKreaImageInput, kreaEndpointForModel, estimateKreaImageCost } from "../src/kreaApi.js";
import { nanoBanana21Ratios } from "../src/nanoBanana21.js";
import { imageModelReferenceLimit } from "../src/imageReferenceLimits.js";
import { estimateImageRunCost } from "../src/generationPricing.js";
import { characterSheetModelOptions } from "../src/characterSheetModels.js";
import { storyboardImageModelOptions, imageModelOptions } from "../src/modelOptions.js";

const modelName = "Nano Banana 2.1";
const options = { modelName, prompt: "Image 1: Hero\n\nKeep the subject", resolution: "4K", aspectRatio: "4:1" };
test("Krea 2.1 preserves all ordered references and high thinking with its exact endpoint", () => {
  const refs = Array.from({ length: 14 }, (_, i) => `https://example.com/${i}.png`);
  assert.equal(kreaEndpointForModel("image", modelName), "/generate/image/google/nano-banana-2.1");
  const input = buildKreaImageInput({ ...options, referenceUrls: refs });
  assert.deepEqual(input.image_urls, refs);
  assert.equal(input.prompt, options.prompt);
  assert.equal(input.thinking_level, "high");
  assert.equal(input.resolution, "4K");
  assert.equal(input.aspect_ratio, "4:1");
  assert.equal(input.num_images, undefined);
  assert.equal(imageModelReferenceLimit(modelName, "krea"), 14);
  for (const patch of [{ aspectRatio: "8:1" }, { resolution: "0.5K" }, { referenceUrls: [...refs, "extra"] }, { referenceUrls: [""] }, { background: "transparent" }, { prompt: "x".repeat(50001) }]) {
    assert.throws(() => buildKreaImageInput({ ...options, ...patch }));
  }
  assert(!nanoBanana21Ratios("krea").includes("8:1"));
  assert(nanoBanana21Ratios("fal").includes("8:1"));
});
test("Krea 2.1 uses independent fixed tariffs and retains older generation models", () => {
  for (const [resolution, expected] of [["1K", .03], ["2K", .0505], ["4K", .0755]]) {
    assert.equal(estimateKreaImageCost({ modelName, resolution }).amountUsd, expected);
    assert.equal(estimateImageRunCost({ model: modelName, provider: "krea", resolution, batchCount: 2 }), expected * 2);
  }
  for (const catalog of [imageModelOptions, characterSheetModelOptions, storyboardImageModelOptions]) assert(catalog.includes(modelName));
  assert(imageModelOptions.includes("Nano Banana 2"));
  assert(imageModelOptions.includes("Ideogram 4.5"));
  assert.equal(kreaEndpointForModel("image", "Nano Banana 2"), "/generate/image/google/nano-banana-2");
});
