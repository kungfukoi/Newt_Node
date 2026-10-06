import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasMedia } from "../server/atlas-media.js";

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
