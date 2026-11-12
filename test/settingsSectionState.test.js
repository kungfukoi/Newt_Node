import test from "node:test";
import assert from "node:assert/strict";
import { readSettingsSection, settingsSectionStorageKey, writeSettingsSection } from "../src/settingsSectionState.js";

test("Settings restores the last selected section", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };

  assert.equal(readSettingsSection(storage), "overview");
  assert.equal(writeSettingsSection("models", storage), "models");
  assert.equal(values.get(settingsSectionStorageKey), "models");
  assert.equal(readSettingsSection(storage), "models");
});

test("Settings defaults to Status for an unknown section or unavailable storage", () => {
  assert.equal(readSettingsSection({ getItem: () => "unknown" }), "overview");
  assert.equal(readSettingsSection(null), "overview");
  assert.equal(writeSettingsSection("unknown", null), "overview");
  assert.equal(writeSettingsSection("pricing", null), "pricing");
});
