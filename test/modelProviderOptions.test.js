import test from "node:test";
import assert from "node:assert/strict";
import { modelProviderOptionState } from "../src/modelProviderRouting.js";

test("image choices follow explicit provider support regardless of available keys", () => {
  for (const model of ["Ideogram 4.5", "Flux 3"]) {
    for (const provider of ["atlas", "krea", "fal"]) {
      const state = modelProviderOptionState(model, "image", { imageGeneration: provider }, { fal: true });
      assert.equal(state.disabled, provider !== "fal");
      if (state.disabled) assert.match(state.reason, /Settings > Model Providers/);
    }
  }
  assert.equal(modelProviderOptionState("Nano Banana Pro", "image", { imageGeneration: "atlas" }).disabled, false);
  assert.equal(modelProviderOptionState("Flux 3", "image", { imageGeneration: "google" }).disabled, false);
});

test("video choices respect dedicated routes and local MiniMax's display alias", () => {
  const preferences = { veo: "google", seedance: "atlas", minimaxH3: "local" };
  for (const model of ["Seedance 2.5", "MiniMax H3", "Gemini Omni Flash"]) {
    assert.equal(modelProviderOptionState(model, "video", preferences).disabled, false);
  }
  for (const model of ["Kling O3 Pro", "Wan 2.7 Reference-to-Video", "Creatify Aurora"]) {
    assert.equal(modelProviderOptionState(model, "video", preferences).disabled, true);
    assert.equal(modelProviderOptionState(model, "video", { veo: "fal" }).disabled, false);
  }
  assert.equal(modelProviderOptionState("Wan 2.7 Reference-to-Video", "video", { veo: "krea" }).disabled, true);
});
