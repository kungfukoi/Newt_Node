import test from "node:test";
import assert from "node:assert/strict";
import { openAiImage25Models as models, openAiImage25Variant, normalizeOpenAiImage25Model, migrateImageModelSelections } from "../src/openAiImageModels.js";
import { imageModelOptions, normalizeModelPreferences } from "../src/modelOptions.js";
import { buildAtlasImageRequest } from "../src/atlasMedia.js";
import { buildKreaImageInput, kreaEndpointForModel } from "../src/kreaApi.js";
import { openAiImage2FalEndpoint } from "../src/openAiImage2.js";
import { normalizeUserPreferences } from "../src/userPreferences.js";
import { estimateImageRunCost } from "../src/generationPricing.js";
import { characterSheetGenerationSettings } from "../src/characterSheetModels.js";

test("saved variants and nested Explore queues migrate without rewriting historical media", () => {
  const old = { model: "OpenAI Image 2.5", openAiImageVariant: "sunburst", frameItImageModel: "GPT Image 2.5", characterSheetModel: "OpenAI Image 2.5",
    resultItems: [{ url: "/outputs/old.png", model: "OpenAI Image 2.5" }], exploreQueue: [{ settings: { model: "OpenAI Image 2.5", openAiImageVariant: "flare" } }] };
  const next = migrateImageModelSelections(old);
  assert.equal(next.model, models.sunburst);
  assert.equal(next.characterSheetModel, models.sunburst);
  assert.equal(next.frameItImageModel, models.sunburst);
  assert.equal(next.exploreQueue[0].settings.model, models.flare);
  assert.deepEqual(next.resultItems, old.resultItems);
  assert.equal(old.model, "OpenAI Image 2.5");
  assert.deepEqual(migrateImageModelSelections(next), next);
  assert.equal(normalizeOpenAiImage25Model(models.flare, "sunburst"), models.flare);
  assert.equal(normalizeOpenAiImage25Model("OpenAI Image 2"), "OpenAI Image 2");
});

test("model and editor preferences preserve explicit choices and old defaults", () => {
  assert.ok(imageModelOptions.includes(models.flare));
  assert.ok(imageModelOptions.includes(models.sunburst));
  assert.ok(!imageModelOptions.includes("OpenAI Image 2.5"));
  const disabled = normalizeModelPreferences({ image: { "OpenAI Image 2.5": false, [models.sunburst]: true } });
  assert.equal(disabled.image[models.flare], false);
  assert.equal(disabled.image[models.sunburst], true);
  assert.equal(normalizeUserPreferences({ imageEditorModel: "OpenAI Image 2.5" }).imageEditorModel, models.sunburst);
  for (const model of Object.values(models)) {
    assert.equal(normalizeUserPreferences({ imageEditorModel: model }).imageEditorModel, model);
    assert.equal(characterSheetGenerationSettings(model).model, model);
    assert.equal(characterSheetGenerationSettings(model).quality, "high");
  }
});

test("explicit names control Fal, Atlas and Krea endpoints despite a stale variant field", () => {
  for (const [variant, model] of Object.entries(models)) {
    assert.match(openAiImage2FalEndpoint({ variant: openAiImage25Variant(model, variant === "flare" ? "sunburst" : "flare"), edit: true }), new RegExp(`/${variant}/edit$`));
    const atlas = buildAtlasImageRequest({ model, variant: variant === "flare" ? "sunburst" : "flare", prompt: "test" });
    assert.ok(JSON.stringify(atlas).includes(`gpt-image-2.5-${variant}/text-to-image`));
    assert.equal(kreaEndpointForModel("image", model), `/generate/image/openai/gpt-image-2.5-${variant}`);
    const krea = buildKreaImageInput({ modelName: model, prompt: "test", quality: "max", resolution: "4K", aspectRatio: "16:9" });
    assert.equal(krea.quality, "max");
    assert.equal(krea.resolution, "4K");
    assert.equal(Object.hasOwn(krea, "background"), variant === "flare");
    assert.equal(estimateImageRunCost({ model, provider: "krea" }), null);
  }
  assert.throws(() => buildKreaImageInput({ modelName: models.sunburst, prompt: "test", background: "transparent" }), /background/);
  assert.throws(() => buildKreaImageInput({ modelName: models.flare, prompt: "test", referenceUrls: Array(11).fill("https://example.com/a.png") }), /10 references/);
  assert.throws(() => buildKreaImageInput({ modelName: models.flare, prompt: "test", aspectRatio: "21:9" }), /aspect ratio/);
});
