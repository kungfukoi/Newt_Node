import { clampCropRect, dragCropRect } from "./cropGeometry.js";

const positive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

export function constrainVideoCrop(rect, settings = {}, dimensions = {}, changed = "width") {
  const bounded = clampCropRect(rect, 0.000001);
  const sourceWidth = positive(dimensions.width, 1920);
  const sourceHeight = positive(dimensions.height, 1080);
  if (settings.cropMode === "size") {
    return clampCropRect({ ...rect,
      width: Math.min(sourceWidth, positive(settings.cropPixelWidth, 640)) / sourceWidth * 100,
      height: Math.min(sourceHeight, positive(settings.cropPixelHeight, 360)) / sourceHeight * 100 }, 0.000001);
  }
  if (settings.cropMode !== "ratio") return bounded;
  const ratio = positive(settings.cropRatioWidth, 1) / positive(settings.cropRatioHeight, 1) / (sourceWidth / sourceHeight);
  let width = changed === "height" ? bounded.height * ratio : bounded.width;
  let height = width / ratio;
  const fit = Math.min(1, 100 / width, 100 / height);
  width *= fit; height *= fit;
  return { x: Math.min(bounded.x, 100 - width), y: Math.min(bounded.y, 100 - height), width, height };
}

export function dragVideoCrop(rect, handle, dx, dy, settings, dimensions) {
  if (handle === "move") return constrainVideoCrop({ ...rect, x: rect.x + dx, y: rect.y + dy }, settings, dimensions);
  if (settings.cropMode === "size") return rect;
  if (settings.cropMode !== "ratio") return dragCropRect(rect, handle, dx, dy);
  const east = handle.includes("e"), south = handle.includes("s");
  const anchorX = east ? rect.x : rect.x + rect.width;
  const anchorY = south ? rect.y : rect.y + rect.height;
  const ratio = positive(settings.cropRatioWidth, 1) / positive(settings.cropRatioHeight, 1) / (dimensions.width / dimensions.height);
  const delta = Math.abs(dx) >= Math.abs(dy * ratio) ? (east ? dx : -dx) : (south ? dy : -dy) * ratio;
  const maxWidth = Math.min(east ? 100 - anchorX : anchorX, (south ? 100 - anchorY : anchorY) * ratio);
  const width = Math.min(maxWidth, Math.max(Math.min(1, maxWidth), rect.width + delta));
  const height = width / ratio;
  return { x: east ? anchorX : anchorX - width, y: south ? anchorY : anchorY - height, width, height };
}

export function videoCropRect(settings = {}) {
  return clampCropRect({ x: settings.cropX, y: settings.cropY, width: settings.cropWidth, height: settings.cropHeight }, 0.000001);
}

export function videoCropSettings(rect) {
  const bounded = clampCropRect(rect, 0.000001);
  return { cropX: bounded.x, cropY: bounded.y, cropWidth: bounded.width, cropHeight: bounded.height };
}

export function videoCropFilter(settings) {
  const rect = videoCropRect(settings);
  const fraction = value => (value / 100).toFixed(6);
  return `crop=w='max(2,trunc(iw*${fraction(rect.width)}/2)*2)':h='max(2,trunc(ih*${fraction(rect.height)}/2)*2)':x='trunc(iw*${fraction(rect.x)}/2)*2':y='trunc(ih*${fraction(rect.y)}/2)*2'`;
}

export function normalizeVideoCropSettings(settings = {}, dimensions = {}) {
  const modeSettings = settings.cropMode ? { cropMode: settings.cropMode, cropPixelWidth: positive(settings.cropPixelWidth, 640), cropPixelHeight: positive(settings.cropPixelHeight, 360), cropRatioWidth: positive(settings.cropRatioWidth, 1), cropRatioHeight: positive(settings.cropRatioHeight, 1) } : {};
  if (settings.cropWidth != null || !dimensions.width || !dimensions.height) return { ...modeSettings, ...videoCropSettings(constrainVideoCrop(videoCropRect(settings), settings, dimensions)) };
  const width = Math.min(100, Math.max(1, Number(settings.width || dimensions.width) / dimensions.width * 100));
  const height = Math.min(100, Math.max(1, Number(settings.height || dimensions.height) / dimensions.height * 100));
  return videoCropSettings({ x: (100 - width) / 2, y: (100 - height) / 2, width, height });
}
