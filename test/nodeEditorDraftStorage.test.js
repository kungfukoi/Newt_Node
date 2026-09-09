import assert from "node:assert/strict";
import test from "node:test";
import {
  nodeDraftStorageKey,
  readNodeEditorDraftValue,
  writeNodeEditorDraftValue
} from "../src/useNodeEditorDraft.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test("node editor drafts are isolated to each canvas window", () => {
  const localStorage = memoryStorage();
  const firstWindow = { localStorage, sessionStorage: memoryStorage() };
  const secondWindow = { localStorage, sessionStorage: memoryStorage() };

  writeNodeEditorDraftValue(nodeDraftStorageKey, "first workflow", firstWindow);
  writeNodeEditorDraftValue(nodeDraftStorageKey, "second workflow", secondWindow);

  assert.equal(readNodeEditorDraftValue(nodeDraftStorageKey, firstWindow), "first workflow");
  assert.equal(readNodeEditorDraftValue(nodeDraftStorageKey, secondWindow), "second workflow");
  assert.equal(localStorage.getItem(nodeDraftStorageKey), null);
});

test("legacy shared drafts migrate once into the current canvas session", () => {
  const localStorage = memoryStorage({ [nodeDraftStorageKey]: "legacy workflow" });
  const firstWindow = { localStorage, sessionStorage: memoryStorage() };
  const secondWindow = { localStorage, sessionStorage: memoryStorage() };

  assert.equal(readNodeEditorDraftValue(nodeDraftStorageKey, firstWindow), "legacy workflow");
  assert.equal(firstWindow.sessionStorage.getItem(nodeDraftStorageKey), "legacy workflow");
  assert.equal(localStorage.getItem(nodeDraftStorageKey), null);
  assert.equal(readNodeEditorDraftValue(nodeDraftStorageKey, secondWindow), "");
});
