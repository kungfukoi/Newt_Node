export function filmStillPalette(value) {
  if (value?.version !== 1 || !Array.isArray(value.colors) || value.colors.length !== 10) return null;
  const colors = value.colors.map(color => typeof color === "string" ? color.toUpperCase() : "");
  if (colors.some(hex => !/^#[A-F0-9]{6}$/.test(hex)) || new Set(colors).size !== 10) return null;
  return { version: 1, colors };
}
