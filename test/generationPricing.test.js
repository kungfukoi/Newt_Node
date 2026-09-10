import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateImageRunCost,
  estimateVideoRunCost,
  formatPricedRunLabel,
  generationProviderForModel
} from "../src/generationPricing.js";

test("provider routing follows explicit model preferences and real fallback availability", () => {
  assert.equal(generationProviderForModel({
    model: "Seedance 2.5",
    mediaType: "video",
    providerPreferences: { seedance: "krea" },
    providerAvailability: { fal: true, krea: true }
  }), "krea");
  assert.equal(generationProviderForModel({
    model: "Seedance 2.5",
    mediaType: "video",
    providerPreferences: { seedance: "atlas" },
    providerAvailability: { atlas: true }
  }), "atlas");
  assert.equal(generationProviderForModel({
    model: "MiniMax H3",
    mediaType: "video",
    providerPreferences: { minimaxH3: "local" }
  }), "local");
  assert.equal(generationProviderForModel({
    model: "Kling O3 Pro",
    mediaType: "video",
    providerAvailability: { fal: false, krea: true }
  }), "krea");
  assert.equal(generationProviderForModel({
    model: "Kling O3 Pro",
    mediaType: "video"
  }), null);
  assert.equal(generationProviderForModel({
    model: "Nano Banana Pro",
    mediaType: "image",
    providerAvailability: { google: false, fal: true }
  }), "fal");
  assert.equal(generationProviderForModel({
    model: "OpenAI Image 2.5",
    mediaType: "image",
    providerAvailability: { fal: true, krea: true }
  }), "fal");
  assert.equal(generationProviderForModel({
    model: "OpenAI Image 2.5",
    mediaType: "image",
    providerPreferences: { imageGeneration: "atlas" },
    providerAvailability: { atlas: true }
  }), "atlas");
  assert.equal(generationProviderForModel({
    model: "OpenAI Image 2",
    mediaType: "image",
    providerAvailability: { fal: false, krea: true }
  }), "krea");
});

test("image estimates are provider and batch aware", () => {
  assert.equal(estimateImageRunCost({
    model: "OpenAI Image 2.5",
    resolution: "4K",
    aspectRatio: "16:9",
    quality: "high",
    referenceCount: 1,
    batchCount: 4,
    provider: "fal"
  }), 0.40032);
  assert.equal(estimateImageRunCost({
    model: "Nano Banana Pro",
    resolution: "4K",
    batchCount: 2,
    provider: "google"
  }), 0.48);
  assert.equal(estimateImageRunCost({
    model: "OpenAI Image 2",
    resolution: "4K",
    aspectRatio: "16:9",
    quality: "high",
    referenceCount: 1,
    batchCount: 4,
    provider: "fal"
  }), 1.652);
  assert.equal(estimateImageRunCost({ model: "Unknown", provider: "fal" }), null);
  assert.equal(estimateImageRunCost({
    model: "Nano Banana 2",
    resolution: "4K",
    batchCount: 2,
    provider: "atlas"
  }), 0.32);
});

test("video estimates stay unknown when final billable duration is unknown", () => {
  assert.equal(estimateVideoRunCost({
    model: "Seedance 2.5",
    duration: "auto",
    provider: "krea"
  }), null);
  assert.equal(estimateVideoRunCost({
    model: "Seedance 2.5",
    duration: "10 seconds",
    hasVideoReference: true,
    provider: "fal"
  }), null);
  assert.equal(estimateVideoRunCost({
    model: "MiniMax H3",
    duration: "10 seconds",
    resolution: "768P",
    provider: "fal",
    batchCount: 2
  }), 1.2);
  assert.equal(estimateVideoRunCost({
    model: "MiniMax H3",
    duration: "10 seconds",
    provider: "local",
    batchCount: 4
  }), 0);
  assert.equal(estimateVideoRunCost({
    model: "MiniMax H3",
    duration: "10 seconds",
    resolution: "2K",
    referenceImageCount: 6,
    provider: "atlas",
    batchCount: 2
  }), 2.68);
  assert.equal(formatPricedRunLabel("Run Video", 4.22), "Run Video ($4.22 est.)");
  assert.equal(formatPricedRunLabel("Run Video", null), "Run Video");
});
