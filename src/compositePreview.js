const bound = (value) => Math.max(0, Math.min(1, value));

export function compositeBlendChannel(base, layer, mode) {
  switch (mode) {
    case "multiply": return base * layer;
    case "screen": return base + layer - base * layer;
    case "overlay": return base <= 0.5 ? 2 * base * layer : 1 - 2 * (1 - base) * (1 - layer);
    case "hardlight": return layer <= 0.5 ? 2 * base * layer : 1 - 2 * (1 - base) * (1 - layer);
    case "softlight": return layer <= 0.5 ? base - (1 - 2 * layer) * base * (1 - base) : base + (2 * layer - 1) * ((base <= 0.25 ? ((16 * base - 12) * base + 4) * base : Math.sqrt(base)) - base);
    case "darken": return Math.min(base, layer);
    case "lighten": return Math.max(base, layer);
    case "dodge": return layer >= 1 ? 1 : Math.min(1, base / (1 - layer));
    case "burn": return layer <= 0 ? 0 : 1 - Math.min(1, (1 - base) / layer);
    case "difference": return Math.abs(base - layer);
    case "exclusion": return base + layer - 2 * base * layer;
    case "addition": return Math.min(1, base + layer);
    case "subtract": return Math.max(0, base - layer);
    case "divide": return layer <= 0 ? 1 : Math.min(1, base / layer);
    default: return layer;
  }
}

export function compositePreviewPixels(base, source, layer, mask = null) {
  const opacity = bound(layer.mixAmount / 100);
  for (let index = 0; index < base.length; index += 4) {
    const alpha = source[index + 3] / 255 * opacity * (mask ? mask[index / 4] : 1);
    for (let channel = 0; channel < 3; channel++) {
      const background = base[index + channel] / 255;
      const foreground = source[index + channel] / 255;
      base[index + channel] = Math.round(bound(background + alpha * (compositeBlendChannel(background, foreground, layer.blendMode) - background)) * 255);
    }
    base[index + 3] = 255;
  }
  return base;
}

export function compositePreviewMask(pixels, width, height, invert = false, expand = 0) {
  let values = new Float32Array(width * height);
  for (let index = 0; index < values.length; index++) {
    const offset = index * 4;
    const gray = (pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255;
    values[index] = invert ? 1 - gray : gray;
  }
  const radius = Math.min(12, Math.abs(Math.round(expand)));
  if (!radius) return values;
  // Separable dilation/erosion keeps mask expansion cheap at thumbnail resolution.
  for (const horizontal of [true, false]) {
    const next = new Float32Array(values.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let value = expand > 0 ? 0 : 1;
      for (let delta = -radius; delta <= radius; delta++) {
        const px = Math.max(0, Math.min(width - 1, x + (horizontal ? delta : 0)));
        const py = Math.max(0, Math.min(height - 1, y + (horizontal ? 0 : delta)));
        value = expand > 0 ? Math.max(value, values[py * width + px]) : Math.min(value, values[py * width + px]);
      }
      next[y * width + x] = value;
    }
    values = next;
  }
  return values;
}
