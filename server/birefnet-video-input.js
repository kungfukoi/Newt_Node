import path from "node:path";

export const falSinglePartUploadMaximumBytes = 90 * 1024 * 1024;
export const birefnetPreparedVideoTargetBytes = 72 * 1024 * 1024;
export const birefnetMaximumFrames = 512;
export const birefnetPreparedTargetFrames = 510;

export function birefnetVideoBitrates(durationSeconds, targetBytes = birefnetPreparedVideoTargetBytes) {
  const duration = Number(durationSeconds);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 120;
  const totalKbps = Math.max(192, Math.floor((targetBytes * 8 * 0.94) / safeDuration / 1000));
  const audioKbps = Math.min(128, Math.max(48, Math.floor(totalKbps * 0.04)));
  const videoKbps = Math.min(50_000, Math.max(128, totalKbps - audioKbps));

  return { audioKbps, videoKbps };
}

export function birefnetPreparedFrameRate({ durationSeconds, fps, frameCount } = {}) {
  const sourceFps = Number(fps);
  const duration = Number(durationSeconds);
  const frames = Number(frameCount) || (
    Number.isFinite(sourceFps) && sourceFps > 0 && Number.isFinite(duration) && duration > 0
      ? sourceFps * duration
      : 0
  );
  if (!Number.isFinite(frames) || frames <= birefnetMaximumFrames) return null;

  const targetFromDuration = Number.isFinite(duration) && duration > 0
    ? birefnetPreparedTargetFrames / duration
    : 0;
  const targetFromFrames = Number.isFinite(sourceFps) && sourceFps > 0
    ? sourceFps * (birefnetPreparedTargetFrames / frames)
    : 0;
  const target = targetFromDuration || targetFromFrames;
  return Number.isFinite(target) && target > 0 ? target : null;
}

export async function prepareBirefnetVideoInputAsset(source, {
  resolveLocalAssetPath,
  probeVideoFile,
  createTarget,
  runFfmpeg,
  statFile
}) {
  const asset = await resolveLocalAssetPath(source);
  const sourceStats = await statFile(asset.filePath);
  const metadata = await probeVideoFile(asset.filePath);
  const preparedFps = birefnetPreparedFrameRate({
    durationSeconds: metadata.duration,
    fps: metadata.fps,
    frameCount: metadata.num_frames
  });
  if (sourceStats.size <= falSinglePartUploadMaximumBytes && preparedFps === null) {
    return {
      prepared: false,
      publicPath: source,
      filePath: asset.filePath,
      sourceBytes: sourceStats.size,
      uploadBytes: sourceStats.size
    };
  }

  const { audioKbps, videoKbps } = birefnetVideoBitrates(metadata.duration);
  const sourceBaseName = path.basename(asset.fileName || "source-video", path.extname(asset.fileName || ""));
  const target = await createTarget({ sourceBaseName });
  const videoFilters = [
    "scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
    preparedFps === null ? "" : `fps=${preparedFps.toFixed(6)}`,
    "setsar=1"
  ].filter(Boolean).join(",");

  await runFfmpeg([
    "-y",
    "-i", asset.filePath,
    "-map", "0:v:0",
    "-map", "0:a?",
    "-vf", videoFilters,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-b:v", `${videoKbps}k`,
    "-maxrate", `${videoKbps}k`,
    "-bufsize", `${videoKbps * 2}k`,
    "-pix_fmt", "yuv420p",
    "-tag:v", "avc1",
    "-c:a", "aac",
    "-b:a", `${audioKbps}k`,
    "-movflags", "+faststart",
    "-map_metadata", "-1",
    target.filePath
  ], "BiRefNet video upload preparation", 600000);

  const uploadStats = await statFile(target.filePath);
  return {
    prepared: true,
    publicPath: target.publicPath,
    filePath: target.filePath,
    sourceBytes: sourceStats.size,
    uploadBytes: uploadStats.size,
    preparedFps
  };
}
