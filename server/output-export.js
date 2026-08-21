import path from "node:path";
import { normalizeOutputExportFormat } from "../src/outputExport.js";

export function outputExportRequiresConversion(sourcePath = "", mediaType = "", format = "") {
  const normalized = normalizeOutputExportFormat(mediaType, format);
  const extension = path.extname(String(sourcePath || "")).toLowerCase();
  if (normalized === "png") return extension !== ".png";
  if (normalized === "jpg") return ![".jpg", ".jpeg"].includes(extension);
  if (normalized === "mp4") return extension !== ".mp4";
  if (normalized === "prores") return true;
  return false;
}

export function buildOutputExportFfmpegArgs({ sourcePath = "", targetPath = "", mediaType = "", format = "" } = {}) {
  const normalized = normalizeOutputExportFormat(mediaType, format);
  const args = ["-y", "-i", sourcePath];

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
