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
  const passes = Math.ceil(minimumSeconds / metadata.duration);
  const graph = [];
  const branch = (type, forward, backward, input = `[0:${type}:0]`) => {
    const labels = Array.from({ length: passes }, (_, index) => `[${type}${index}]`);
    const split = type === "v" ? "split" : "asplit";
    graph.push(`${input}${split}=2[${type}f][${type}r]`);
    for (const [index, [direction, filters]] of [["f", forward], ["r", backward]].entries()) {
      const outputs = labels.filter((_, pass) => pass % 2 === index);
      graph.push(`[${type}${direction}]${filters}${outputs.length > 1 ? `,${split}=${outputs.length}` : ""}${outputs.join("")}`);
    }
    return labels;
  };
  const video = branch("v", "setpts=PTS-STARTPTS", "reverse,setpts=PTS-STARTPTS");
  const audioTiming = `apad,atrim=duration=${metadata.duration},asetpts=N/SR/TB`;
  // Give concat a duration clock even for a silent, single-frame source.
  if (!metadata.hasAudio) graph.push("anullsrc=r=48000:cl=mono[silence]");
  const audio = branch("a", audioTiming, `${audioTiming},areverse,asetpts=N/SR/TB`, metadata.hasAudio ? undefined : "[silence]");
  graph.push(`${video.map((label, index) => label + audio[index]).join("")}concat=n=${passes}:v=1:a=1[joined][audio]`);
  if (!metadata.hasAudio) graph.push("[audio]anullsink");
  graph.push("[joined]pad=ceil(iw/2)*2:ceil(ih/2)*2[video]");
  try {
    await runFfmpeg([
      "-y", "-i", source.filePath, "-filter_complex", graph.join(";"),
      "-map", "[video]", ...(metadata.hasAudio ? ["-map", "[audio]"] : []),
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
