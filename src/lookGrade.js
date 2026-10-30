import { libraryStyleSnapshot } from "./styleLibrary.js";

export function lookGradeBinding(style) {
  if (!style) return null;
  const snapshot = libraryStyleSnapshot(style);
  const reference = snapshot.gradeReference;
  return reference ? { key: JSON.stringify([snapshot.id, reference.localUrl]), reference, name: snapshot.name } : null;
}
const emptyPalette = { customPaletteRgbText: "", customPaletteColors: [], customPalettePreviewUrl: "", customPaletteSourceName: "", customPaletteStatus: "", customPaletteError: "", customPaletteLookKey: "" };
export function releaseLookGrade(data) {
  return data.customPaletteLookKey || lookGradeBinding(data.libraryStyle) ? { ...emptyPalette, gradePreset: "None" } : {};
}
export function lookSelectionPatch(style, previous = {}) {
  const binding = lookGradeBinding(style);
  return { ...releaseLookGrade(previous), libraryStyle: libraryStyleSnapshot(style), stylePreset: "None",
    ...(binding ? { ...emptyPalette, gradePreset: "Custom", customPalettePreviewUrl: binding.reference.localUrl, customPaletteSourceName: `${binding.name} — first example` } : {}) };
}
export function lookGradeStart(binding) {
  return { ...emptyPalette, gradePreset: "Custom", customPaletteLookKey: binding.key, customPalettePreviewUrl: binding.reference.localUrl,
    customPaletteSourceName: `${binding.name} — first example`, customPaletteStatus: "extracting" };
}
