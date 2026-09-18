import path from "node:path";

import { atlasVideoInputDimensions } from "../src/atlasMedia.js";

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
