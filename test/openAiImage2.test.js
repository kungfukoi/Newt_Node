import assert from "node:assert/strict";
import test from "node:test";

import { imageModelNames, imageModelOptions } from "../src/modelOptions.js";
import { estimateLegacyOpenAiImage2Cost, estimateOpenAiImage2Cost, estimateOpenAiImage2HighCost, normalizeOpenAiImage2Quality, openAiImage2Quality } from "../src/openAiImage2.js";

test("Image Model catalog exposes OpenAI Image 2.5 and the explicit legacy Image 2 choice", () => {
  assert.ok(imageModelOptions.includes(imageModelNames.openAiImage2));
  assert.ok(imageModelOptions.includes(imageModelNames.legacyOpenAiImage2));
  assert.ok(imageModelOptions.indexOf(imageModelNames.openAiImage2) < imageModelOptions.indexOf(imageModelNames.legacyOpenAiImage2));
});

test("OpenAI Image 2.5 defaults to high quality and accepts every Fal quality tier", () => {
  assert.equal(openAiImage2Quality, "high");
  assert.equal(normalizeOpenAiImage2Quality("medium"), "medium");
  assert.equal(normalizeOpenAiImage2Quality("LOW"), "low");
  assert.equal(normalizeOpenAiImage2Quality("xhigh"), "xhigh");
  assert.equal(normalizeOpenAiImage2Quality("max"), "max");
  assert.equal(normalizeOpenAiImage2Quality("unsupported"), "high");
});

test("OpenAI Image 2.5 estimates use Fal's published Flare quality tiers", () => {
  assert.equal(estimateOpenAiImage2HighCost({ resolution: "1K", size: "1024x1024" }), 0.05268);
  assert.equal(estimateOpenAiImage2HighCost({ resolution: "2K", size: "2048x1152", edit: true }), 0.0396);
  assert.equal(estimateOpenAiImage2HighCost({ resolution: "4K", size: "3840x2160", edit: true }), 0.10008);
  assert.equal(estimateOpenAiImage2Cost({ resolution: "4K", size: "3840x2160", quality: "medium" }), 0.02595);
  assert.equal(estimateOpenAiImage2Cost({ resolution: "1K", size: "1024x1024", quality: "low", edit: true }), 0.00588);
});

test("legacy OpenAI Image 2 keeps its original generation and edit estimates", () => {
  assert.equal(estimateLegacyOpenAiImage2Cost({ resolution: "4K", size: "3840x2160", quality: "high" }), 0.401);
  assert.equal(estimateLegacyOpenAiImage2Cost({ resolution: "2K", size: "2048x1152", quality: "high", edit: true }), 0.158);
  assert.equal(estimateLegacyOpenAiImage2Cost({ resolution: "1K", size: "1024x1024", quality: "max" }), 0.211);
});
