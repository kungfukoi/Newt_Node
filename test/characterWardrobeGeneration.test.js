import test from "node:test";
import assert from "node:assert/strict";

import { generateCharacterWardrobeVariant } from "../src/characterWardrobeGeneration.js";
import { characterWardrobeEditVersion } from "../src/characterSheetWorkflow.js";

test("completed wardrobe images are checkpointed before their CU edit finishes", async () => {
  const checkpoints = [];
  let releaseVideo;
  const gate = new Promise(resolve => { releaseVideo = resolve; });
  let videoStarted;
  const started = new Promise(resolve => { videoStarted = resolve; });
  const work = generateCharacterWardrobeVariant({ data: { cuVideoGeneration: true } }, { id: "coat" }, {
    baseSheet: { url: "/base.png" }, baseVideoSheet: { url: "/base-cu.png" },
    onCheckpoint: variant => checkpoints.push(variant),
    runWardrobeEdit: async request => {
      if (request.sheetKind === "video") { videoStarted(); await gate; return { url: "/coat-cu.png" }; }
      return { url: "/coat.png" };
    }
  });
  await started;
  assert.equal(checkpoints.length, 1);
  assert.equal(checkpoints[0].generated.url, "/coat.png");
  assert.equal(checkpoints[0].videoGenerated, undefined);
  releaseVideo();
  const { variant } = await work;
  assert.equal(checkpoints.length, 2);
  assert.equal(variant.videoGenerated.url, "/coat-cu.png");
});

test("character wardrobe edits never submit a provider mask", async () => {
  const requests = [];
  const node = {
    data: {
      stylizedCharacter: true,
      cinematicCharacterSheet: true,
      characterPortrait: { localUrl: "/uploads/portrait.png" },
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
  assert.strictEqual(requests[1].consistencySheet, variant.generated);
  assert.equal(requests[1].identityReference, undefined);
  assert.match(requests[1].prompt, /sole source for identity and wardrobe/i);
});

test("CU-only retries carry the existing completed wardrobe sheet", async () => {
  const generated = { localUrl: "/outputs/cinematic-wardrobe.png" };
  const requests = [];
  await generateCharacterWardrobeVariant({ data: { cuVideoGeneration: true, cinematicCharacterSheet: true } }, { id: "outfit", url: "/uploads/outfit.png" }, {
    baseSheet: { url: "/outputs/base.png" },
    baseVideoSheet: { url: "/outputs/cu-base.png" },
    existingVariant: { generated },
    regenerateVideo: true,
    runWardrobeEdit: async (request) => {
      requests.push(request);
      return { url: "/outputs/cu-wardrobe.png" };
    }
  });
  assert.equal(requests.length, 1);
  assert.strictEqual(requests[0].consistencySheet, generated);
  assert.match(requests[0].prompt, /sole source for identity and wardrobe/i);
});
