export function hasLayerTransparency(pixels) {
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 255) return true;
  }
  return false;
}

export function preserveLayerAlpha(source, edited) {
  for (let i = 0; i < source.length; i += 4) {
    if (source[i + 3] !== 255 || edited[i + 3] === 0) {
      edited[i] = source[i];
      edited[i + 1] = source[i + 1];
      edited[i + 2] = source[i + 2];
    }
    edited[i + 3] = source[i + 3];
  }
}
