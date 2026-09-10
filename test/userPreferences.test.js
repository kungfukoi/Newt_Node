import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultUserPreferences,
  directorProcessingModelIds,
  normalizeDirectorProcessingModel,
  normalizeUserPreferences
} from "../src/userPreferences.js";

test("user preferences default to showing the Preset panel", () => {
  assert.deepEqual(normalizeUserPreferences(), defaultUserPreferences);
  assert.deepEqual(normalizeUserPreferences({ showPresetPanel: "false" }), defaultUserPreferences);
});

test("user preferences preserve an explicit Preset panel choice", () => {
  assert.deepEqual(normalizeUserPreferences({ showPresetPanel: false }), { showPresetPanel: false, showPriceSnapshot: true, directorProcessingModel: "astra" });
  assert.deepEqual(normalizeUserPreferences({ showPresetPanel: true }), { showPresetPanel: true, showPriceSnapshot: true, directorProcessingModel: "astra" });
});

test("user preferences preserve the price snapshot choice", () => {
  assert.deepEqual(normalizeUserPreferences({ showPriceSnapshot: false }), { showPresetPanel: true, showPriceSnapshot: false, directorProcessingModel: "astra" });
  assert.deepEqual(normalizeUserPreferences({ showPriceSnapshot: true }), { showPresetPanel: true, showPriceSnapshot: true, directorProcessingModel: "astra" });
});

test("Director processing preferences switch every Astra default to GPT-5.6 Sol", () => {
  assert.equal(normalizeDirectorProcessingModel("unknown"), "astra");
  assert.deepEqual(directorProcessingModelIds("astra"), {
    preference: "astra",
    openAiModel: "gpt-6-astra",
    falModel: "openai/gpt-6-astra"
  });
  assert.deepEqual(directorProcessingModelIds("sol"), {
    preference: "sol",
    openAiModel: "gpt-5.6-sol",
    falModel: "openai/gpt-5.6-sol"
  });
  assert.equal(normalizeUserPreferences({ directorProcessingModel: "sol" }).directorProcessingModel, "sol");
});
