import { rm } from "node:fs/promises";
import { seedance25EditMinimumSeconds } from "../src/seedance25.js";

export async function extendSeedanceVideo(url, { resolveAsset, probeVideo, createTarget, runFfmpeg }) {
  const source = await resolveAsset(url);
  const metadata = await probeVideo(source.filePath);
  if (!metadata.width || !metadata.height || !(metadata.duration > 0)) {
    throw Object.assign(new Error("Extend requires a readable Reference Video."), { status: 400 });
  }
  const minimumSeconds = seedance25EditMinimumSeconds;
  if (metadata.duration >= minimumSeconds) return { url, duration: metadata.duration };

  const target = await createTarget();
  const repeats = Math.ceil(minimumSeconds / metadata.duration) - 1;
  try {
    await runFfmpeg([
      "-y", "-stream_loop", String(repeats), "-i", source.filePath,
      "-map", "0:v:0", "-map", "0:a:0?", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",
      "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p",
      "-fps_mode", "passthrough", "-c:a", "aac", "-movflags", "+faststart", target.filePath
    ], "Extend Seedance Reference Video", 60000);
    const { duration } = await probeVideo(target.filePath);
    if (!(duration >= minimumSeconds)) {
      throw new Error("Extend could not create a Reference Video at least 4 seconds long.");
    }
    return { url: target.publicPath, duration };
  } catch (error) {
    await rm(target.filePath, { force: true }).catch(() => {});
    throw error;
  }
}
