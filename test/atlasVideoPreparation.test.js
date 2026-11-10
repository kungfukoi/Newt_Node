import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasMedia } from "../server/atlas-media.js";
import sharp from "sharp";

test("Atlas submits image and video once with an unpriced result when pricing is unavailable", async () => {
  const submissions = [];
  const media = createAtlasMedia({ client: { generate: async ({ mediaType }) => {
    submissions.push(mediaType);
    return { url: `https://example.test/${mediaType}` };
  },
    upload: async () => "https://example.test/frame.png" }, readLocalAsset: async () => ({}),
    quoteInput: async () => { throw new Error("Pricing service unavailable"); },
    labelPrompt: prompt => prompt, imageSize: () => "2048x1152" });
  const image = await media.image({ model: "OpenAI Image 2.6", prompt: "Test" }, "key");
  const video = await media.video({ model: "Kling 4.0 Image-to-Video", prompt: "Test", startImage: "/outputs/test.png",
    duration: "5 seconds", resolution: "1080p" }, "key");
  assert.deepEqual(submissions, ["image", "video"]);
  for (const result of [image, video]) {
    assert.equal(result.provider, "Atlas Cloud");
    assert.equal(result.cost.amountUsd, null);
  }
});
test("durable Atlas preparation uploads references without submitting a paid job", async () => {
  const uploads = [];
  const media = createAtlasMedia({
    readLocalAsset: async (source) => ({ source }),
    client: {
      upload: async (asset) => { uploads.push(asset.source); return `https://example.test/${uploads.length}.png`; },
      generate: () => assert.fail("Preparation must not submit or wait for generation")
    }
  });
  const input = await media.prepareVideo({ model: "Seedance 2.5", prompt: "test", images: ["/outputs/ref.png"], duration: 5, resolution: "720p", aspectRatio: "16:9" }, "test-key");
  assert.deepEqual(uploads, ["/outputs/ref.png"]);
  assert.equal(input.model, "bytedance/seedance-2.5/reference-to-video");
  assert.deepEqual(input.reference_images, ["https://example.test/1.png"]);
});

test("Atlas retries a failed price lookup after completion without replaying generation", async () => {
  let quotes = 0, generations = 0;
  const media = createAtlasMedia({ client: { generate: async () => { generations++; return { url: "https://example.test/video.mp4" }; } },
    quoteInput: async () => { if (++quotes === 1) throw Error("temporarily unavailable"); return { amountUsd: 1.5, estimated: true }; } });
  const result = await media.video({ model: "Seedance 2.5", prompt: "test", duration: 5, resolution: "720p", aspectRatio: "16:9" }, "test-key");
  assert.equal(quotes, 2); assert.equal(generations, 1); assert.equal(result.cost.amountUsd, 1.5);
});

test("Seedance reference preparation normalizes before upload and records which source changed", async () => {
  const crop = await sharp({ create: { width: 2752, height: 308, channels: 4, background: "white" } }).png().toBuffer();
  const uploads = [], preparation = [];
  const media = createAtlasMedia({ readLocalAsset: async () => ({ fileName: "paddles.png", mimeType: "image/png", buffer: crop }),
    client: { upload: async asset => { uploads.push(await sharp(asset.buffer).metadata()); return "https://example.test/padded.png"; }, generate: () => assert.fail("No paid submission during preparation") } });
  const input = await media.prepareVideo({ model: "Seedance 2.5", prompt: "Animate", images: ["/outputs/paddles.png"], aspectRatio: "1:1", onReferencePrepared: entry => preparation.push(entry) }, "test-key");
  assert.equal(input.ratio, "1:1"); assert.equal(uploads[0].height, 1101);
  assert.equal(preparation[0].source, "/outputs/paddles.png"); assert.equal(preparation[0].padded, true);
  const frames = await media.prepareVideo({ model: "Seedance 2.5", prompt: "Animate", startImage: "/outputs/paddles.png", endImage: "/outputs/paddles.png", aspectRatio: "1:1", onReferencePrepared: entry => preparation.push(entry) }, "test-key");
  assert.equal(frames.ratio, "adaptive"); assert.deepEqual(preparation.map(entry => entry.role), ["images", "start", "end"]);
});
