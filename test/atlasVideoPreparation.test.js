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
