import { normalizeOutpaintFrame, outpaintFrameGeometry } from "./videoOutpaintFrame.js";
export const videoOutpaintModelName = "Video Outpaint";
export const videoOutpaintRatios = ["9:16", "16:9", "1:1"];
export const videoOutpaintModels = [["wan-vace", "Wan VACE 14B"], ["seedance-2.5", "Seedance 2.5"]];
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
export function normalizeVideoOutpaintSettings(value = {}) {
  value = value && typeof value === "object" ? value : {};
  const model = value.model === "seedance-2.5" ? "seedance-2.5" : "wan-vace";
  const seedanceResolution = ["480p", "720p", "1080p"].includes(value.seedanceResolution) ? value.seedanceResolution : "720p";
  return {
    model,
    seedanceResolution,
    aspectRatio: videoOutpaintRatios.includes(value.aspectRatio) ? value.aspectRatio : "9:16",
    frame: normalizeOutpaintFrame(value.frame),
    start: bounded(value.start, 0, 86400, 0),
    duration: bounded(value.duration, 2.7, 10.05, 3.375),
    restoreSource: value.restoreSource !== false,
    feather: bounded(value.feather, 0, 32, 8),
    outputSize: model === "seedance-2.5" ? seedanceResolution : value.outputSize === "720p" ? "720p" : "1080p"
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
  const seedance = settings.model === "seedance-2.5";
  const fps = Math.min(30, Math.max(seedance ? 24 : 8, Math.round(Number(metadata.fps) || 24)));
  const frames = seedance ? Math.max(4 * fps, Math.round(settings.duration * fps)) : Math.max(81, Math.min(241, Math.floor((Math.round(settings.duration * fps) - 1) / 4) * 4 + 1));
  const duration = frames / fps;
  const availableDuration = Number(metadata.duration) - settings.start;
  if (!Number.isFinite(availableDuration) || availableDuration < 1 / fps) throw new Error("Choose a start time with at least one source frame remaining.");
  const looped = availableDuration + 0.001 < duration;
  const loopFrames = looped ? Math.max(1, Math.floor((availableDuration + 0.001) * fps)) : frames;
  const loopDuration = loopFrames / fps;
  const long = settings.outputSize === "480p" ? 854 : settings.outputSize === "720p" ? 1280 : 1920;
  const short = settings.outputSize === "480p" ? 480 : settings.outputSize === "720p" ? 720 : 1080;
  const [outputWidth, outputHeight] = settings.aspectRatio === "9:16" ? [short, long] : settings.aspectRatio === "16:9" ? [long, short] : [short, short];
  return { settings, width, height, sourceWidth, sourceHeight, left, top, sourceCrop, needsOutpaint, fps, frames, duration, looped, loopFrames, loopDuration, outputWidth, outputHeight };
}

export function seedanceOutpaintRequest(body) {
  return { ...body, model: "Seedance 2.5", videoOutpaintUtility: true, seedanceTask: "edit", seedanceDraft: false, seed: undefined, videoOutpaint: normalizeVideoOutpaintSettings({ ...body.videoOutpaint, model: "seedance-2.5" }) };
}

export function seedanceOutpaintPrompt(prompt) {
  return ["Edit @Video1 as the sole master video. Your primary task is spatial VIDEO OUTPAINTING: replace the solid black padded expansion regions with a continuous extension of the scene, not a new shot. Extrapolate the missing scene from context clues throughout the clip: continue visible surfaces, object trajectories, vanishing lines, perspective, textures, lighting direction, shadows, reflections, colors, exposure and grain across the boundary. Keep the extension alive with matching camera motion, parallax, environmental movement and coherent moving objects; do not freeze the borders. Distinguish padding from real black objects inside the original scene. The padded canvas defines the final framing: keep its aspect ratio, source composition, subject positions, action and timing. Do not crop, zoom, reposition the original footage or leave black bars. Preserve identities and geometry; avoid duplicates, crawling textures and seams. Optional reference images guide the extension only. Apply the scene-specific direction below within these expansion regions.", prompt].join("\n\n");
}
