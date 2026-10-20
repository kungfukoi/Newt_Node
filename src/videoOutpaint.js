import { normalizeOutpaintFrame, outpaintFrameGeometry } from "./videoOutpaintFrame.js";
export const videoOutpaintModelName = "Video Outpaint";
export const videoOutpaintRatios = ["9:16", "16:9", "1:1"];
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
export function normalizeVideoOutpaintSettings(value = {}) {
  value = value && typeof value === "object" ? value : {};
  return {
    aspectRatio: videoOutpaintRatios.includes(value.aspectRatio) ? value.aspectRatio : "9:16",
    frame: normalizeOutpaintFrame(value.frame),
    start: bounded(value.start, 0, 86400, 0),
    duration: bounded(value.duration, 2.7, 10.05, 3.375),
    restoreSource: value.restoreSource !== false,
    feather: bounded(value.feather, 0, 32, 8),
    outputSize: value.outputSize === "720p" ? "720p" : "1080p"
  };
}
export function videoOutpaintFingerprint(sourceUrl, settings) {
  return JSON.stringify([sourceUrl, normalizeVideoOutpaintSettings(settings)]);
}
export function planVideoOutpaint(metadata, options = {}) {
  const settings = normalizeVideoOutpaintSettings(options);
  const canvases = { "9:16": [432, 768], "16:9": [768, 432], "1:1": [576, 576] };
  const [width, height] = canvases[settings.aspectRatio];
  const sw = Number(metadata.width), sh = Number(metadata.height);
  if (!(sw > 0 && sh > 0)) throw new Error("Could not read source video dimensions.");
  const scale = Math.min(width / sw, height / sh);
  let sourceWidth = Math.max(2, Math.floor(sw * scale / 2) * 2);
  let sourceHeight = Math.max(2, Math.floor(sh * scale / 2) * 2);
  let left = Math.floor((width - sourceWidth) / 4) * 2;
  let top = Math.floor((height - sourceHeight) / 4) * 2;
  let sourceCrop = { x: 0, y: 0, width: Math.floor(sw / 2) * 2, height: Math.floor(sh / 2) * 2 };
  let needsOutpaint = width - sourceWidth >= 4 || height - sourceHeight >= 4;
  if (settings.frame) {
    const geometry = outpaintFrameGeometry(metadata, settings.aspectRatio, settings.frame, { width, height });
    ({ sourceWidth, sourceHeight, left, top, sourceCrop, needsOutpaint } = geometry);
  }
  const fps = Math.min(30, Math.max(8, Math.round(Number(metadata.fps) || 24)));
  const frames = Math.min(241, Math.floor((Math.round(settings.duration * fps) - 1) / 4) * 4 + 1);
  if (frames < 81) throw new Error(`Choose at least ${(81 / fps).toFixed(3)} seconds for this source frame rate.`);
  const duration = frames / fps;
  if (!Number.isFinite(Number(metadata.duration)) || settings.start + duration > Number(metadata.duration) + 0.001) throw new Error(`The selected source segment must contain ${frames} frames (${duration.toFixed(3)} seconds). Reduce the start time or use a longer clip.`);
  const long = settings.outputSize === "720p" ? 1280 : 1920;
  const short = settings.outputSize === "720p" ? 720 : 1080;
  const [outputWidth, outputHeight] = settings.aspectRatio === "9:16" ? [short, long] : settings.aspectRatio === "16:9" ? [long, short] : [short, short];
  return { settings, width, height, sourceWidth, sourceHeight, left, top, sourceCrop, needsOutpaint, fps, frames, duration, outputWidth, outputHeight };
}
