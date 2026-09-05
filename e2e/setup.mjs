import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
const run = promisify(execFile);
export default async function setup() {
  await mkdir(new URL("./.generated/", import.meta.url), { recursive: true });
  const target = (name) => fileURLToPath(new URL(`./.generated/${name}`, import.meta.url));
  await run(ffmpeg, ["-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", target("motion.mp4")], { windowsHide: true });
  await run(ffmpeg, ["-y", "-i", target("motion.mp4"), "-frames:v", "1", "-update", "1", target("landscape.png")], { windowsHide: true });
}
