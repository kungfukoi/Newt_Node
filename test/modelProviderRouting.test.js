import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultModelProviderPreferences,
  normalizeModelProviderPreferences,
  providerPreferenceLabel,
  providerSupportedModels,
  providerSupportedModelsLabel
} from "../src/modelProviderRouting.js";

test("model provider routing defaults to Fal for Seedance and Google for video and images", () => {
  assert.deepEqual(normalizeModelProviderPreferences(), defaultModelProviderPreferences);
});

test("model provider routing infers a configured alternative during first-time migration", () => {
  assert.deepEqual(
    normalizeModelProviderPreferences({}, { fal: true, google: false, krea: true }),
    { seedance: "fal", veo: "fal", imageGeneration: "fal", minimaxH3: "fal", llm: "fal" }
  );
  assert.equal(
    normalizeModelProviderPreferences({}, { fal: false, google: false, krea: true }).seedance,
    "krea"
  );
});

test("explicit model provider routes are preserved even when their key is unavailable", () => {
  assert.deepEqual(
    normalizeModelProviderPreferences(
      { seedance: "krea", veo: "google", imageGeneration: "google", minimaxH3: "local", llm: "atlas" },
      { fal: true, google: false, krea: false }
    ),
    { seedance: "krea", veo: "google", imageGeneration: "google", minimaxH3: "local", llm: "atlas" }
  );
});

test("MiniMax H3 preserves explicit Fal, Krea, Atlas, and local routing", () => {
  assert.equal(normalizeModelProviderPreferences({ minimaxH3: "fal" }).minimaxH3, "fal");
  assert.equal(normalizeModelProviderPreferences({ minimaxH3: "krea" }).minimaxH3, "krea");
  assert.equal(normalizeModelProviderPreferences({ minimaxH3: "atlas" }).minimaxH3, "atlas");
  assert.equal(normalizeModelProviderPreferences({ minimaxH3: "local" }).minimaxH3, "local");
});

test("Seedance and image generation preserve explicit Atlas routing", () => {
  assert.equal(normalizeModelProviderPreferences({ seedance: "atlas" }).seedance, "atlas");
  assert.equal(normalizeModelProviderPreferences({ imageGeneration: "atlas" }).imageGeneration, "atlas");
});

test("model provider labels are human readable", () => {
  assert.equal(providerPreferenceLabel("fal"), "Fal");
  assert.equal(providerPreferenceLabel("google"), "Google");
  assert.equal(providerPreferenceLabel("krea"), "Krea");
  assert.equal(providerPreferenceLabel("local"), "Local");
  assert.equal(providerPreferenceLabel("atlas"), "Atlas Cloud");
  assert.equal(providerPreferenceLabel("openai"), "OpenAI");
});

test("model provider tiles list the models implemented by the selected route", () => {
  assert.deepEqual(providerSupportedModels("seedance", "atlas"), ["Seedance 2.0", "Seedance 2.5"]);
  assert.deepEqual(providerSupportedModels("minimaxH3", "local"), ["MiniMax H3 (576P)"]);
  assert.deepEqual(providerSupportedModels("imageGeneration", "google"), ["Nano Banana Pro"]);
  assert.deepEqual(providerSupportedModels("imageGeneration", "atlas"), [
    "OpenAI Image 2.5",
    "OpenAI Image 2",
    "Nano Banana 2",
    "Nano Banana Pro",
    "REVE 2.1"
  ]);
  assert.equal(providerSupportedModelsLabel("llm", "fal"), "Models: GPT-5.6 Terra");
  assert.equal(providerSupportedModelsLabel("missing", "atlas"), "Models: None configured");
});

test("provider model support results cannot mutate the shared routing metadata", () => {
  const models = providerSupportedModels("imageGeneration", "atlas");
  models.pop();
  assert.equal(providerSupportedModels("imageGeneration", "atlas").at(-1), "REVE 2.1");
});
