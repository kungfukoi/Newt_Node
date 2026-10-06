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
  assert.deepEqual(normalizeUserPreferences({ showPresetPanel: false }), { ...defaultUserPreferences, showPresetPanel: false });
  assert.deepEqual(normalizeUserPreferences({ showPresetPanel: true }), { ...defaultUserPreferences, showPresetPanel: true });
});

test("user preferences discard the retired price snapshot choice", () => {
  assert.deepEqual(normalizeUserPreferences({ showPriceSnapshot: false }), defaultUserPreferences);
  assert.deepEqual(normalizeUserPreferences({ showPriceSnapshot: true }), defaultUserPreferences);
});

test("image editor preference preserves Ideogram and migrates old settings", () => {
  assert.equal(normalizeUserPreferences({ imageEditorModel: "Ideogram 4.5" }).imageEditorModel, "Ideogram 4.5");
  assert.equal(normalizeUserPreferences({ imageEditorModel: "unknown" }).imageEditorModel, "OpenAI Image 2.5 Sunburst");
  assert.equal(normalizeUserPreferences({}).imageEditorModel, "OpenAI Image 2.5 Sunburst");
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
