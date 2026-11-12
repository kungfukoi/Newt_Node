import test from "node:test";
import assert from "node:assert/strict";
import { estimateSam31ImageCost, estimateSam31VideoCost } from "../src/samSegmentation.js";
import { normalizeModelPreferences } from "../src/modelOptions.js";
import { sam3ImageMaskInput, sam3ImageOutputs, sam3VideoMaskInput } from "../server/sam3Outputs.js";

test("SAM 3.1 image requests raw PNG mattes instead of masked RGB previews", () => {
  assert.deepEqual(sam3ImageMaskInput({
    imageUrl: "https://example.com/source.png",
    prompt: "the foreground person",
    maxMasks: 3
  }), {
    image_url: "https://example.com/source.png",
    prompt: "the foreground person",
    apply_mask: false,
    output_format: "png",
    return_multiple_masks: true,
    max_masks: 3,
    include_scores: true,
    include_boxes: true
  });
});

test("SAM 3.1 video requests an unapplied mask video", () => {
  assert.deepEqual(sam3VideoMaskInput({
    videoUrl: "https://example.com/source.mp4",
    prompt: "the foreground person",
    detectionThreshold: 0.65
  }), {
    video_url: "https://example.com/source.mp4",
    prompt: "the foreground person",
    apply_mask: false,
    video_output_type: "X264 (.mp4)",
    detection_threshold: 0.65
  });
});

test("SAM 3.1 outputs keep masks primary and preview separate", () => {
  const output = sam3ImageOutputs({
    image: { url: "https://example.com/preview.png" },
    masks: [
      { url: "https://example.com/mask-1.png" },
      { file_url: "https://example.com/mask-2.png" }
    ]
  });

  assert.deepEqual(output.masks.map((mask) => mask.url), [
    "https://example.com/mask-1.png",
    "https://example.com/mask-2.png"
  ]);
  assert.equal(output.preview.url, "https://example.com/preview.png");
});

test("SAM 3.1 outputs do not duplicate a mask as the preview", () => {
  const output = sam3ImageOutputs({
    image: { url: "https://example.com/mask.png" },
    masks: [{ url: "https://example.com/mask.png" }]
  });

  assert.equal(output.masks.length, 1);
  assert.equal(output.preview, null);
});

test("SAM 3.1 uses its own published rates and bills video from input frames", () => {
  assert.equal(estimateSam31ImageCost().amountUsd, 0.01);
  assert.equal(estimateSam31VideoCost(16).amountUsd, 0.01);
  assert.equal(estimateSam31VideoCost(17).amountUsd, 0.02);
  assert.equal(estimateSam31VideoCost(null).amountUsd, null);
});

test("legacy SAM 3 utility preferences carry forward to SAM 3.1", () => {
  const prefs = normalizeModelPreferences({
    utilityImage: { "SAM 3 Image": false }, utilityVideo: { "SAM 3 Video": false }
  });
  assert.equal(prefs.utilityImage["SAM 3.1 Image"], false);
  assert.equal(prefs.utilityVideo["SAM 3.1 Video"], false);
});
