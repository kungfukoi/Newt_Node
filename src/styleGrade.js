import { gradePresetNames, normalizeGradePresetName } from "./colorLook.js";

export const preciseColorGrade = "Precise Color";
const retiredStyleGrades = new Set(["Cool", "Warm", "Spiky Nike", "Classy Kubric", "Coney Color"]);
export const styleGradePresetNames = gradePresetNames
  .filter(name => !retiredStyleGrades.has(name))
  .flatMap(name => name === "Custom" ? [preciseColorGrade, name] : [name]);

export function normalizeStyleGradePresetName(value) {
  return value === preciseColorGrade || value === "Precise Color Picker" ? preciseColorGrade : normalizeGradePresetName(value);
}

export function styleGradePaletteData(data) {
  return normalizeStyleGradePresetName(data.gradePreset) === preciseColorGrade ? data.precisePalette || {} : data;
}

export function migrateStyleGradeData(data) {
  const gradePreset = normalizeStyleGradePresetName(data.gradePreset || (data.stylePreset === "Custom Palette" ? "Custom" : "None"));
  const manual = !data.precisePalette && !data.customPalettePreviewUrl && !data.customPaletteLookKey && !data.customPaletteSourceName
    && (data.customPaletteColors?.length || String(data.customPaletteRgbText || "").trim());
  if (!manual) return { ...data, gradePreset };
  return {
    ...data,
    gradePreset: gradePreset === "Custom" ? preciseColorGrade : gradePreset,
    precisePalette: {
      customPaletteColors: data.customPaletteColors,
      customPaletteRgbText: data.customPaletteRgbText,
      customPalettePicker: data.customPalettePicker
    },
    customPaletteColors: [],
    customPaletteRgbText: ""
  };
}
