const endpointPrefix = "lightricks/ltx-2.5/";

export const ltxVfxModels = {
  alphaGen: {
    id: endpointPrefix + "alpha-gen",
    displayName: "LTX-2.5 Alpha Gen",
    description: "Extracts a grayscale matte and a ProRes 4444 cutout with straight alpha.",
    controls: [],
    outputs: [
      { key: "matte_video", label: "Alpha matte", extension: ".mp4", mimeType: "video/mp4" },
      { key: "cutout_video", label: "ProRes 4444 cutout", extension: ".mov", mimeType: "video/quicktime" }
    ]
  },
  reframe: {
    id: endpointPrefix + "reframe",
    displayName: "LTX-2.5 Reframe",
    description: "Generates missing frame content to fit a new aspect ratio.",
    controls: [
      { key: "aspect_ratio", label: "Aspect Ratio", defaultValue: "16:9", options: ["1:1", "4:5", "5:4", "9:16", "16:9"] },
      { key: "resolution", label: "Resolution", defaultValue: "1080p", options: ["720p", "1080p"] },
      {
        key: "anchor", label: "Source Placement", defaultValue: "center",
        options: ["center", "top", "bottom", "left", "right", "top_left", "top_right", "bottom_left", "bottom_right"]
      }
    ]
  },
  upscale: {
    id: endpointPrefix + "upscale",
    displayName: "LTX-2.5 Upscale",
    description: "Upscales H.264 or HEVC video to 1080p, 4K, or 8K while preserving its aspect ratio.",
    controls: [
      { key: "resolution", label: "Resolution", defaultValue: "1080p", options: ["1080p", "4k", "8k"] }
    ]
  },
  hdr: {
    id: endpointPrefix + "hdr",
    displayName: "LTX-2.5 SDR to HDR",
    description: "Converts SDR video for HDR finishing and delivers a ZIP of 16-bit half-float OpenEXR frames.",
    controls: [
      {
        key: "output_colorspace", label: "EXR Color Space", defaultValue: "acescg",
        options: ["acescg", "acescct", "srgb_linear", "aces2065-1"],
        optionLabels: { acescg: "ACEScg", acescct: "ACEScct", srgb_linear: "Linear sRGB", "aces2065-1": "ACES2065-1" }
      }
    ],
    archive: { key: "exr_frames", label: "OpenEXR frames", extension: ".zip", mimeType: "application/zip" }
  }
};

export const ltxVfxModelNames = Object.values(ltxVfxModels).map(({ displayName }) => displayName);

export function findLtxVfxModel(value) {
  const name = String(value || "").trim().toLowerCase();
  return Object.values(ltxVfxModels).find(({ id, displayName }) => name === id || name === displayName.toLowerCase());
}

export function normalizeLtxVfxSettings(model, data) {
  const settings = Object.fromEntries(model.controls.map(({ key, options, defaultValue }) => [
    key, options.includes(data?.[key]) ? data[key] : defaultValue
  ]));
  if (model.id === ltxVfxModels.reframe.id) {
    const { x, y, width } = data?.rectangle || {};
    if (Number.isFinite(x) && x >= 0 && x < 1 && Number.isFinite(y) && y >= 0 && y < 1 &&
        Number.isFinite(width) && width > 0 && width <= 1) settings.rectangle = { x, y, width };
    if (data?.enable_safety_checker === false) settings.enable_safety_checker = false;
  }
  return settings;
}

export function ltxVfxFalInput(model, settings, videoUrl) {
  const { anchor, rectangle, ...options } = normalizeLtxVfxSettings(model, settings);
  const placement = rectangle || (anchor && { anchor });
  return { video_url: videoUrl, ...options, ...(placement ? { placement } : {}) };
}

export function ltxReframeOutputSize({ aspect_ratio, resolution }) {
  const [w, h] = aspect_ratio.split(":").map(Number);
  const short = resolution === "720p" ? 720 : 1080;
  return { width: Math.round(short * w / Math.min(w, h)), height: Math.round(short * h / Math.min(w, h)) };
}

export function ltxReframeRectangleBounds(settings, source) {
  const output = ltxReframeOutputSize(settings);
  const heightPerWidth = output.width * source.height / (output.height * source.width);
  return {
    heightPerWidth,
    minWidth: Math.max(1 / output.width, 1 / (output.height * heightPerWidth)),
    maxWidth: Math.min(1, 1 / heightPerWidth, 2 * source.width / output.width),
  };
}

export function clampLtxReframeRectangle(rectangle, bounds) {
  const width = Math.min(bounds.maxWidth, Math.max(bounds.minWidth, rectangle.width));
  return {
    x: Math.max(0, Math.min(1 - width, rectangle.x)),
    y: Math.max(0, Math.min(1 - width * bounds.heightPerWidth, rectangle.y)),
    width,
  };
}

export function ltxVfxSourceError(model, settings, { width, height, fps, num_frames: frames, codecName, bytes }) {
  if (!width || !height) return "Could not read the source video dimensions.";
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  if (model === ltxVfxModels.reframe && settings.rectangle) {
    const bounds = ltxReframeRectangleBounds(settings, { width, height });
    const rectangle = clampLtxReframeRectangle(settings.rectangle, bounds);
    if (["x", "y", "width"].some(key => Math.abs(rectangle[key] - settings.rectangle[key]) > 1e-8)) {
      return "Adjust the custom Reframe placement so the source fits inside the output at up to 2× its original size.";
    }
  }
  if (model === ltxVfxModels.alphaGen) {
    if (bytes > 200_000_000 || frames > 3072 || longSide > 3840 || shortSide > 2160 || longSide / shortSide > 32 / 9) {
      return "Alpha Gen accepts up to 200 MB and 3072 frames, with sides up to 3840 × 2160 and an aspect ratio up to 32:9.";
    }
  }
  if (model === ltxVfxModels.upscale) {
    const maxFrames = { "1080p": 2401, "4k": 601, "8k": 241 }[settings.resolution];
    if (!["h264", "hevc"].includes(codecName)) return "LTX-2.5 Upscale requires H.264 or HEVC video.";
    if (bytes > 200_000_000 || shortSide < 480 || shortSide > 4320 || longSide > 7680 || fps < 1) {
      return "LTX-2.5 Upscale accepts up to 200 MB at 1 fps or higher, with a 480–4320 pixel short side and a long side up to 7680 pixels.";
    }
    if (frames && (frames < 2 || frames > maxFrames)) return `LTX-2.5 Upscale accepts 2–${maxFrames} input frames at ${settings.resolution.toUpperCase()}.`;
  }
  return "";
}

export function ltxVfxRate(model, settings, { width, height }) {
  if (model === ltxVfxModels.reframe) return settings.resolution === "720p" ? 0.1 : 0.2;
  if (model === ltxVfxModels.upscale) return { "1080p": 0.08, "4k": 0.30, "8k": 1.20 }[settings.resolution];
  if (!width || !height) return null;
  if (model === ltxVfxModels.alphaGen) {
    const shortSide = Math.min(width, height);
    return shortSide <= 1080 ? 0.10 : shortSide <= 1440 ? 0.25 : 1;
  }
  const pixels = width * height;
  return pixels <= 1920 * 1080 ? 0.20 : pixels <= 2560 * 1440 ? 0.40 : 0.80;
}
