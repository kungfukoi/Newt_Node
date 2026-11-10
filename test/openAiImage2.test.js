import assert from "node:assert/strict";
import test from "node:test";

import { imageModelNames, imageModelOptions } from "../src/modelOptions.js";
import {
  buildOpenAiImage2FalInput,
  estimateLegacyOpenAiImage2Cost,
  normalizeOpenAiImage2Background,
  normalizeOpenAiImage2Quality,
  normalizeOpenAiImage2Variant,
  openAiImage2Background,
  openAiImage2FalEndpoint,
  openAiImage2Quality
} from "../src/openAiImage2.js";

test("Image Model catalog exposes OpenAI Image 2.6 and the explicit legacy Image 2 choice", () => {
  assert.ok(imageModelOptions.includes(imageModelNames.openAiImage2));
  assert.ok(imageModelOptions.includes(imageModelNames.legacyOpenAiImage2));
  assert.ok(imageModelOptions.indexOf(imageModelNames.openAiImage2) < imageModelOptions.indexOf(imageModelNames.legacyOpenAiImage2));
});

test("OpenAI Image 2.6 defaults to high quality and accepts every Fal quality tier", () => {
  assert.equal(openAiImage2Quality, "high");
  assert.equal(normalizeOpenAiImage2Quality("medium"), "medium");
  assert.equal(normalizeOpenAiImage2Quality("LOW"), "low");
  assert.equal(normalizeOpenAiImage2Quality("xhigh"), "xhigh");
  assert.equal(normalizeOpenAiImage2Quality("max"), "max");
  assert.equal(normalizeOpenAiImage2Quality("unsupported"), "high");
});

test("OpenAI Image 2.6 supports explicit transparent PNG output", () => {
  assert.equal(openAiImage2Background, "auto");
  assert.equal(normalizeOpenAiImage2Background("TRANSPARENT"), "transparent");
  assert.equal(normalizeOpenAiImage2Background("unsupported"), "auto");
  assert.deepEqual(buildOpenAiImage2FalInput({
    prompt: "An isolated product",
    imageSize: { width: 1024, height: 1024 },
    quality: "high",
    background: "transparent"
  }), {
    prompt: "An isolated product",
    image_size: { width: 1024, height: 1024 },
    background: "transparent",
    quality: "high",
    num_images: 1,
    output_format: "png",
    sync_mode: false
  });
});

test("OpenAI Image 2.6 routes Flare and Sunburst generation and editing", () => {
  assert.equal(normalizeOpenAiImage2Variant(), "flare");
  assert.equal(normalizeOpenAiImage2Variant("SUNBURST"), "sunburst");
  assert.equal(normalizeOpenAiImage2Variant("unsupported"), "flare");
  assert.equal(openAiImage2FalEndpoint(), "openai/gpt-image-2.6/flare/text-to-image");
  assert.equal(openAiImage2FalEndpoint({ variant: "flare", edit: true }), "openai/gpt-image-2.6/flare/edit");
  assert.equal(openAiImage2FalEndpoint({ variant: "sunburst" }), "openai/gpt-image-2.6/sunburst/text-to-image");
  assert.equal(openAiImage2FalEndpoint({ variant: "sunburst", edit: true }), "openai/gpt-image-2.6/sunburst/edit");
});

test("legacy OpenAI Image 2 keeps its original generation and edit estimates", () => {
  assert.equal(estimateLegacyOpenAiImage2Cost({ resolution: "4K", size: "3840x2160", quality: "high" }), 0.401);
  assert.equal(estimateLegacyOpenAiImage2Cost({ resolution: "2K", size: "2048x1152", quality: "high", edit: true }), 0.158);
  assert.equal(estimateLegacyOpenAiImage2Cost({ resolution: "1K", size: "1024x1024", quality: "max" }), 0.211);
});
