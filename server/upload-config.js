import path from "node:path";

const localVideoExtensions = new Set([".mp4", ".mov", ".qt", ".webm"]);
const localVideoMimeTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export const standardUploadLimits = Object.freeze({
  fileSize: 200 * 1024 * 1024,
  files: 11
});

// Local videos stream directly to disk and intentionally have no byte-size ceiling.
export const localVideoUploadLimits = Object.freeze({ files: 1 });

export function isLocalVideoUpload(file = {}) {
  const mimeType = String(file.mimetype || "").trim().toLowerCase();
  const extension = path.extname(String(file.originalname || "")).toLowerCase();
  return extension ? localVideoExtensions.has(extension) : localVideoMimeTypes.has(mimeType);
}
