import test from "node:test";
import assert from "node:assert/strict";
import { defaultUserPreferences, normalizeUserPreferences } from "../src/userPreferences.js";

test("user preferences default to showing the Preset panel", () => {
  assert.deepEqual(normalizeUserPreferences(), defaultUserPreferences);
  assert.deepEqual(normalizeUserPreferences({ showPresetPanel: "false" }), defaultUserPreferences);
});

test("user preferences preserve an explicit Preset panel choice", () => {
  assert.deepEqual(normalizeUserPreferences({ showPresetPanel: false }), { showPresetPanel: false });
  assert.deepEqual(normalizeUserPreferences({ showPresetPanel: true }), { showPresetPanel: true });
});
