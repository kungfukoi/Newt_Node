export const editEffectGroups = [
  { id: "transform", label: "Transform" },
  { id: "time", label: "Time" },
  { id: "color", label: "Color" },
  { id: "blur", label: "Blur" },
  { id: "effects", label: "Effects" }
];

export const editEffectDefinitions = [
  {
    id: "imageCrop",
    groupId: "transform",
    label: "Crop",
    mediaTypes: ["image"],
    definition: "Interactively crops an image using a draggable crop box.",
    controls: []
  },
  {
    id: "tone",
    groupId: "color",
    label: "Brightness / Contrast",
    mediaTypes: ["image"],
    definition: "Adjusts image brightness and contrast with a live preview.",
    controls: []
  },
  {
    id: "curves",
    groupId: "color",
    label: "Curves",
    mediaTypes: ["image"],
    definition: "Remaps image tones with an editable RGB curve.",
    controls: []
  },
  {
    id: "textOverlay",
    groupId: "effects",
    label: "Text Overlay",
    mediaTypes: ["image"],
    definition: "Places editable styled text over the image.",
    controls: []
  },
  {
    id: "brushInpaint",
    groupId: "effects",
    label: "Brush Inpaint",
    mediaTypes: ["image"],
    definition: "Uses a painted mask and text prompt to revise part of an image while preserving the rest.",
    controls: []
  },
  {
    id: "scale",
    groupId: "transform",
    label: "Scale",
    mediaTypes: ["image", "video"],
    definition: "Resizes image or video frames to a target width and height.",
    controls: [
      { id: "width", label: "Width", type: "number", min: 16, max: 8192, step: 2, defaultValue: 1280 },
      { id: "height", label: "Height", type: "number", min: 16, max: 8192, step: 2, defaultValue: 720 },
      { id: "algorithm", label: "Algorithm", type: "select", defaultValue: "bicubic", options: ["fast_bilinear", "bilinear", "bicubic", "lanczos"] }
    ]
  },
  {
    id: "rotate",
    groupId: "transform",
    label: "Rotate",
    mediaTypes: ["image", "video"],
    definition: "Rotates frames by a chosen angle and fills exposed corners with black.",
    controls: [
      { id: "degrees", label: "Degrees", type: "range", min: -180, max: 180, step: 1, defaultValue: 0, unit: "deg" }
    ]
  },
  {
    id: "flip",
    groupId: "transform",
    label: "Flip",
    mediaTypes: ["image", "video"],
    definition: "Mirrors frames horizontally, vertically, or in both directions.",
    controls: [
      { id: "direction", label: "Direction", type: "select", defaultValue: "horizontal", options: ["horizontal", "vertical", "both"] }
    ]
  },
  {
    id: "trim",
    groupId: "time",
    label: "Trim",
    mediaTypes: ["video"],
    definition: "Cuts a video to a start and end time, then resets the timeline to begin at zero.",
    controls: [
      { id: "start", label: "Start", type: "number", min: 0, max: 86400, step: 0.01, defaultValue: 0, unit: "s" },
      { id: "end", label: "End", type: "number", min: 0, max: 86400, step: 0.01, defaultValue: 5, unit: "s" }
    ]
  },
  {
    id: "fps",
    groupId: "time",
    label: "Set FPS",
    mediaTypes: ["video"],
    definition: "Converts the video to a selected frame rate by dropping or duplicating frames.",
    controls: [
      { id: "fps", label: "FPS", type: "number", min: 1, max: 120, step: 1, defaultValue: 24 }
    ]
  },
  {
    id: "reverse",
    groupId: "time",
    label: "Reverse",
    mediaTypes: ["video"],
    definition: "Reverses video frame order so the clip plays backward.",
    controls: []
  },
  {
    id: "eq",
    groupId: "color",
    label: "Exposure Grade",
    mediaTypes: ["image", "video"],
    definition: "Adjusts brightness, contrast, saturation, and gamma for broad color correction.",
    controls: [
      { id: "brightness", label: "Brightness", type: "range", min: -1, max: 1, step: 0.01, defaultValue: 0 },
      { id: "contrast", label: "Contrast", type: "range", min: 0, max: 3, step: 0.01, defaultValue: 1 },
      { id: "saturation", label: "Saturation", type: "range", min: 0, max: 3, step: 0.01, defaultValue: 1 },
      { id: "gamma", label: "Gamma", type: "range", min: 0.1, max: 5, step: 0.01, defaultValue: 1 }
    ]
  },
  {
    id: "hue",
    groupId: "color",
    label: "Hue / Saturation",
    mediaTypes: ["image", "video"],
    definition: "Rotates hue and adjusts saturation without changing frame geometry.",
    controls: [
      { id: "hue", label: "Hue", type: "range", min: -180, max: 180, step: 1, defaultValue: 0, unit: "deg" },
      { id: "saturation", label: "Saturation", type: "range", min: 0, max: 3, step: 0.01, defaultValue: 1 }
    ]
  },
  {
    id: "grayscale",
    groupId: "color",
    label: "Grayscale",
    mediaTypes: ["image", "video"],
    definition: "Removes color information and outputs a neutral grayscale image or video.",
    controls: []
  },
  {
    id: "hqdn3d",
    groupId: "cleanup",
    label: "HQDN3D",
    mediaTypes: ["image", "video"],
    definition: "High Quality 3D Denoiser that uses spatial denoise within frames and temporal denoise across frames.",
    controls: [
      { id: "lumaSpatial", label: "Luma Spatial", type: "range", min: 0, max: 12, step: 0.1, defaultValue: 4 },
      { id: "chromaSpatial", label: "Chroma Spatial", type: "range", min: 0, max: 12, step: 0.1, defaultValue: 3 },
      { id: "lumaTemporal", label: "Luma Temporal", type: "range", min: 0, max: 16, step: 0.1, defaultValue: 6 },
      { id: "chromaTemporal", label: "Chroma Temporal", type: "range", min: 0, max: 16, step: 0.1, defaultValue: 4.5 }
    ]
  },
  {
    id: "nlmeans",
    groupId: "cleanup",
    label: "NLMeans",
    mediaTypes: ["image", "video"],
    definition: "Non-local means denoiser that searches for similar patches and averages them intelligently.",
    controls: [
      { id: "strength", label: "Strength", type: "range", min: 1, max: 30, step: 0.1, defaultValue: 2 },
      { id: "patch", label: "Patch", type: "number", min: 1, max: 25, step: 2, defaultValue: 7 },
      { id: "research", label: "Search", type: "number", min: 1, max: 45, step: 2, defaultValue: 15 }
    ]
  },
  {
    id: "bm3d",
    groupId: "cleanup",
    label: "BM3D",
    mediaTypes: ["image", "video"],
    definition: "Block-Matching 3D denoiser that groups similar blocks and denoises them together in transform space.",
    controls: [
      { id: "sigma", label: "Sigma", type: "range", min: 0, max: 20, step: 0.1, defaultValue: 3 },
      { id: "block", label: "Block", type: "number", min: 8, max: 64, step: 8, defaultValue: 16 },
      { id: "group", label: "Group", type: "number", min: 1, max: 32, step: 1, defaultValue: 8 },
      { id: "range", label: "Range", type: "number", min: 1, max: 64, step: 1, defaultValue: 9 }
    ]
  },
  {
    id: "atadenoise",
    groupId: "cleanup",
    label: "ATA Denoise",
    mediaTypes: ["video"],
    definition: "Adaptive Temporal Averaging Denoiser that averages neighboring frames when they are similar enough.",
    controls: [
      { id: "frames", label: "Frames", type: "number", min: 5, max: 129, step: 2, defaultValue: 9 },
      { id: "thresholdA", label: "Threshold A", type: "range", min: 0, max: 0.3, step: 0.001, defaultValue: 0.02 },
      { id: "thresholdB", label: "Threshold B", type: "range", min: 0, max: 5, step: 0.01, defaultValue: 0.04 }
    ]
  },
  {
    id: "fftdnoiz",
    groupId: "cleanup",
    label: "FFT Denoise",
    mediaTypes: ["image", "video"],
    definition: "3D FFT denoiser that removes noise in frequency space, optionally using neighboring frames.",
    controls: [
      { id: "sigma", label: "Sigma", type: "range", min: 0, max: 100, step: 0.1, defaultValue: 2 },
      { id: "amount", label: "Amount", type: "range", min: 0.01, max: 1, step: 0.01, defaultValue: 1 },
      { id: "method", label: "Method", type: "select", defaultValue: "wiener", options: ["wiener", "hard"] }
    ]
  },
  {
    id: "vaguedenoiser",
    groupId: "cleanup",
    label: "Vague Denoiser",
    mediaTypes: ["image", "video"],
    definition: "Wavelet-based denoiser with hard, soft, or garrote thresholding.",
    controls: [
      { id: "threshold", label: "Threshold", type: "range", min: 0, max: 20, step: 0.1, defaultValue: 2 },
      { id: "method", label: "Method", type: "select", defaultValue: "garrote", options: ["hard", "soft", "garrote"] },
      { id: "percent", label: "Percent", type: "range", min: 0, max: 100, step: 1, defaultValue: 85, unit: "%" }
    ]
  },
  {
    id: "removegrain",
    groupId: "cleanup",
    label: "Remove Grain",
    mediaTypes: ["image", "video"],
    definition: "Removes grain with selectable per-plane modes for luma and chroma cleanup.",
    controls: [
      { id: "mode", label: "Mode", type: "number", min: 0, max: 24, step: 1, defaultValue: 17 }
    ]
  },
  {
    id: "median",
    groupId: "cleanup",
    label: "Median",
    mediaTypes: ["image", "video"],
    definition: "Median filter that replaces pixels using neighborhood median values.",
    controls: [
      { id: "radius", label: "Radius", type: "number", min: 1, max: 15, step: 1, defaultValue: 1 },
      { id: "percentile", label: "Percentile", type: "range", min: 0, max: 1, step: 0.01, defaultValue: 0.5 }
    ]
  },
  {
    id: "deflicker",
    groupId: "cleanup",
    label: "Deflicker",
    mediaTypes: ["video"],
    definition: "Removes temporal frame luminance variations to stabilize flickering exposure.",
    controls: [
      { id: "frames", label: "Frames", type: "number", min: 2, max: 129, step: 1, defaultValue: 5 },
      { id: "mode", label: "Mode", type: "select", defaultValue: "am", options: ["am", "gm", "hm", "qm", "cm", "pm", "median"] }
    ]
  },
  {
    id: "deband",
    groupId: "cleanup",
    label: "Deband",
    mediaTypes: ["image", "video"],
    definition: "Reduces color banding and posterization in smooth gradients.",
    controls: [
      { id: "threshold", label: "Threshold", type: "range", min: 0.00003, max: 0.5, step: 0.001, defaultValue: 0.02 },
      { id: "range", label: "Range", type: "number", min: 1, max: 128, step: 1, defaultValue: 16 },
      { id: "blur", label: "Blur", type: "checkbox", defaultValue: true }
    ]
  },
  {
    id: "deblock",
    groupId: "cleanup",
    label: "Deblock",
    mediaTypes: ["image", "video"],
    definition: "Reduces block artifacts from low-bitrate or heavily compressed media.",
    controls: [
      { id: "filter", label: "Filter", type: "select", defaultValue: "strong", options: ["weak", "strong"] },
      { id: "block", label: "Block", type: "number", min: 4, max: 64, step: 4, defaultValue: 8 },
      { id: "alpha", label: "Alpha", type: "range", min: 0, max: 1, step: 0.001, defaultValue: 0.098 },
      { id: "beta", label: "Beta", type: "range", min: 0, max: 1, step: 0.001, defaultValue: 0.05 }
    ]
  },
  {
    id: "dctdnoiz",
    groupId: "cleanup",
    label: "DCT Denoise",
    mediaTypes: ["image", "video"],
    definition: "2D DCT-domain denoiser for compression-like noise and fine texture noise.",
    controls: [
      { id: "sigma", label: "Sigma", type: "range", min: 0, max: 999, step: 0.1, defaultValue: 4 }
    ]
  },
  {
    id: "owdenoise",
    groupId: "cleanup",
    label: "OW Denoise",
    mediaTypes: ["image", "video"],
    definition: "Overcomplete wavelet denoiser with separate luma and chroma strength controls.",
    controls: [
      { id: "depth", label: "Depth", type: "number", min: 8, max: 16, step: 1, defaultValue: 8 },
      { id: "luma", label: "Luma", type: "range", min: 0, max: 100, step: 0.1, defaultValue: 1 },
      { id: "chroma", label: "Chroma", type: "range", min: 0, max: 100, step: 0.1, defaultValue: 1 }
    ]
  },
  {
    id: "gblur",
    groupId: "blur",
    label: "Gaussian Blur",
    mediaTypes: ["image", "video"],
    definition: "Applies a soft Gaussian blur with a controllable sigma radius.",
    controls: [
      { id: "sigma", label: "Sigma", type: "range", min: 0, max: 30, step: 0.1, defaultValue: 2 }
    ]
  },
  {
    id: "boxblur",
    groupId: "blur",
    label: "Box Blur",
    mediaTypes: ["image", "video"],
    definition: "Applies a fast box blur that is useful for masks, backgrounds, and rough softening.",
    controls: [
      { id: "radius", label: "Radius", type: "range", min: 0, max: 30, step: 0.1, defaultValue: 3 },
      { id: "power", label: "Passes", type: "number", min: 1, max: 8, step: 1, defaultValue: 1 }
    ]
  },
  {
    id: "unsharp",
    groupId: "blur",
    label: "Unsharp",
    mediaTypes: ["image", "video"],
    definition: "Sharpens edges with an unsharp-mask style luma boost.",
    controls: [
      { id: "amount", label: "Amount", type: "range", min: -2, max: 5, step: 0.1, defaultValue: 1 }
    ]
  },
  {
    id: "vignette",
    groupId: "effects",
    label: "Vignette",
    mediaTypes: ["image", "video"],
    definition: "Darkens the edges of the frame to draw attention toward the center.",
    controls: [
      { id: "angle", label: "Angle", type: "range", min: 0, max: 3.14, step: 0.01, defaultValue: 1.57 }
    ]
  },
  {
    id: "noise",
    groupId: "effects",
    label: "Noise",
    mediaTypes: ["image", "video"],
    definition: "Adds controlled procedural noise or grain to the image or video.",
    controls: [
      { id: "strength", label: "Strength", type: "range", min: 0, max: 100, step: 1, defaultValue: 8 }
    ]
  },
  {
    id: "negate",
    groupId: "effects",
    label: "Invert",
    mediaTypes: ["image", "video"],
    definition: "Inverts pixel values to create a negative image effect.",
    controls: []
  },
  {
    id: "edgedetect",
    groupId: "effects",
    label: "Edge Detect",
    mediaTypes: ["image", "video"],
    definition: "Highlights visible edges in the frame for line-art or diagnostic looks.",
    controls: [
      { id: "mode", label: "Mode", type: "select", defaultValue: "colormix", options: ["wires", "colormix", "canny"] },
      { id: "low", label: "Low", type: "range", min: 0, max: 1, step: 0.01, defaultValue: 0.1 },
      { id: "high", label: "High", type: "range", min: 0, max: 1, step: 0.01, defaultValue: 0.4 }
    ]
  }
];

const groupIds = new Set(editEffectGroups.map((group) => group.id));
const effectsById = new Map(editEffectDefinitions.map((effect) => [effect.id, effect]));

export function editEffectsForGroup(groupId) {
  return editEffectDefinitions.filter((effect) => effect.groupId === normalizeEditGroupId(groupId));
}

export function editEffectsForSourceType(sourceType = "image") {
  const type = String(sourceType || "image").toLowerCase();
  return editEffectDefinitions.filter((effect) => (effect.mediaTypes || []).includes(type));
}

export function findEditEffect(effectId) {
  return effectsById.get(String(effectId || "")) || editEffectsForGroup(editEffectGroups[0].id)[0];
}

export function firstEditEffectForGroup(groupId) {
  return editEffectsForGroup(groupId)[0] || editEffectDefinitions[0];
}

export function firstEditEffectForSourceType(sourceType = "image") {
  return editEffectsForSourceType(sourceType)[0] || editEffectDefinitions[0];
}

export function normalizeEditGroupId(groupId) {
  const value = String(groupId || "");
  return groupIds.has(value) ? value : editEffectGroups[0].id;
}

export function defaultEditEffectSettings(effectOrId, sourceDimensions = {}) {
  const effect = typeof effectOrId === "string" ? findEditEffect(effectOrId) : effectOrId;
  const settings = Object.fromEntries((effect?.controls || []).map((control) => [control.id, control.defaultValue]));
  if (effect?.id === "imageCrop") {
    settings.cropRect = { x: 8, y: 8, width: 84, height: 84 };
  }
  if (effect?.id === "tone") {
    settings.adjustments = { brightness: 0, contrast: 0 };
  }
  if (effect?.id === "curves") {
    settings.points = [
      { x: 0, y: 100 },
      { x: 100, y: 0 }
    ];
  }
  if (effect?.id === "textOverlay") {
    settings.overlay = {
      text: "",
      x: 50,
      y: 50,
      size: 7,
      color: "#f4f0e8",
      font: "Inter"
    };
  }
  if (effect?.id === "brushInpaint") {
    settings.prompt = "";
    settings.brushSize = 42;
    settings.maskDataUrl = "";
    settings.resolution = "2K";
  }
  if (effect?.id === "scale") {
    const width = normalizedEditDimension(sourceDimensions.width);
    const height = normalizedEditDimension(sourceDimensions.height);
    if (width) settings.width = width;
    if (height) settings.height = height;
  }
  if (effect?.id === "crop") {
    const width = normalizedEditDimension(sourceDimensions.width);
    const height = normalizedEditDimension(sourceDimensions.height);
    if (width) settings.width = width;
    if (height) settings.height = height;
  }
  if (effect?.id === "trim") {
    const duration = normalizedEditDuration(sourceDimensions.duration);
    if (duration) settings.end = duration;
  }
  return settings;
}

function normalizedEditDimension(value) {
  const number = Math.round(Number(value || 0));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizedEditDuration(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Number(number.toFixed(3)) : 0;
}

export function normalizeEditSourceType(effectOrId, sourceType = "video") {
  const effect = typeof effectOrId === "string" ? findEditEffect(effectOrId) : effectOrId;
  const mediaTypes = effect?.mediaTypes || ["video"];
  const requested = String(sourceType || "").toLowerCase();
  return mediaTypes.includes(requested) ? requested : mediaTypes.includes("video") ? "video" : mediaTypes[0];
}

export function normalizeEditEffectForSourceType(sourceType = "image", effectId) {
  const type = String(sourceType || "image").toLowerCase() === "video" ? "video" : "image";
  const effect = findEditEffect(effectId);
  return (effect.mediaTypes || []).includes(type) ? effect : firstEditEffectForSourceType(type);
}

export function normalizeEditEffectForGroup(groupId, effectId) {
  const group = normalizeEditGroupId(groupId);
  const effect = findEditEffect(effectId);
  return effect.groupId === group ? effect : firstEditEffectForGroup(group);
}
