import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultModelProviderPreferences,
  normalizeModelProviderPreferences,
  providerPreferenceLabel
} from "../src/modelProviderRouting.js";

test("model provider routing defaults to Fal for Seedance and Google for video and images", () => {
  assert.deepEqual(normalizeModelProviderPreferences(), defaultModelProviderPreferences);
});

test("model provider routing infers a configured alternative during first-time migration", () => {
  assert.deepEqual(
    normalizeModelProviderPreferences({}, { fal: true, google: false, krea: true }),
    { seedance: "fal", veo: "fal", imageGeneration: "fal", minimaxH3: "fal" }
  );
  assert.equal(
    normalizeModelProviderPreferences({}, { fal: false, google: false, krea: true }).seedance,
    "krea"
  );
});

test("explicit model provider routes are preserved even when their key is unavailable", () => {
  assert.deepEqual(
    normalizeModelProviderPreferences(
      { seedance: "krea", veo: "google", imageGeneration: "google", minimaxH3: "local" },
      { fal: true, google: false, krea: false }
    ),
    { seedance: "krea", veo: "google", imageGeneration: "google", minimaxH3: "local" }
  );
});

test("model provider labels are human readable", () => {
  assert.equal(providerPreferenceLabel("fal"), "Fal");
  assert.equal(providerPreferenceLabel("google"), "Google");
  assert.equal(providerPreferenceLabel("krea"), "Krea");
  assert.equal(providerPreferenceLabel("local"), "Local");
});
