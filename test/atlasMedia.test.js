import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAtlasImageRequest,
  buildAtlasVideoRequest,
  estimateAtlasImageCost,
  estimateAtlasVideoCost,
  supportsAtlasImageModel,
  supportsAtlasVideoModel
} from "../src/atlasMedia.js";

test("Atlas media support is limited to verified Newt models", () => {
  assert.equal(supportsAtlasImageModel("OpenAI Image 2.5"), true);
  assert.equal(supportsAtlasImageModel("OpenAI Image 2"), true);
  assert.equal(supportsAtlasImageModel("Nano Banana 2"), true);
  assert.equal(supportsAtlasImageModel("Nano Banana Pro"), true);
  assert.equal(supportsAtlasImageModel("REVE 2.1"), true);
  assert.equal(supportsAtlasImageModel("Z-Image"), false);
  assert.equal(supportsAtlasImageModel("Seedream 5.0 Pro"), false);
  assert.equal(supportsAtlasImageModel("Krea 2 Large"), false);
  assert.equal(supportsAtlasVideoModel("Seedance 2.5"), true);
  assert.equal(supportsAtlasVideoModel("MiniMax H3"), true);
  assert.equal(supportsAtlasVideoModel("Kling O3 Pro"), false);
});

test("OpenAI Image 2.5 preserves the selected Atlas variant and transparency", () => {
  const input = buildAtlasImageRequest({
    model: "OpenAI Image 2.5",
    variant: "sunburst",
    prompt: "Transparent product cutout",
    aspectRatio: "1:1",
    resolution: "2K",
    quality: "xhigh",
    background: "transparent"
  });
  assert.equal(input.model, "openai/gpt-image-2.5-sunburst/text-to-image");
  assert.equal(input.size, "2048x2048");
  assert.equal(input.quality, "xhigh");
  assert.equal(input.background, "transparent");
});

test("OpenAI Image 2.5 masked edits match Atlas's strict field schema", () => {
  const input = buildAtlasImageRequest({
    model: "OpenAI Image 2.5",
    variant: "sunburst",
    prompt: "Replace only the selected object",
    images: ["https://example.com/source.png"],
    maskUrl: "https://example.com/mask.png",
    size: "1536x864",
    quality: "high"
  });
  assert.deepEqual(Object.keys(input).sort(), [
    "background",
    "images",
    "mask",
    "model",
    "n",
    "output_format",
    "prompt",
    "quality",
    "size"
  ]);
  assert.equal(input.model, "openai/gpt-image-2.5-sunburst/edit");
  assert.equal(Object.hasOwn(input, "enable_sync_mode"), false);
});

test("Atlas Seedance uses native request field names without dropping references", () => {
  const input = buildAtlasVideoRequest({
    model: "Seedance 2.5",
    prompt: "Use @Image1",
    images: ["https://example.com/reference.png"],
    duration: "10 seconds",
    resolution: "1080p",
    aspectRatio: "16:9",
    generateAudio: true
  });
  assert.equal(input.model, "bytedance/seedance-2.5/reference-to-video");
  assert.deepEqual(input.reference_images, ["https://example.com/reference.png"]);
  assert.equal(input.omni_reference_task_type, "reference");
});

test("Atlas MiniMax H3 emits typed references", () => {
  const input = buildAtlasVideoRequest({
    model: "MiniMax H3",
    prompt: "Follow the reference",
    images: ["https://example.com/character.png"],
    videos: ["https://example.com/motion.mp4"],
    duration: 8,
    resolution: "2K",
    aspectRatio: "adaptive"
  });
  assert.equal(input.model, "minimax/h3/reference-to-video");
  assert.deepEqual(input.refers.map(({ type }) => type), ["image", "video"]);
});

test("Atlas fixed-price estimates are emitted only for verified price shapes", () => {
  assert.equal(estimateAtlasImageCost({ model: "Nano Banana 2", resolution: "4K" }).amountUsd, 0.16);
  assert.equal(estimateAtlasImageCost({ model: "OpenAI Image 2.5", resolution: "2K" }).amountUsd, null);
  assert.equal(estimateAtlasVideoCost({ model: "MiniMax H3", duration: 5, resolution: "2K" }).amountUsd, 0.65);
  assert.equal(estimateAtlasVideoCost({ model: "Seedance 2.5", duration: 5, resolution: "720p" }).amountUsd, null);
});
