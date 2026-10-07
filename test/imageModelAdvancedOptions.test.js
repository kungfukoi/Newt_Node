import test from "node:test";
import assert from "node:assert/strict";
import { buildImageGenerationRequest } from "../src/nodeRunners/mediaModels.js";
import { buildFlux3Request, estimateFlux3Cost } from "../src/flux3.js";
import { buildIdeogram45Request } from "../src/ideogram45.js";
import { generateIdeogram45 } from "../server/ideogram45.js";

test("Flux options survive the image runner and apply to generation and editing", () => {
  const flux3Options = { outputFormat: "jpeg", enablePromptExpansion: true, safetyTolerance: 0, version: "latest" };
  const request = buildImageGenerationRequest({ node: { id: "image", data: { model: "Flux 3", resolution: "768SQ", flux3Options, ideogram45Options: { quality: "low" } } }, prompt: "Poster" });
  assert.deepEqual(request.flux3Options, flux3Options);
  assert.equal(request.ideogram45Options, undefined);
  for (const imageUrls of [[], ["reference"]]) {
    const { input } = buildFlux3Request({ ...request, ...request.flux3Options, imageUrls });
    assert.equal(input.resolution, "768sq");
    assert.equal(input.output_format, "jpeg");
    assert.equal(input.enable_prompt_expansion, true);
    assert.equal(input.safety_tolerance, 0);
    assert.equal(input.version, "latest");
    assert.equal(input.quality, undefined);
  }
  assert.equal(estimateFlux3Cost({ resolution: "768SQ" }).pricingStatus, "unpriced");
  for (const safetyTolerance of [-1, 5, 0.5, "2"]) assert.throws(() => buildFlux3Request({ prompt: "Poster", safetyTolerance }), /tolerance/);
});

test("Ideogram controls honor text and reference-edit capabilities", () => {
  const node = { id: "image", data: { model: "Ideogram 4.5", ideogram45Options: { quality: "low", seed: "0", enablePromptExpansion: true, imageSize: "3072x1024" } } };
  const request = buildImageGenerationRequest({ node, prompt: "Poster" });
  const { input } = buildIdeogram45Request({ ...request, ...request.ideogram45Options });
  assert.equal(input.quality, "low");
  assert.equal(input.seed, 0);
  assert.equal(input.enable_prompt_expansion, true);
  assert.deepEqual(input.image_size, { width: 3072, height: 1024 });
  node.data.ideogram45Options.quality = "very_low";
  const text = buildImageGenerationRequest({ node, prompt: "Poster" });
  assert.equal(text.ideogram45Options.quality, "high");
  const edit = buildImageGenerationRequest({ node, prompt: "Edit", imagePromptItems: [{ url: "ref" }] });
  for (const options of [{ editPrecision: "high" }, { preserveSourceSize: true }]) {
    const built = buildIdeogram45Request({ ...edit, ...edit.ideogram45Options, imageUrls: ["ref"], ...options });
    assert.equal(built.input.quality, "very_low");
    assert.equal(built.input.image_size, "auto");
    assert.equal(built.input.enable_prompt_expansion, undefined);
  }
  assert.throws(() => buildIdeogram45Request({ prompt: "Poster", quality: "very_low" }), /quality/);
  assert.throws(() => buildIdeogram45Request({ prompt: "Poster", seed: "1.5" }), /seed/);
  assert.throws(() => buildIdeogram45Request({ prompt: "Poster", imageSize: "99x99" }), /size/);
  assert.throws(() => buildIdeogram45Request({ prompt: "Edit", imageUrls: ["ref"], imageSize: "1296x3168" }), /multiples of 32/);
});

test("old workflows retain provider defaults and invalid controls fail before upload", async () => {
  const legacy = buildImageGenerationRequest({ node: { id: "image", data: { model: "Ideogram 4.5", quality: "max" } }, prompt: "Poster" });
  assert.equal(buildIdeogram45Request({ ...legacy, ...legacy.ideogram45Options }).input.quality, "high");
  let uploads = 0;
  await assert.rejects(generateIdeogram45({ prompt: "Edit", images: [Buffer.from("ref")], seed: "bad" }, { upload: async () => { uploads++; } }), /seed/);
  assert.equal(uploads, 0);
});
