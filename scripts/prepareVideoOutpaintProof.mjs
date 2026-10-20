import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import probe from "@ffprobe-installer/ffprobe";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const [source, startArg = "0", sourceHeightArg = "432"] = process.argv.slice(2);
if (!source) {
  console.log('Usage: node scripts/prepareVideoOutpaintProof.mjs "source.mp4" [startSeconds=0] [sourceHeight=432]');
  process.exit(0);
}
const start = Number(startArg);
const sourceHeight = Number(sourceHeightArg);
const width = 432, height = 768, fps = 24, frames = 81;
if (!Number.isFinite(start) || start < 0 || !Number.isInteger(sourceHeight) || sourceHeight < 244 || sourceHeight > 720 || sourceHeight % 4) {
  throw new Error("Start must be nonnegative; sourceHeight must be a multiple of 4 between 244 and 720.");
}
const sourcePath = path.resolve(source);
const { stdout } = await run(probe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", sourcePath], { windowsHide: true, timeout: 30000 });
const metadata = JSON.parse(stdout);
const video = metadata.streams.find(s => s.codec_type === "video");
if (!video || Number(metadata.format.duration) < start + frames / fps) throw new Error("Source must contain at least 3.375 seconds after the chosen start.");
if (Number(video.width) / Number(video.height) < width / sourceHeight) throw new Error("Source is too narrow for this crop; increase sourceHeight.");
const folder = `outpaint-proof-${Date.now()}`;
const directory = path.join(root, "outputs", folder);
await mkdir(directory, { recursive: true });
const top = (height - sourceHeight) / 2;
const encode = ["-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
const execute = args => run(ffmpeg, ["-n", ...args], { windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
await execute(["-ss", String(start), "-i", sourcePath, "-vf", `fps=${fps},scale=-2:${sourceHeight},crop=${width}:${sourceHeight},setsar=1,pad=${width}:${height}:0:${top}:black`, "-frames:v", String(frames), ...encode, path.join(directory, "source-padded.mp4")]);
await execute(["-f", "lavfi", "-i", `color=white:s=${width}x${height}:r=${fps}`, "-vf", `drawbox=x=0:y=${top}:w=${width}:h=${sourceHeight}:color=black:t=fill`, "-frames:v", String(frames), ...encode, path.join(directory, "mask.mp4")]);
await execute(["-i", path.join(directory, "source-padded.mp4"), "-frames:v", "1", path.join(directory, "framing.png")]);
await execute(["-i", path.join(directory, "mask.mp4"), "-frames:v", "1", path.join(directory, "mask.png")]);
const request = {
  model: "Wan VACE 14B Inpainting",
  prompt: "Extend the existing scene above and below the source footage. Continue the same environment, perspective, lighting, and camera movement naturally. Keep the existing subject and action consistent. No additional people, text, borders, or black bars.",
  referenceVideoUrls: [`/outputs/${folder}/source-padded.mp4`],
  maskVideoUrls: [`/outputs/${folder}/mask.mp4`],
  wanVaceInpainting: { matchInputNumFrames: true, matchInputFps: true, resolution: "auto", aspectRatio: "9:16", numInferenceSteps: 30, guidanceScale: 5, seed: 12345, preprocess: false, enablePromptExpansion: false, acceleration: "regular" },
  project: { name: "Video outpainting proof" },
  node: { title: "Video outpainting proof" }
};
await writeFile(path.join(directory, "request.json"), JSON.stringify(request, null, 2));
await writeFile(path.join(directory, "manifest.json"), JSON.stringify({ sourcePath, start, width, height, sourceHeight, top, fps, frames, maskConvention: "white=generate, black=preserve", requestEndpoint: "/api/node/utility-video", submitted: false }, null, 2));
console.log(JSON.stringify({ directory, frames, fps, durationSeconds: frames / fps, sourceHeight, top, submitted: false }, null, 2));
