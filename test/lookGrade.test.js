import test from "node:test";
import assert from "node:assert/strict";
import { libraryStyleSnapshot } from "../src/styleLibrary.js";
import { lookGradeBinding, lookSelectionPatch, lookGradeStart, releaseLookGrade, lookGradeEditPatch } from "../src/lookGrade.js";
import { migrateStyleGradeData, preciseColorGrade, styleGradePaletteData } from "../src/styleGrade.js";

const look = { id: "film", name: "Film", prompt: "Source observations", styleAnalysis: { stylePrompt: "Saved style description" }, examples: [{ id: "first", localUrl: "/uploads/first.png" }, { id: "second", localUrl: "/uploads/second.png" }] };
test("Look snapshots carry up to four ordered managed examples through workflow normalization", () => {
  const snapshot = libraryStyleSnapshot({ ...look, examples: [
    ...look.examples, { localUrl: "https://external/image.png" }, { localUrl: "/outputs/third.png", catalogUrl: "https://external/third.png" },
    { localUrl: "/workflow-assets/fourth.png" }, { localUrl: "/uploads/fifth.png" }
  ] });
  assert.equal(snapshot.gradeReference.localUrl, "/uploads/first.png");
  assert.deepEqual(snapshot.examples.map(example => example.localUrl), [
    "/uploads/first.png", "/uploads/second.png", "/outputs/third.png", "/workflow-assets/fourth.png"
  ]);
  assert.equal(snapshot.examples[2].catalogUrl, undefined);
  assert.equal(snapshot.prompt, "Saved style description");
  assert.deepEqual(libraryStyleSnapshot(snapshot), snapshot);
  assert.deepEqual(libraryStyleSnapshot({ gradeReference: snapshot.gradeReference }).examples, [snapshot.gradeReference]);
  assert.equal(libraryStyleSnapshot({ gradeReference: { localUrl: "https://external/image.png" } }).gradeReference, undefined);
});
test("Selecting a Look replaces a stale grade and binds Custom Grade to the same reference", () => {
  const patch = lookSelectionPatch(look, { gradePreset: "None", stylePreset: "Painterly 3D", customPaletteColors: [{ hex: "#00ff00" }] });
  assert.equal(patch.gradePreset, "Custom"); assert.equal(patch.stylePreset, undefined);
  assert.equal(patch.customPalettePreviewUrl, "/uploads/first.png"); assert.deepEqual(patch.customPaletteColors, []);
  assert.equal(patch.libraryStyle.prompt, "Saved style description");
  const binding = lookGradeBinding(patch.libraryStyle), start = lookGradeStart(binding);
  assert.equal(start.customPaletteLookKey, binding.key); assert.equal(start.customPaletteStatus, "extracting");
  assert.equal(start.customPalettePreviewUrl, "/uploads/first.png");
  assert.notEqual(lookGradeBinding({ ...look, id: "other" }).key, binding.key);
  for (const gradePreset of ["Warm", preciseColorGrade]) {
    assert.equal(lookSelectionPatch(look, { gradePreset }).gradePreset, gradePreset);
    assert.equal(releaseLookGrade({ ...patch, gradePreset }).gradePreset, undefined);
  }
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
  assert.deepEqual(lookGradeEditPatch(data, { gradePreset: "Warm" }), { gradePreset: "Warm" });
  assert.equal(lookGradeEditPatch(data, lookGradeStart(lookGradeBinding(look))).customPaletteLookOverride, false);
});

test("Legacy image-free swatches migrate independently of image grades and explicit presets", () => {
  const colors = [{ r: 1, g: 2, b: 3 }];
  const manual = migrateStyleGradeData({ gradePreset: "Custom", customPaletteColors: colors });
  assert.equal(manual.gradePreset, preciseColorGrade);
  assert.deepEqual(styleGradePaletteData(manual).customPaletteColors, colors);
  assert.deepEqual(manual.customPaletteColors, []);
  assert.deepEqual(migrateStyleGradeData(manual), manual);
  const image = { gradePreset: "Custom", customPalettePreviewUrl: "/uploads/example.png", customPaletteColors: colors };
  assert.deepEqual(migrateStyleGradeData(image), image);
  const warm = migrateStyleGradeData({ gradePreset: "Warm", customPaletteRgbText: "#112233" });
  assert.equal(warm.gradePreset, "Warm");
  assert.equal(warm.precisePalette.customPaletteRgbText, "#112233");
});

test("Stale manual palette extraction cannot replace a new Look or a later user edit", () => {
  const result = { customPaletteResultFor: "old", customPaletteColors: [{ hex: "#0000ff" }] };
  assert.equal(lookGradeEditPatch({ customPaletteRequestId: "new" }, result), null);
  assert.equal(lookGradeEditPatch({ customPaletteRequestId: "" }, result), null);
  assert.equal(lookGradeEditPatch({ customPaletteRequestId: "old" }, result).customPaletteResultFor, undefined);
});
