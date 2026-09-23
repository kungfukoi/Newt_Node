const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

// Percentages of the source image, independently bounded on each axis.
export function clampCropRect(rect = {}) {
  const width = clamp(finite(rect.width, 100), 1, 100);
  const height = clamp(finite(rect.height, 100), 1, 100);
  return {
    x: clamp(finite(rect.x, 0), 0, 100 - width),
    y: clamp(finite(rect.y, 0), 0, 100 - height),
    width,
    height
  };
}

export function dragCropRect(rect, handle, deltaX, deltaY) {
  const start = clampCropRect(rect);
  if (handle === "move") return clampCropRect({ ...start, x: start.x + deltaX, y: start.y + deltaY });
  let left = start.x;
  let top = start.y;
  let right = left + start.width;
  let bottom = top + start.height;
  if (handle.includes("w")) left = clamp(left + deltaX, 0, right - 1);
  if (handle.includes("e")) right = clamp(right + deltaX, left + 1, 100);
  if (handle.includes("n")) top = clamp(top + deltaY, 0, bottom - 1);
  if (handle.includes("s")) bottom = clamp(bottom + deltaY, top + 1, 100);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
