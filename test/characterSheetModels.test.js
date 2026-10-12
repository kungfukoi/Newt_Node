import test from "node:test";
import assert from "node:assert/strict";
import {
  characterSheetGenerationSettings,
  characterSheetModelOptions,
  mergeGeneratedCharacterSheetVariants,
  normalizeCharacterSheetModel
} from "../src/characterSheetModels.js";
import { imageModelNames } from "../src/modelOptions.js";

test("new character sheets default to Nano Banana Pro at 4K", () => {
  assert.equal(normalizeCharacterSheetModel(""), imageModelNames.nanoBananaPro);
  assert.deepEqual(characterSheetGenerationSettings(""), {
    model: imageModelNames.nanoBananaPro,
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

test("character sheets add Seedream without removing local model choices", () => {
  assert.deepEqual(characterSheetModelOptions, [
    imageModelNames.nanoBanana2,
    imageModelNames.nanoBananaPro,
    imageModelNames.seedream5Pro,
    imageModelNames.openAiImage2,
    imageModelNames.openAiImage25Sunburst,
    imageModelNames.ideogram45,
    imageModelNames.flux3,
    imageModelNames.nanoBanana21
  ]);
  assert.equal(characterSheetModelOptions.includes(imageModelNames.seedream5Pro), true);
  assert.deepEqual(characterSheetGenerationSettings(imageModelNames.seedream5Pro), {
    model: imageModelNames.seedream5Pro,
    resolution: "2K"
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
