import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerOutpaintSeams } from "../server/outpaint-seam-registration.js";
import { estimateSeamRegistration, seamRegistrationFilter } from "../server/outpaint-seam-registration.js";

const length = 320, depth = 32, frames = 8, radius = 32;
const texture = x => 70 + 100 * Math.exp(-(((x - 150) / 4) ** 2)) + 65 * Math.exp(-(((x - 173) / 7) ** 2)) + 30 * Math.exp(-(((x - 92) / 3) ** 2));
function samples(shifts, slope = -0.25) {
  const reference = new Uint8Array(length * depth * frames), generated = new Uint8Array(reference.length);
  for (let f = 0; f < frames; f++) for (let y = 0; y < depth; y++) for (let x = 0; x < length; x++) {
    const at = (f * depth + y) * length + x;
    reference[at] = Math.round(texture(x));
    generated[at] = Math.round(texture(x - shifts[f] - slope * y) * 0.9 + 12);
  }
  return [reference, generated];
}
test("seam registration measures a stable offset and changed feature direction independently of exposure", () => {
  const result = estimateSeamRegistration(...samples(Array(8).fill(14)), { length, depth, frames, radius });
  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.ok(Math.abs(result.shift - 14) < 1);
  assert.ok(Math.abs(result.slope + 0.25) < 0.05);
  assert.equal(result.supportedFrames, frames);
});
test("inconsistent motion, featureless scenes and incomplete coverage cannot justify a warp", () => {
  const flat = new Uint8Array(length * depth * frames).fill(100);
  assert.equal(estimateSeamRegistration(flat, flat, { length, depth, frames, radius }).accepted, false);
  assert.equal(estimateSeamRegistration(...samples([3, 8, 13, 18, 23, 18, 13, 8]), { length, depth, frames, radius }).accepted, false);
  assert.equal(estimateSeamRegistration(flat, flat.subarray(length), { length, depth, frames, radius }).accepted, false);
});
test("every-frame validation tests the actual join instead of searching away remaining errors", () => {
  const [reference] = samples(Array(8).fill(14));
  const same = estimateSeamRegistration(reference, reference, { length, depth, frames, radius, validation: true });
  assert.equal(same.correlation, 1);
  assert.equal(same.support, 1);
  const [a, b] = samples(Array(8).fill(14));
  assert.ok(estimateSeamRegistration(a, b, { length, depth, frames, radius, validation: true }).support < 0.9);
});
test("the warp is constant in time, spatially bounded and samples generated pixels only", () => {
  const filter = seamRegistrationFilter({ top: { accepted: true, shift: 14, slope: -0.25, supportStart: 140, supportEnd: 180, radius: 32 } }, { w: 320, h: 480, sw: 320, sh: 224, x: 0, y: 128 });
  assert.match(filter, /geq=/);
  assert.doesNotMatch(filter, /\bN\b|\bT\b|loop|tpad|overlay/);
  assert.match(filter, /Y-128/);
});

test("real generated-pixel resampling aligns the join and preserves distant and outside-edge pixels", async () => {
  const filter = seamRegistrationFilter({ top: { accepted: true, shift: 14, slope: 0, supportStart: 120, supportEnd: 200, radius: 32 } }, { w: 320, h: 480, sw: 320, sh: 224, x: 0, y: 128 });
  const { stdout } = await promisify(execFile)(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "nullsrc=s=320x480", "-vf", `format=gbrp10le,geq=r='X*3':g='Y':b=0,${filter},format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, encoding: "buffer", timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
  const red = (x, y) => stdout[(y * 320 + x) * 3];
  assert.ok(Math.abs(red(160, 128) - 130) <= 1, `Join red ${red(160, 128)}`);
  assert.ok(Math.abs(red(160, 450) - 120) <= 1, `Distant red ${red(160, 450)}`);
  assert.equal(red(0, 128), 0, "Canvas edge must not be filled by a clamped neighboring column");
});

test("real video registration validates every output frame and leaves already aligned media alone", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-seam-regression-"));
  const run = args => promisify(execFile)(ffmpeg, args, { windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  try {
    const source = path.join(directory, "reference.mp4"), raw = path.join(directory, "shifted.mp4");
    for (const [file, shift] of [[source, 0], [raw, 14]]) {
      const value = `80+100*exp(-pow((X-160-${shift})/5,2))+60*exp(-pow((X-200-${shift})/8,2))`;
      await run(["-y", "-f", "lavfi", "-i", "nullsrc=s=320x480:r=24", "-vf", `format=gbrp,geq=r='${value}':g='${value}':b='${value}'`, "-frames:v", "8", "-c:v", "libx264", "-crf", "0", "-pix_fmt", "yuv420p", source === file ? source : raw]);
    }
    const plan = { width: 320, height: 480, outputWidth: 320, outputHeight: 480, sourceWidth: 320, sourceHeight: 224, left: 0, top: 128, fps: 24, frames: 8, outputFrames: 8 };
    const createTarget = async (_body, kind, extension, dependency) => {
      assert.equal(dependency, true);
      const filePath = path.join(directory, kind + extension);
      return { filePath, publicPath: filePath };
    };
    const result = await registerOutpaintSeams({ referencePath: source, generated: { filePath: raw }, plan, runFfmpeg: run, createTarget, body: {} });
    assert.equal(result.report.applied, true, JSON.stringify(result.report));
    assert.equal(result.report.framesChecked, 8);
    assert.equal(result.report.edges.top.validation.supportedFrames, 8);
    const same = await registerOutpaintSeams({ referencePath: source, generated: { filePath: source }, plan, runFfmpeg: run, createTarget: () => assert.fail("Already aligned media must not be warped"), body: {} });
    assert.equal(same.report.applied, false);
    assert.equal(same.generated.filePath, source);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
