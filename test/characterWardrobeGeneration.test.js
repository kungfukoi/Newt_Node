import test from "node:test";
import assert from "node:assert/strict";

import { generateCharacterWardrobeVariant } from "../src/characterWardrobeGeneration.js";
import { characterWardrobeEditVersion } from "../src/characterSheetWorkflow.js";

test("character wardrobe edits never submit a provider mask", async () => {
  const requests = [];
  const node = {
    data: {
      stylizedCharacter: true,
      cinematicCharacterSheet: true,
      cuVideoGeneration: true
    }
  };
  const wardrobe = { id: "workwear", localUrl: "/uploads/workwear.png", fileName: "workwear.png" };
  const runWardrobeEdit = async (request) => {
    requests.push(request);
    return request.sheetKind === "video"
      ? { url: "/outputs/workwear-video.png" }
      : { url: "/outputs/workwear.png" };
  };

  const { variant } = await generateCharacterWardrobeVariant(node, wardrobe, {
    baseSheet: { url: "/outputs/base.png" },
    baseVideoSheet: { url: "/outputs/base-video.png" },
    baseSignature: "base-v2",
    baseVideoSignature: "base-video-v2",
    regenerateImage: true,
    regenerateVideo: true,
    runWardrobeEdit
  });

  assert.equal(requests.length, 2);
  assert.equal(requests.every((request) => !("editMaskDataUrl" in request)), true);
  assert.match(requests[0].prompt, /complete unobstructed sheet/i);
  assert.match(requests[0].prompt, /gray cyc continuity/i);
  assert.equal(variant.wardrobeEditVersion, characterWardrobeEditVersion);
  assert.equal(variant.generated.url, "/outputs/workwear.png");
  assert.equal(variant.videoGenerated.url, "/outputs/workwear-video.png");
});
