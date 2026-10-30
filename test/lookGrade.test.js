import test from "node:test";
import assert from "node:assert/strict";
import { libraryStyleSnapshot } from "../src/styleLibrary.js";
import { lookGradeBinding, lookSelectionPatch, lookGradeStart, releaseLookGrade, lookGradeEditPatch } from "../src/lookGrade.js";

const look = { id: "film", name: "Film", prompt: "Source observations", styleAnalysis: { stylePrompt: "Saved style description" }, examples: [{ id: "first", localUrl: "/uploads/first.png" }, { id: "second", localUrl: "/uploads/second.png" }] };
test("Look snapshots carry the first managed example through repeated workflow normalization", () => {
  const snapshot = libraryStyleSnapshot(look);
  assert.equal(snapshot.gradeReference.localUrl, "/uploads/first.png");
  assert.equal(snapshot.prompt, "Saved style description");
  assert.deepEqual(libraryStyleSnapshot(snapshot), snapshot);
  assert.equal(libraryStyleSnapshot({ ...snapshot, gradeReference: { localUrl: "https://external/image.png" } }).gradeReference, undefined);
});
test("Selecting a Look replaces a stale grade and binds Custom Grade to the same reference", () => {
  const patch = lookSelectionPatch(look, { gradePreset: "Warm", customPaletteColors: [{ hex: "#00ff00" }] });
  assert.equal(patch.gradePreset, "Custom"); assert.equal(patch.stylePreset, "None");
  assert.equal(patch.customPalettePreviewUrl, "/uploads/first.png"); assert.deepEqual(patch.customPaletteColors, []);
  assert.equal(patch.libraryStyle.prompt, "Saved style description");
  const binding = lookGradeBinding(patch.libraryStyle), start = lookGradeStart(binding);
  assert.equal(start.customPaletteLookKey, binding.key); assert.equal(start.customPaletteStatus, "extracting");
  assert.equal(start.customPalettePreviewUrl, "/uploads/first.png");
  assert.notEqual(lookGradeBinding({ ...look, id: "other" }).key, binding.key);
});
test("Clearing a linked Look releases its grade while independent legacy grades remain intact", () => {
  const patch = releaseLookGrade({ libraryStyle: libraryStyleSnapshot(look) });
  assert.equal(patch.gradePreset, "None"); assert.equal(patch.customPalettePreviewUrl, "");
  assert.deepEqual(patch.customPaletteColors, []);
  assert.deepEqual(releaseLookGrade({ libraryStyle: { id: "legacy", prompt: "Ink" }, gradePreset: "Warm" }), {});
  assert.equal(lookSelectionPatch({ id: "legacy", prompt: "Ink" }).gradePreset, undefined);
});

test("User grade edits persist as overrides; selecting another Look restores its default", () => {
  const data = { ...lookSelectionPatch(look), ...lookGradeStart(lookGradeBinding(look)) };
  const edit = lookGradeEditPatch(data, { customPalettePreviewUrl: "data:image/png;base64,override", customPaletteColors: [{ hex: "#0000ff" }] });
  assert.equal(edit.customPaletteLookOverride, true);
  const clearedLook = releaseLookGrade({ ...data, ...edit });
  assert.equal(clearedLook.gradePreset, undefined);
  assert.equal(clearedLook.customPaletteColors, undefined);
  const changed = lookSelectionPatch({ ...look, id: "other" }, { ...data, ...edit });
  assert.equal(changed.customPaletteLookOverride, false);
  assert.equal(changed.customPalettePreviewUrl, "/uploads/first.png");
  assert.equal(lookGradeEditPatch(data, { gradePreset: "Warm" }).customPaletteLookOverride, true);
  assert.equal(lookGradeEditPatch(data, lookGradeStart(lookGradeBinding(look))).customPaletteLookOverride, false);
});

test("Stale manual palette extraction cannot replace a new Look or a later user edit", () => {
  const result = { customPaletteResultFor: "old", customPaletteColors: [{ hex: "#0000ff" }] };
  assert.equal(lookGradeEditPatch({ customPaletteRequestId: "new" }, result), null);
  assert.equal(lookGradeEditPatch({ customPaletteRequestId: "" }, result), null);
  assert.equal(lookGradeEditPatch({ customPaletteRequestId: "old" }, result).customPaletteResultFor, undefined);
});
