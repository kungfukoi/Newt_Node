import path from "node:path";
import sharp from "sharp";

import { atlasVideoInputDimensions } from "../src/atlasMedia.js";

export async function prepareAtlasSeedanceImageAsset(asset) {
  const image = sharp(asset.buffer, { limitInputPixels: 100000000 }).rotate();
  const original = await image.metadata();
  const rotated = [5, 6, 7, 8].includes(original.orientation);
  const width = rotated ? original.height : original.width, height = rotated ? original.width : original.height;
  if (!width || !height) throw Object.assign(new Error("Atlas Seedance needs a readable image reference."), { status: 400 });
  // Keep every pixel of the subject. Extend the shorter side rather than crop
  // or stretch a narrow reference to satisfy the provider's 0.4–2.5 W/H range.
  const paddedWidth = Math.max(width, Math.ceil(height * .4));
  const paddedHeight = Math.max(height, Math.ceil(width / 2.5));
  const scale = Math.min(6000 / Math.max(paddedWidth, paddedHeight), Math.max(1, 300 / Math.min(paddedWidth, paddedHeight)));
  let targetWidth = Math.min(6000, Math.max(300, Math.round(paddedWidth * scale)));
  let targetHeight = Math.min(6000, Math.max(300, Math.round(paddedHeight * scale)));
  targetHeight = Math.max(targetHeight, Math.ceil(targetWidth / 2.5));
  targetWidth = Math.max(targetWidth, Math.ceil(targetHeight * .4));
  const mustNormalize = paddedWidth !== width || paddedHeight !== height || targetWidth !== width || targetHeight !== height || asset.buffer.length >= 30 * 1024 * 1024;
  if (!mustNormalize) return asset;
  const buffer = await image.resize({ width: targetWidth, height: targetHeight, fit: "contain", background: "#ffffff" }).png().toBuffer();
  if (buffer.length >= 30 * 1024 * 1024) throw Object.assign(new Error("Atlas Seedance reference remains above 30 MB after normalization. Use a smaller image."), { status: 400 });
  return { ...asset, buffer, mimeType: "image/png", fileName: `${path.basename(asset.fileName || "reference", path.extname(asset.fileName || ""))}-atlas-reference.png`,
    atlasNormalization: { originalWidth: width, originalHeight: height, width: targetWidth, height: targetHeight, padded: paddedWidth !== width || paddedHeight !== height } };
}

export async function prepareAtlasVideoReferenceAsset(source, {
  resolveLocalAssetPath,
  readLocalAsset,
  probeVideoFile,
  runFfmpeg,
  readFile,
  removeFile,
  temporaryDirectory,
  randomId
}) {
  if (typeof source !== "string") return source;

  const asset = await resolveLocalAssetPath(source);
  const metadata = await probeVideoFile(asset.filePath);
  const target = atlasVideoInputDimensions(metadata.width, metadata.height);
  if (!target.needsNormalization) return readLocalAsset(source);

  const temporaryPath = path.join(temporaryDirectory, `newtnode-atlas-video-reference-${randomId()}.mp4`);
  try {
    await runFfmpeg([
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", asset.filePath,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-vf", `scale=${target.width}:${target.height}:flags=lanczos,setsar=1`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "16",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-map_metadata", "-1",
      temporaryPath
    ], "Atlas video reference normalization", 600000);
    return {
      fileName: `${path.basename(asset.fileName, path.extname(asset.fileName))}-atlas-reference.mp4`,
      buffer: await readFile(temporaryPath),
      mimeType: "video/mp4"
    };
  } finally {
    await removeFile(temporaryPath, { force: true }).catch(() => {});
  }
}
