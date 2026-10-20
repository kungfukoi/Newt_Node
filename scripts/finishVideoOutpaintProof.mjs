import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import probe from "@ffprobe-installer/ffprobe";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
if (!process.argv[2]) throw new Error("Supply the proof directory containing manifest.json and response.json.");
const directory = path.resolve(process.argv[2]);
const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
const response = JSON.parse(await readFile(path.join(directory, "response.json"), "utf8"));
if (response.status !== 200 || !response.video?.localUrl?.startsWith("/outputs/")) throw new Error("Proof generation has not returned a successful local video.");
const generated = path.resolve(root, `.${response.video.localUrl}`);
if (!generated.startsWith(path.join(root, "outputs") + path.sep)) throw new Error("Generated output is outside the managed output directory.");
const { stdout } = await run(probe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", generated], { windowsHide: true, timeout: 30000 });
const metadata = JSON.parse(stdout);
const video = metadata.streams.find(s => s.codec_type === "video");
if (!video || Math.abs(Number(metadata.format.duration) - manifest.frames / manifest.fps) > 0.15) throw new Error("Output duration does not match the proof; inspect before compositing.");
const execute = args => run(ffmpeg, ["-n", ...args], { windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
// Restore the source from its original file, rather than from the low-resolution model input.
const sourceHeight = Math.round(manifest.sourceHeight / manifest.width * 1080);
const top = Math.round(manifest.top / manifest.height * 1920);
await execute(["-i", generated, "-ss", String(manifest.start), "-i", manifest.sourcePath,
  "-filter_complex", `[0:v]fps=${manifest.fps},scale=1080:1920,setsar=1,setpts=PTS-STARTPTS[bg];[1:v]fps=${manifest.fps},scale=-2:${sourceHeight},crop=1080:${sourceHeight},setsar=1,setpts=PTS-STARTPTS,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*min(1,min(Y/8,(H-1-Y)/8))'[fg];[bg][fg]overlay=0:${top}:shortest=1[out]`,
  "-map", "[out]", "-frames:v", String(manifest.frames), "-an", "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(directory, "proof-composited-1080x1920.mp4")]);
await execute(["-i", generated, "-vf", "fps=1,scale=216:384,tile=4x1", "-frames:v", "1", path.join(directory, "generated-contact-sheet.png")]);
await execute(["-i", path.join(directory, "proof-composited-1080x1920.mp4"), "-vf", "fps=1,scale=216:384,tile=4x1", "-frames:v", "1", path.join(directory, "composited-contact-sheet.png")]);
await writeFile(path.join(directory, "inspection.json"), JSON.stringify({ generated, width: video.width, height: video.height, duration: metadata.format.duration, cost: response.cost, composite: "proof-composited-1080x1920.mp4", note: "8-bit SDR proof. Original source restored with an 8-pixel seam feather. Generated borders are upscaled, not native 1080p detail." }, null, 2));
console.log(JSON.stringify({ directory, generated, outputDimensions: [video.width, video.height], cost: response.cost }, null, 2));
