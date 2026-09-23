import assert from "node:assert/strict";
import test from "node:test";

import { imageModelReferenceLimit, imageReferenceLimitError } from "../src/imageReferenceLimits.js";

test("OpenAI Image 2.5 accepts sixteen references through Fal and Atlas", () => {
  assert.equal(imageModelReferenceLimit("OpenAI Image 2.5", "fal"), 16);
  assert.equal(imageModelReferenceLimit("OpenAI Image 2.5", "atlas"), 16);
});

test("reference validation refuses truncation instead of silently dropping the last image", () => {
  assert.equal(imageReferenceLimitError({ model: "OpenAI Image 2.5", provider: "fal", count: 16 }), "");
  assert.match(
    imageReferenceLimitError({ model: "OpenAI Image 2.5", provider: "fal", count: 17 }),
    /accepts up to 16.*17 were supplied.*did not submit a truncated generation/
  );
});
