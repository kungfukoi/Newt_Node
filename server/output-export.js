import path from "node:path";
import { normalizeOutputExportFormat } from "../src/outputExport.js";

export function originalSourceExport(metadata, sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();
  const codec = metadata.codecName || metadata.codec_name;
  const encoders = { h264: "libx264", hevc: "libx265", prores: "prores_ks", vp9: "libvpx-vp9", av1: "libaom-av1", mpeg4: "mpeg4", ffv1: "ffv1" };
  if (!encoders[codec] || ![".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"].includes(extension)) throw new Error("The original source format is not supported for export. Select MP4 or ProRes explicitly on Output.");
  const profile = String(metadata.profile || "");
  const proresProfile = /XQ/i.test(profile) ? 5 : /4444/.test(profile) ? 4 : /HQ/i.test(profile) ? 3 : /LT/i.test(profile) ? 1 : /Proxy/i.test(profile) ? 0 : 2;
  const matrix = metadata.colorSpace || metadata.color_space;
  return { extension, codec, encoder: encoders[codec], pixelFormat: metadata.pixelFormat || metadata.pix_fmt || "", proresProfile, matrix: ["bt709", "smpte170m", "bt470bg"].includes(matrix) ? matrix : "" };
}

export function outputExportRequiresConversion(sourcePath = "", mediaType = "", format = "", codecName = "", originalSource, sourceMetadata = {}) {
  const normalized = normalizeOutputExportFormat(mediaType, format);
  const extension = path.extname(String(sourcePath || "")).toLowerCase();
  if (normalized === "source" && originalSource) return extension !== originalSource.extension || codecName !== originalSource.codec
    || Boolean(originalSource.pixelFormat && sourceMetadata.pixelFormat && originalSource.pixelFormat !== sourceMetadata.pixelFormat)
    || Boolean(originalSource.matrix && sourceMetadata.colorSpace && originalSource.matrix !== sourceMetadata.colorSpace);
  if (normalized === "png") return extension !== ".png";
  if (normalized === "jpg") return ![".jpg", ".jpeg"].includes(extension);
  if (normalized === "mp4") return extension !== ".mp4" || Boolean(codecName && codecName !== "h264");
  if (normalized === "prores") return true;
  return false;
}

export function buildOutputExportFfmpegArgs({ sourcePath = "", targetPath = "", mediaType = "", format = "", originalSource } = {}) {
  const normalized = normalizeOutputExportFormat(mediaType, format);
  const args = ["-y", "-i", sourcePath];
  if (normalized === "source" && originalSource) {
    args.push("-map", "0:v:0", "-map", "0:a?", "-c:v", originalSource.encoder);
    if (originalSource.matrix) args.push("-vf", `scale=out_color_matrix=${originalSource.matrix}:out_range=tv`, "-colorspace", originalSource.matrix, "-color_primaries", originalSource.matrix, "-color_trc", originalSource.matrix === "bt470bg" ? "gamma28" : originalSource.matrix);
    if (originalSource.codec === "prores") args.push("-profile:v", String(originalSource.proresProfile), "-pix_fmt", originalSource.proresProfile >= 4 ? "yuv444p10le" : "yuv422p10le");
    else if (["h264", "hevc"].includes(originalSource.codec)) args.push("-preset", "medium", "-crf", "14");
    if (originalSource.codec !== "prores" && /^(yuv420p|yuv422p|yuv444p)(10le|12le)?$/.test(originalSource.pixelFormat)) args.push("-pix_fmt", originalSource.pixelFormat);
    args.push("-c:a", [".mov", ".avi"].includes(originalSource.extension) ? "pcm_s24le" : originalSource.extension === ".webm" ? "libopus" : "aac");
    if ([".mov", ".mp4", ".m4v"].includes(originalSource.extension)) args.push("-movflags", "+faststart");
    return [...args, targetPath];
  }
  if (normalized === "source") return [...args, "-map", "0", "-c", "copy", targetPath];

  if (mediaType === "image") {
    args.push("-frames:v", "1");
    if (normalized === "png") args.push("-c:v", "png");
    else if (normalized === "jpg") args.push("-q:v", "2");
  } else if (mediaType === "video") {
    args.push("-map", "0:v:0", "-map", "0:a?");
    if (normalized === "prores") {
      args.push("-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le", "-c:a", "pcm_s24le");
    } else {
      args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart");
    }
  }

  args.push(targetPath);
  return args;
}
