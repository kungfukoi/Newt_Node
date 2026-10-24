import { normalizeOutpaintFrame, outpaintFrameGeometry } from "./videoOutpaintFrame.js";
import { outpaintReferenceAppearanceRule } from "./outpaintContext.js";
import { outpaintFrameOneRule, fullFrameScene } from "./outpaintFrameOne.js";
import { normalizeOutpaintReferenceRoles, outpaintRoleInstructions } from "./outpaintReferences.js";
export const videoOutpaintModelName = "Video Outpaint";
export const videoOutpaintRatios = ["9:16", "16:9", "1:1"];
export const videoOutpaintModels = [["seedance-2.5", "Seedance Edit"], ["wan-vace", "Wan VACE 14B"]];
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
export function normalizeVideoOutpaintSettings(value = {}) {
  value = value && typeof value === "object" ? value : {};
  const model = value.model === "seedance-2.5" ? "seedance-2.5" : "wan-vace";
  const seedanceResolution = ["480p", "720p", "1080p"].includes(value.seedanceResolution) ? value.seedanceResolution : "1080p";
  return {
    model,
    seedanceResolution,
    repeatCount: model === "seedance-2.5" ? Math.round(bounded(value.repeatCount, 1, 30, 1)) : 1,
    keepAllRepeats: model === "seedance-2.5" && value.keepAllRepeats !== false,
    useFullSource: model === "seedance-2.5",
    aspectRatio: videoOutpaintRatios.includes(value.aspectRatio) ? value.aspectRatio : "9:16",
    frame: normalizeOutpaintFrame(value.frame),
    start: bounded(value.start, 0, 86400, 0),
    duration: bounded(value.duration, model === "seedance-2.5" ? 0.125 : 2.7, model === "seedance-2.5" ? 30 : 10.05, 3.375),
    restoreSource: value.restoreSource !== false,
    feather: bounded(value.feather, 0, 128, 32),
    autoMatch: value.autoMatch !== false,
    matchExtensionColor: value.matchExtensionColor !== false,
    referenceRoles: normalizeOutpaintReferenceRoles(value.referenceRoles),
    finalQc: false,
    visualQc: false,
    outputSize: model === "seedance-2.5" ? seedanceResolution : value.outputSize === "720p" ? "720p" : "1080p"
  };
}

// Default new nodes to Seedance while preserving an explicitly selected Wan engine.
// Legacy result normalization above keeps its original timing interpretation.
export function normalizeUtilityOutpaintSettings(value = {}) {
  return normalizeVideoOutpaintSettings({ ...(value && typeof value === "object" ? value : {}), model: value?.model === "wan-vace" ? "wan-vace" : "seedance-2.5" });
}
export function videoOutpaintFingerprint(sourceUrl, settings, canvasVideoUrl = "") {
  const normalized = normalizeVideoOutpaintSettings(settings);
  return JSON.stringify([normalized.model === "seedance-2.5" ? "outpaint-canvas-v17-source-frames" : "outpaint-canvas-v14-frame-grid", sourceUrl, normalized, canvasVideoUrl]);
}
export function planVideoOutpaint(metadata, options = {}, timing = {}) {
  const settings = normalizeVideoOutpaintSettings(options);
  const canvases = { "9:16": [720, 1280], "16:9": [1280, 720], "1:1": [720, 720] };
  const seedance = settings.model === "seedance-2.5";
  const long = settings.outputSize === "480p" ? 854 : settings.outputSize === "720p" ? 1280 : 1920;
  const short = settings.outputSize === "480p" ? 480 : settings.outputSize === "720p" ? 720 : 1080;
  const [outputWidth, outputHeight] = settings.aspectRatio === "9:16" ? [short, long] : settings.aspectRatio === "16:9" ? [long, short] : [short, short];
  const [width, height] = seedance ? [outputWidth, outputHeight] : canvases[settings.aspectRatio];
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
  const fps = Math.min(seedance ? 60 : 30, Math.max(seedance ? 24 : 8, Math.round(Number(metadata.fps) || 24)));
  const retainedTiming = seedance && Number.isInteger(timing.outputFrames) && timing.outputFrames > 0;
  const sourceFps = retainedTiming ? timing.sourceFps || fps : Number(metadata.fps) > 0 ? Number(metadata.fps) : fps;
  const sourceFrameRate = retainedTiming ? timing.sourceFrameRate || String(sourceFps) : metadata.frameRate || String(sourceFps);
  const availableDuration = Number(metadata.duration) - settings.start;
  if (!Number.isFinite(availableDuration) || availableDuration + 0.000001 < 1 / (seedance ? sourceFps : fps)) throw new Error("Choose a start time with at least one source frame remaining.");
  const sourceStartFrame = Math.max(0, Math.ceil(settings.start * sourceFps - 0.001));
  const sourceFrames = Math.round(Number(metadata.num_frames || metadata.frames) || Number(metadata.duration) * sourceFps);
  const remainingFrames = sourceFrames - sourceStartFrame;
  if (seedance && remainingFrames < 1) throw new Error("Choose a start time with at least one source frame remaining.");
  const outputFrames = seedance ? retainedTiming ? timing.outputFrames : remainingFrames : null;
  // Repeat complete source frame sequences on the provider clock. Finishing
  // restores the native clock and selects either all copies or the final copy.
  const prerollFrames = seedance ? (settings.repeatCount - 1) * outputFrames : 0;
  // Observed Seedance Edit outputs quantize to 8n+1 frames and resample action
  // when given another count. Round UP with held tail frames, never stretch the
  // source. Provider output is still verified rather than assuming compliance.
  const seedanceFrames = Math.max(4 * fps, prerollFrames + outputFrames + Math.ceil(0.5 * fps));
  const frames = seedance ? Math.ceil((seedanceFrames - 1) / 8) * 8 + 1 : Math.max(81, Math.min(241, Math.floor((Math.round(settings.duration * fps) - 1) / 4) * 4 + 1));
  const duration = frames / fps;
  if (seedance && duration > 30) throw new Error("Canvas repeats exceed Seedance's 30-second input limit. Reduce Canvas repeats or trim the upstream source clip.");
  const looped = !seedance && availableDuration + 0.001 < duration;
  const loopFrames = looped ? Math.max(1, Math.floor((availableDuration + 0.001) * fps)) : frames;
  const loopDuration = loopFrames / fps;
  return { settings, width, height, sourceWidth, sourceHeight, left, top, sourceCrop, needsOutpaint, fps, frames, duration, looped, loopFrames, loopDuration, ...(seedance ? { tailPadded: true, prerollFrames, outputFrames, outputDuration: outputFrames / sourceFps, sourceFps, sourceFrameRate, sourceStartFrame, sourceStartSeconds: retainedTiming ? timing.sourceStartSeconds ?? settings.start : sourceStartFrame / sourceFps, sourceFrames } : {}), outputWidth, outputHeight };
}

export function seedanceOutpaintRequest(body) {
  return { ...body, model: "Seedance 2.5", videoOutpaintUtility: true, seedanceTask: "edit", seedanceDraft: false, seed: undefined, videoOutpaint: normalizeVideoOutpaintSettings({ ...body.videoOutpaint, model: "seedance-2.5" }) };
}

export function seedanceOutpaintPrompt(prompt, repair = false, findings = [], overlapWidth = 0, preparedPlan = null, referenceImageCount = 0) {
  return [
    fullFrameScene(prompt),
    "Edit @Video1 using the completed scene described above. Preserve the existing picture content, people, composition, camera, action and timing. The scene has continuous perspective, surface detail, lighting, exposure and texture throughout the image.",
    ...(referenceImageCount > 0 ? [outpaintRoleInstructions(referenceImageCount, preparedPlan?.settings?.referenceRoles) || `${Array.from({ length: Math.min(30, referenceImageCount) }, (_, index) => `@Image${index + 1}`).join(", ")} ${referenceImageCount === 1 ? "is a visual reference" : "are visual references"}. ${outpaintReferenceAppearanceRule}`] : []),
    "SAME-FRAME ATTACHMENT: Each visible person, limb, garment and prop has coherent anatomy and geometry connected to its visible source in that same frame, at the same position, angle, scale and velocity. Legs follow the existing hips and clothing; rigid props follow their visible axes. Subject presence follows the source entrances, exits and occlusion. Background remains continuous around the subjects. Reference images guide appearance; source footage determines motion.",
    ...(repair ? ["Maintain the exact user framing and creative direction, with continuous subject geometry, local exposure, texture and motion."] : []),
    outpaintFrameOneRule
  ].filter(Boolean).join("\n\n");
}
