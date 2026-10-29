const imageFormats = [
  { value: "png", label: "PNG (.png)" },
  { value: "jpg", label: "JPEG (.jpg)" }
];

const videoFormats = [
  { value: "source", label: "Same as input (no conversion)" },
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "prores", label: "ProRes 422 HQ (.mov)" }
];

export function preferredOutputExportFormat(data, mediaType, item, { saving = false } = {}) {
  const requested = normalizeOutputExportFormat(mediaType, mediaType === "video" ? data.outputVideoFormat : data.outputImageFormat);
  if (mediaType === "video" && !data.outputVideoFormatExplicit) return "source";
  if (mediaType === "video" && item?.videoOutpaint?.outputFormat?.startsWith("ProRes 4444")) {
    if (saving && requested === "prores") return "source";
  }
  return requested;
}

export function outputExportFormatOptions(mediaType = "", item) {
  if (mediaType === "image") return imageFormats;
  if (mediaType === "video" && item?.videoOutpaint?.prepared?.plan?.sourceFormat?.sourceUrl) return videoFormats.map(option => option.value === "source" ? { ...option, label: "Same as original source" } : option);
  if (mediaType === "video") return item?.videoOutpaint?.outputFormat?.startsWith("ProRes 4444") ? videoFormats.map(option => option.value === "prores" ? { ...option, label: "MOV (ProRes 4444 XQ master)" } : option) : videoFormats;
  return [];
}

export function originalOutpaintSourceUrl(item) {
  return item?.videoOutpaint?.prepared?.plan?.sourceFormat?.sourceUrl || "";
}

export function normalizeOutputExportFormat(mediaType = "", value = "") {
  const options = outputExportFormatOptions(mediaType);
  if (!options.length) return "";
  const normalized = String(value || "").trim().toLowerCase();
  if (mediaType === "image" && normalized === "jpeg") return "jpg";
  if (mediaType === "video" && (normalized === "mov" || normalized.includes("prores"))) return "prores";
  return options.some((option) => option.value === normalized) ? normalized : options[0].value;
}

export function outputExportExtension(mediaType = "", format = "", fallback = "") {
  const normalized = normalizeOutputExportFormat(mediaType, format);
  if (normalized === "png") return ".png";
  if (normalized === "jpg") return ".jpg";
  if (normalized === "mp4") return ".mp4";
  if (normalized === "prores") return ".mov";
  return String(fallback || "");
}

export function outputExportMimeType(mediaType = "", format = "", fallback = "") {
  const normalized = normalizeOutputExportFormat(mediaType, format);
  if (normalized === "png") return "image/png";
  if (normalized === "jpg") return "image/jpeg";
  if (normalized === "mp4") return "video/mp4";
  if (normalized === "prores") return "video/quicktime";
  return String(fallback || "");
}
