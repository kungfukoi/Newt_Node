import test from "node:test";
import assert from "node:assert/strict";

import {
  characterBaseAppearancePromptForData,
  characterBaseGenerationSignature,
  characterBaseSheetPromptForData,
  characterBaseVideoGenerationSignature,
  characterBaseVariant,
  characterSheetPrompt,
  characterNeutralBaseWardrobePrompt,
  characterVideoBaseAppearancePromptForData,
  characterVideoIdentityContinuityPromptForData,
  characterVideoNeutralBaseWardrobePrompt,
  characterVideoWardrobeEditPrompt,
  characterWardrobeEditPrompt,
  characterWardrobeEditPromptForData,
  characterWardrobeEditVersion,
  characterWardrobeVariantIsCurrent,
  cinematicCharacterSheetPrompt,
  cinematicCharacterSheetWithGrayCycPrompt,
  stylizedCinematicCharacterSheetPrompt,
  stylizedCharacterSheetPrompt,
  upsertCharacterWardrobeVariant
} from "../src/characterSheetWorkflow.js";

test("the identity base uses a neutral reference garment instead of a designed wardrobe", () => {
  assert.match(characterNeutralBaseWardrobePrompt, /identity foundation/i);
  assert.match(characterNeutralBaseWardrobePrompt, /no styling, branding, patterns/i);
  assert.match(characterNeutralBaseWardrobePrompt, /no nudity/i);
});

test("wardrobe edits lock identity and composition to the base sheet", () => {
  assert.match(characterWardrobeEditPrompt, /locked master image/i);
  assert.match(characterWardrobeEditPrompt, /change only the character's clothing/i);
  assert.match(characterWardrobeEditPrompt, /sole authority for identity, anatomy, composition/i);
  assert.match(characterVideoWardrobeEditPrompt, /exact canvas dimensions, three-panel layout/i);
  assert.match(characterVideoWardrobeEditPrompt, /hard crop lock/i);
  assert.match(characterVideoWardrobeEditPrompt, /only panel where the character's head or face may be visible/i);
  assert.match(characterVideoWardrobeEditPrompt, /not a layout, framing, crop, pose, or camera reference/i);
});

test("Stylized Character is opt-in while Cinematic adds the gray cyc treatment", () => {
  assert.equal(characterBaseSheetPromptForData({}), characterSheetPrompt);
  assert.equal(characterBaseSheetPromptForData({ cinematicCharacterSheet: true }), cinematicCharacterSheetWithGrayCycPrompt);
  assert.match(cinematicCharacterSheetWithGrayCycPrompt, /realistic neutral-gray seamless studio cyclorama/i);
  assert.match(cinematicCharacterSheetWithGrayCycPrompt, new RegExp(cinematicCharacterSheetPrompt.slice(0, 40)));
  assert.equal(characterBaseAppearancePromptForData({}), characterNeutralBaseWardrobePrompt);
  assert.equal(characterVideoBaseAppearancePromptForData({}), characterVideoNeutralBaseWardrobePrompt);
  assert.equal(characterWardrobeEditPromptForData({}), characterWardrobeEditPrompt);
  assert.equal(characterWardrobeEditPromptForData({}, "video"), characterVideoWardrobeEditPrompt);
  assert.match(characterWardrobeEditPromptForData({ cinematicCharacterSheet: true }), /gray cyc continuity/i);
  assert.match(characterWardrobeEditPromptForData({ cinematicCharacterSheet: true }, "video"), /gray cyc continuity/i);
});

test("Stylized Character prompts preserve reference-relative features without assuming an anatomy", () => {
  const data = { stylizedCharacter: true, cinematicCharacterSheet: true };
  assert.equal(characterBaseSheetPromptForData(data), stylizedCinematicCharacterSheetPrompt);
  assert.equal(characterBaseSheetPromptForData({ stylizedCharacter: true }), stylizedCharacterSheetPrompt);
  assert.match(characterBaseSheetPromptForData(data), /realistic neutral-gray seamless studio cyclorama/i);
  assert.doesNotMatch(characterBaseSheetPromptForData(data), /on a clean white background/i);
  assert.match(characterBaseSheetPromptForData(data), /presence or absence, count, shape, scale, placement/i);
  assert.match(characterBaseSheetPromptForData(data), /feature that exists in the reference must remain/i);
  assert.match(characterBaseAppearancePromptForData(data), /preserve the character exactly as shown/i);
  assert.match(characterVideoBaseAppearancePromptForData(data), /feature presence or absence/i);
  assert.match(characterVideoIdentityContinuityPromptForData(data), /never add a feature that is absent/i);
  assert.match(characterWardrobeEditPromptForData(data), /fit the wardrobe to the character's existing form without changing that form/i);
  assert.match(characterWardrobeEditPromptForData(data, "video"), /primary head or identity region/i);
  assert.match(characterWardrobeEditPromptForData(data), /complete unobstructed sheet/i);
  assert.match(characterWardrobeEditPromptForData(data, "video"), /complete unobstructed sheet/i);
});

test("base signatures change only when identity-generation inputs change", () => {
  const data = {
    characterPortrait: { localUrl: "/uploads/person.png" },
    characterSheetModel: "Nano Banana 2",
    cinematicCharacterSheet: true,
    characterPhysicalDetails: "Scar above left eyebrow"
  };
  assert.equal(characterBaseGenerationSignature(data), characterBaseGenerationSignature({ ...data }));
  assert.notEqual(
    characterBaseGenerationSignature(data),
    characterBaseGenerationSignature({ ...data, cinematicCharacterSheet: false })
  );
  assert.notEqual(
    characterBaseGenerationSignature(data),
    characterBaseGenerationSignature({ ...data, characterPhysicalDetails: "No scar" })
  );
  assert.notEqual(
    characterBaseGenerationSignature(data),
    characterBaseGenerationSignature({ ...data, stylizedCharacter: true })
  );
  assert.notEqual(
    characterBaseVideoGenerationSignature(data),
    characterBaseVideoGenerationSignature({ ...data, stylizedCharacter: true })
  );
  assert.notEqual(
    characterBaseGenerationSignature({ ...data, stylizedCharacter: true }),
    characterBaseGenerationSignature({ ...data, stylizedCharacter: true, cinematicCharacterSheet: false })
  );
  assert.notEqual(
    characterBaseVideoGenerationSignature({ ...data, stylizedCharacter: true }),
    characterBaseVideoGenerationSignature({ ...data, stylizedCharacter: true, cinematicCharacterSheet: false })
  );
});

test("CU wardrobe variants track the CU base workflow signature", () => {
  const baseVideoSignature = characterBaseVideoGenerationSignature("base-v1", { url: "/outputs/base.png" });
  const wardrobe = { id: "blue", localUrl: "/uploads/blue.png" };
  const variant = {
    wardrobeId: "blue",
    wardrobeUrl: wardrobe.localUrl,
    baseSignature: "base-v1",
    baseVideoSignature,
    wardrobeEditVersion: characterWardrobeEditVersion,
    generated: { url: "/outputs/blue.png" },
    videoGenerated: { url: "/outputs/blue-video.png" }
  };
  assert.equal(characterWardrobeVariantIsCurrent(variant, wardrobe, "base-v1", { requireVideo: true, baseVideoSignature }), true);
  assert.equal(characterWardrobeVariantIsCurrent(variant, wardrobe, "base-v1", { requireVideo: true, baseVideoSignature: "stale" }), false);
});

test("wardrobe variants are reusable only for the same base and wardrobe asset", () => {
  const wardrobe = { id: "blue", localUrl: "/uploads/blue.png" };
  const variant = {
    wardrobeId: "blue",
    wardrobeUrl: "/uploads/blue.png",
    baseSignature: "base-v1",
    wardrobeEditVersion: characterWardrobeEditVersion,
    generated: { url: "/outputs/blue-sheet.png" },
    videoGenerated: { url: "/outputs/blue-video-sheet.png" }
  };
  assert.equal(characterWardrobeVariantIsCurrent(variant, wardrobe, "base-v1"), true);
  assert.equal(characterWardrobeVariantIsCurrent(variant, wardrobe, "base-v2"), false);
  assert.equal(characterWardrobeVariantIsCurrent({ ...variant, wardrobeEditVersion: 1 }, wardrobe, "base-v1"), false);
  assert.equal(characterWardrobeVariantIsCurrent({
    wardrobeId: "blue",
    wardrobeUrl: wardrobe.localUrl,
    baseSignature: "base-v1",
    generated: variant.generated
  }, wardrobe, "base-v1"), false);
  assert.equal(characterWardrobeVariantIsCurrent({ ...variant, videoGenerated: null }, wardrobe, "base-v1", { requireVideo: true }), false);
});

test("locally restored wardrobe variants remain reusable", () => {
  const wardrobe = { id: "local", localUrl: "/uploads/local.png" };
  const variant = {
    wardrobeId: "local",
    wardrobeUrl: "/uploads/local.png",
    baseSignature: "base-v1",
    wardrobeEditVersion: characterWardrobeEditVersion,
    generated: { localUrl: "/outputs/local-sheet.png" },
    videoGenerated: { localUrl: "/outputs/local-video-sheet.png" }
  };
  assert.equal(characterWardrobeVariantIsCurrent(variant, wardrobe, "base-v1"), true);
  assert.equal(characterWardrobeVariantIsCurrent(variant, wardrobe, "base-v1", { requireVideo: true }), true);
});

test("the base variant remains first when a single wardrobe is retried", () => {
  const base = characterBaseVariant({
    baseSheet: { url: "/outputs/base.png" },
    baseSignature: "base-v1"
  });
  const red = { wardrobeId: "red", generated: { url: "/outputs/red.png" } };
  const blue = { wardrobeId: "blue", generated: { url: "/outputs/blue.png" } };
  const nextBlue = { wardrobeId: "blue", generated: { url: "/outputs/blue-retry.png" } };
  const variants = upsertCharacterWardrobeVariant([base, red, blue], nextBlue);
  assert.deepEqual(variants.map((variant) => variant.wardrobeId), ["__default-wardrobe__", "red", "blue"]);
  assert.equal(variants[2].generated.url, "/outputs/blue-retry.png");
});
