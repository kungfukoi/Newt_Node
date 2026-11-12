import assert from "node:assert/strict";
import test from "node:test";
import { createAtlasMedia } from "../server/atlas-media.js";
import {
  atlasVideoInputDimensions,
  atlasVideoInputPixelLimits,
  buildAtlasImageRequest,
  buildAtlasVideoRequest,
  estimateAtlasImageCost,
  estimateAtlasVideoCost,
  supportsAtlasImageModel,
  supportsAtlasVideoModel
} from "../src/atlasMedia.js";

test("Atlas Seedream 5.5 layer decomposition uses the documented inputs and retains layer metadata", async () => {
  let request, quoted;
  const media = createAtlasMedia({ client: { generate: async input => {
    request = input;
    return { requestId: "layers-job", job: { outputs: ["https://example.com/base.jpg", "https://example.com/sign.png"],
      layers: [{ z_index: 0 }, { z_index: 1, name: "Sign", bounding_box: { absolute: [0, 0, 32, 20] },
        description: "A painted sign", text_recognition: { text: "OPEN" } }] } };
  } }, quoteInput: async (input, key) => { quoted = { input, key }; return { amountUsd: 0.15 }; } });
  const options = { num_images: 12, resolution: "1.5k", enable_text_recognition: true, output_format: "jpeg" };
  const result = await media.seedreamLayers({ image: Buffer.from("image"), prompt: "Separate the sign", options }, "test");
  assert.deepEqual(request.input, { model: "bytedance/seedream-v5.5/layer-decomposition", image: "data:image/png;base64,aW1hZ2U=",
    prompt: "Separate the sign", ...options });
  assert.equal(result.provider, "Atlas Cloud");
  assert.deepEqual(quoted, { input: { model: request.input.model, resolution: "1.5k", num_images: 2 }, key: "test" });
  assert.equal(result.cost.amountUsd, 0.15);
  assert.deepEqual(result.assets.map(asset => asset.label), ["Base image", "Sign"]);
  assert.deepEqual(result.assets[1].layer, { index: 1, bbox: { absolute: [0, 0, 32, 20] }, description: "A painted sign", textRecognition: { text: "OPEN" } });
  await media.seedreamLayers({ image: Buffer.from("image"), prompt: "", options }, "test");
  assert.equal(Object.hasOwn(request.input, "prompt"), false);
});

test("Atlas Seedance outpaint can request documented MOV color fidelity without changing other models", () => {
  const input = buildAtlasVideoRequest({ model: "Seedance 2.5", prompt: "Extend the scene", videos: ["https://example.com/source.mp4"], seedanceTask: "edit", resolution: "1080p", outputFormat: "mov" });
  assert.equal(input.output_format, "mov"); assert.equal(input.resolution, "1080p");
  assert.notEqual(input.draft, true);
  const normal = buildAtlasVideoRequest({ model: "Seedance 2.5", prompt: "A winter scene" });
  assert.equal(normal.output_format, undefined);
});

test("Atlas video input dimensions preserve compliant media and scale undersized references without cropping", () => {
  assert.deepEqual(atlasVideoInputDimensions(3840, 2160), {
    width: 3840,
    height: 2160,
    pixelCount: 8294400,
    needsNormalization: false
  });
  assert.deepEqual(atlasVideoInputDimensions(740, 400), {
    width: 870,
    height: 470,
    pixelCount: 408900,
    needsNormalization: true
  });
  assert.ok(atlasVideoInputDimensions(740, 400).pixelCount >= atlasVideoInputPixelLimits.minimum);
});

test("Atlas media support is limited to verified Newt models", () => {
  assert.equal(supportsAtlasImageModel("OpenAI Image 2.6"), true);
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

test("OpenAI Image 2.6 preserves the selected Atlas variant and transparency", () => {
  const input = buildAtlasImageRequest({
    model: "OpenAI Image 2.6",
    variant: "sunburst",
    prompt: "Transparent product cutout",
    aspectRatio: "1:1",
    resolution: "2K",
    quality: "xhigh",
    background: "transparent"
  });
  assert.equal(input.model, "openai/gpt-image-2.6-sunburst/text-to-image");
  assert.equal(input.size, "2048x2048");
  assert.equal(input.quality, "xhigh");
  assert.equal(input.background, "transparent");
});

test("OpenAI Image 2.6 masked edits match Atlas's strict field schema", () => {
  const input = buildAtlasImageRequest({
    model: "OpenAI Image 2.6",
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
  assert.equal(input.model, "openai/gpt-image-2.6-sunburst/edit");
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

test("Atlas Seedance 2.5 frame routes preserve frame aspect even with an explicit output ratio", () => {
  for (const aspectRatio of ["1:1", "16:9", "auto"]) {
    const input = buildAtlasVideoRequest({ model: "Seedance 2.5", prompt: "Animate", startImage: "https://example.com/first.png", endImage: "https://example.com/last.png", aspectRatio });
    assert.equal(input.ratio, "adaptive"); assert.equal(input.model, "bytedance/seedance-2.5/image-to-video");
    assert.equal(input.last_image, "https://example.com/last.png");
  }
  const reference = buildAtlasVideoRequest({ model: "Seedance 2.5", prompt: "Animate", images: ["https://example.com/ref.png"], aspectRatio: "1:1" });
  assert.equal(reference.ratio, "1:1");
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
  assert.equal(estimateAtlasImageCost({ model: "OpenAI Image 2.6", resolution: "2K" }).amountUsd, null);
  assert.equal(estimateAtlasVideoCost({ model: "MiniMax H3", duration: 5, resolution: "2K" }).amountUsd, 0.65);
  const seedance = estimateAtlasVideoCost({ model: "Seedance 2.5", duration: 5, resolution: "720p" });
  assert.equal(seedance.amountUsd, 1.87785);
  assert.equal(seedance.estimated, true);
  assert.equal(estimateAtlasVideoCost({ model: "Seedance 2.5", duration: 5, resolution: "720p", hasVideoReference: true }).amountUsd, null);
});
