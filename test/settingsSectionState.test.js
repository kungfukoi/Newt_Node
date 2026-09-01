import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSettingsOpenSections,
  normalizeSettingsOpenSections,
  readSettingsOpenSections,
  settingsSectionStorageKey,
  writeSettingsOpenSections
} from "../src/settingsSectionState.js";

function memoryStorage(initialValue = null) {
  const values = new Map(initialValue === null ? [] : [[settingsSectionStorageKey, initialValue]]);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}

test("Settings sections restore their saved open and closed state", () => {
  const storage = memoryStorage(JSON.stringify({ credentials: false, models: true, status: false }));

  assert.deepEqual(readSettingsOpenSections(storage), {
    ...defaultSettingsOpenSections,
    credentials: false,
    models: true,
    status: false
  });
});

test("Settings section state ignores unknown and malformed saved values", () => {
  assert.deepEqual(normalizeSettingsOpenSections({ models: true, repository: "yes", unknown: true }), {
    ...defaultSettingsOpenSections,
    models: true
  });
  assert.deepEqual(readSettingsOpenSections(memoryStorage("not json")), defaultSettingsOpenSections);
});

test("Settings section state persists every known section", () => {
  const storage = memoryStorage();
  const saved = writeSettingsOpenSections({ credentials: false, comfy: true }, storage);

  assert.deepEqual(readSettingsOpenSections(storage), saved);
  assert.deepEqual(saved, {
    ...defaultSettingsOpenSections,
    credentials: false,
    comfy: true
  });
});
