import test from "node:test";
import assert from "node:assert/strict";
import { buildIdeogram45Request, ideogram45AspectRatios, ideogram45ImageSize } from "../src/ideogram45.js";
import { generateIdeogram45 } from "../server/ideogram45.js";
import { enabledImageModelOptions } from "../src/modelOptions.js";
import { imageReferenceLimitError } from "../src/imageReferenceLimits.js";
import { characterSheetGenerationSettings } from "../src/characterSheetModels.js";
import { generationProviderForModel, estimateImageRunCost } from "../src/generationPricing.js";

test("Ideogram is enabled in the image catalog, uses Fal, and retains an honest unknown price", () => {
  assert.ok(enabledImageModelOptions({}).includes("Ideogram 4.5"));
  assert.equal(generationProviderForModel({ model: "Ideogram 4.5", mediaType: "image" }), "fal");
  assert.equal(estimateImageRunCost({ model: "Ideogram 4.5" }), null);
  assert.deepEqual(characterSheetGenerationSettings("Ideogram 4.5"), { model: "Ideogram 4.5", resolution: "2K" });
  assert.match(imageReferenceLimitError({ model: "Ideogram 4.5", count: 6 }), /up to 5/);
});

test("text generation uses supported sizes and the text endpoint", () => {
  for (const ratio of ideogram45AspectRatios) for (const resolution of ["1K", "2K"]) {
    const request = buildIdeogram45Request({ prompt: "A poster", aspectRatio: ratio, resolution });
    assert.equal(request.endpoint, "ideogram/v4.5");
    assert.deepEqual(request.input.image_size, ideogram45ImageSize(ratio, resolution));
    assert.equal(request.input.image_url, undefined);
    assert.equal(request.input.quality, "high");
  }
});

test("edits preserve ordered source and references without truncation", () => {
  const request = buildIdeogram45Request({ prompt: "New outfit", imageUrls: ["source", "wardrobe", "face"], imageLabels: ["Base", "Wardrobe", "Face"], aspectRatio: "21:9", resolution: "2K" });
  assert.equal(request.endpoint, "ideogram/v4.5/edit");
  assert.equal(request.input.image_url, "source");
  assert.deepEqual(request.input.reference_image_urls, ["wardrobe", "face"]);
  assert.match(request.submittedPrompt, /Image 1 \(source\): Base/);
  assert.ok(Math.abs(request.input.image_size.width / request.input.image_size.height - 21 / 9) < 0.05);
  assert.throws(() => buildIdeogram45Request({ prompt: "Edit", imageUrls: Array(6).fill("ref") }), /at most 5/);
  assert.throws(() => buildIdeogram45Request({ prompt: "Edit", imageUrls: Array(5).fill("ref"), maskUrl: "mask" }), /at most 4/);
});

test("precise masked edits preserve geometry and reject invalid quality", () => {
  const request = buildIdeogram45Request({ prompt: "Remove", imageUrls: ["source", "guide"], maskUrl: "mask", editPrecision: "high" });
  assert.equal(request.input.mask_url, "mask");
  assert.equal(request.input.image_size, "auto");
  assert.equal(request.input.edit_precision, "high");
  assert.throws(() => buildIdeogram45Request({ prompt: "Edit", quality: "xhigh" }), /quality/);
});

test("Fal adapter uploads images and mask, submits once, and returns provider metadata", async () => {
  const submissions = [];
  let uploads = 0;
  const dependencies = { upload: async () => `uploaded-${++uploads}`, subscribe: async (endpoint, request) => {
    submissions.push({ endpoint, input: request.input });
    return { requestId: "job", data: { images: [{ url: "result.png" }] } };
  }, firstImage: (data) => data?.images?.[0] };
  const result = await generateIdeogram45({ prompt: "Edit", images: [Buffer.from("source"), Buffer.from("guide")], mask: Buffer.from("mask"), editPrecision: "high" }, dependencies);
  assert.equal(uploads, 3);
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].input.mask_url, "uploaded-3");
  assert.equal(result.requestId, "job");
  assert.equal(result.cost.amountUsd, null);
  await assert.rejects(generateIdeogram45({ prompt: "Edit", images: Array(6).fill(Buffer.from("ref")) }, dependencies), /limit/);
  assert.equal(submissions.length, 1);
});
