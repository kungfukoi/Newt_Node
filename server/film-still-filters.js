import { filmStillPalette } from "../src/filmStillPalette.js";
import { filmStillColorAppearance } from "./film-still-names.js";

const colorGroups = {
  amber: "amber-gold", gold: "amber-gold", red: "red-burgundy",
  olive: "olive-green", green: "olive-green", teal: "teal-cyan", cyan: "teal-cyan",
  blue: "blue", violet: "violet-pink", rose: "violet-pink", neutral: "neutral"
};

export function filmStillFilters(style) {
  const palette = filmStillPalette(style.examples?.[0]?.filmStillPalette);
  const swatches = palette?.colors ?? (style.colours ?? []).map(color => color.hex).filter(hex => /^#[a-f0-9]{6}$/i.test(hex));
  if (!swatches.length) return [];

  const colors = swatches.map(filmStillColorAppearance);
  const weights = colors.map((_, index) => colors.length - index);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const coverage = new Map();
  let light = 0, chroma = 0, shadows = 0, highlights = 0, saturated = 0;
  colors.forEach((color, index) => {
    // The manifest records rank. These weights estimate prominence without assuming pixel percentages.
    const weight = weights[index] / total;
    const group = colorGroups[color.family];
    coverage.set(group, (coverage.get(group) ?? 0) + weight);
    light += color.light * weight;
    chroma += color.chroma * weight;
    if (color.light < 0.23) shadows += weight;
    if (color.light > 0.70) highlights += weight;
    if (color.chroma >= 0.50 && color.light >= 0.15) saturated += weight;
  });

  const filters = [...coverage].filter(([group, share]) => share >= (group === "neutral" ? 0.40 : 0.24)).map(([group]) => group);
  if (light <= 0.32 && shadows >= 0.40) filters.push("dark-moody");
  if (chroma <= 0.16) filters.push("soft-muted");
  if (shadows >= 0.23 && highlights >= 0.16) filters.push("bold-contrast");
  if (light >= 0.55 && highlights >= 0.25 && shadows < 0.20) filters.push("bright-airy");
  if (saturated >= 0.30) filters.push("vivid-saturated");
  return filters;
}
