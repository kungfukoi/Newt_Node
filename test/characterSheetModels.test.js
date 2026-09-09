import test from "node:test";
import assert from "node:assert/strict";
import {
  characterSheetGenerationSettings,
  characterSheetModelOptions,
  mergeGeneratedCharacterSheetVariants,
  normalizeCharacterSheetModel
} from "../src/characterSheetModels.js";
import { imageModelNames } from "../src/modelOptions.js";

test("character sheets default to Nano Banana 2 at 4K", () => {
  assert.equal(normalizeCharacterSheetModel(""), imageModelNames.nanoBanana2);
  assert.deepEqual(characterSheetGenerationSettings(""), {
    model: imageModelNames.nanoBanana2,
    resolution: "4K"
  });
});

test("character sheets support Nano Banana Pro at 4K", () => {
  assert.ok(characterSheetModelOptions.includes(imageModelNames.nanoBananaPro));
  assert.deepEqual(characterSheetGenerationSettings(imageModelNames.nanoBananaPro), {
    model: imageModelNames.nanoBananaPro,
    resolution: "4K"
  });
});

test("character sheets expose the mirrored choices and reject removed Seedream selections", () => {
  assert.deepEqual(characterSheetModelOptions, [
    imageModelNames.nanoBanana2,
    imageModelNames.nanoBananaPro,
    imageModelNames.openAiImage2
  ]);
  assert.equal(characterSheetModelOptions.includes(imageModelNames.seedream5Pro), false);
  assert.deepEqual(characterSheetGenerationSettings(imageModelNames.seedream5Pro), {
    model: imageModelNames.nanoBanana2,
    resolution: "4K"
  });
});

test("legacy OpenAI Image 2 character sheets migrate to OpenAI Image 2.5", () => {
  assert.equal(normalizeCharacterSheetModel("OpenAI Image 2"), imageModelNames.openAiImage2);
});

test("partial Character regeneration replaces successes and preserves prior failed wardrobe sheets", () => {
  const previousA = { wardrobeId: "wardrobe-a", generated: { url: "/outputs/a-old.png" } };
  const previousB = { wardrobeId: "wardrobe-b", generated: { url: "/outputs/b-old.png" } };
  const regeneratedA = { wardrobeId: "wardrobe-a", generated: { url: "/outputs/a-new.png" } };

  assert.deepEqual(
    mergeGeneratedCharacterSheetVariants([previousA, previousB], [regeneratedA], ["wardrobe-a", "wardrobe-b"]),
    [regeneratedA, previousB]
  );
});
