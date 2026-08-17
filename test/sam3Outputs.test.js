import test from "node:test";
import assert from "node:assert/strict";
import { sam3ImageOutputs } from "../server/sam3Outputs.js";

test("SAM 3 outputs keep masks primary and preview separate", () => {
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

test("SAM 3 outputs do not duplicate a mask as the preview", () => {
  const output = sam3ImageOutputs({
    image: { url: "https://example.com/mask.png" },
    masks: [{ url: "https://example.com/mask.png" }]
  });

  assert.equal(output.masks.length, 1);
  assert.equal(output.preview, null);
});