import test from "node:test";
import assert from "node:assert/strict";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { estimateEdgeTranslation, registrationFilter } from "../server/outpaint-registration.js";

const width = 180, height = 96, frames = 4;
const texture = (x, y, f) => Math.round(115 + 35 * Math.sin(x * 0.17 + f) + 28 * Math.cos(y * 0.23 - f) + 25 * Math.sin(x * 0.11 + y * 0.19));
function samples(shifts) {
  const reference = Buffer.alloc(width * height * frames), generated = Buffer.alloc(reference.length);
  for (let f = 0; f < frames; f++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (f * height + y) * width + x;
    reference[i] = texture(x, y, f);
    generated[i] = Math.round(texture(x - shifts[f][0], y - shifts[f][1], f) * 0.9 + 15);
  }
  return [reference, generated];
}
test("edge registration measures a stable shift independently of exposure", () => {
  const report = estimateEdgeTranslation(...samples([[3, -2], [3, -2], [3, -2], [3, -2]]), width, height, frames);
  assert.equal(report.accepted, true);
  assert.ok(Math.abs(report.dx - 3) < 0.3 && Math.abs(report.dy + 2) < 0.3, JSON.stringify(report));
});
test("registration leaves flat or inconsistent geometry alone", () => {
  assert.equal(estimateEdgeTranslation(Buffer.alloc(width * height * frames, 80), Buffer.alloc(width * height * frames, 120), width, height, frames).accepted, false);
  const report = estimateEdgeTranslation(...samples([[-6, 0], [-2, 3], [3, -3], [7, 0]]), width, height, frames);
  assert.equal(report.accepted, false);
});
test("real FFmpeg resampling aligns the generated edge and leaves distant pixels fixed", async () => {
  const filter = registrationFilter({ edges: { top: { accepted: true, dx: 4, dy: 0 } } }, { w: 96, h: 96, sw: 96, sh: 32, x: 0, y: 32 });
  const { stdout } = await promisify(execFile)(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "nullsrc=s=96x96", "-filter_complex", "[0:v]format=gbrp16le,geq=r='X*512':g='Y*512':b=0[bgRaw];" + filter, "-map", "[bgAligned]", "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"], { windowsHide: true, encoding: "buffer" });
  const red = (x, y) => stdout[(y * 96 + x) * 3];
  assert.ok(Math.abs(red(10, 32) - 28) <= 1, `Registered red ${red(10, 32)}`);
  assert.ok(Math.abs(red(10, 2) - 20) <= 1, `Distant red ${red(10, 2)}`);
});
