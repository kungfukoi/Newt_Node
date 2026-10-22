import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import { createVideoOutpaintService } from "../server/video-outpaint.js";
import { suppliedCanvasGeometry, suppliedCanvasRatio } from "../server/outpaint-supplied-canvas.js";
import { videoOutpaintFingerprint } from "../src/videoOutpaint.js";

test("supplied canvas uses union of content bounds and rejects unsupported framing", () => {
  assert.deepEqual(suppliedCanvasGeometry({ width: 100, height: 100 }, { width: 100, height: 100 }, "crop=80:60:10:20 crop=80:64:10:18").sourceCrop, { x: 10, y: 18, width: 80, height: 64 });
  assert.equal(suppliedCanvasRatio({ width: 1920, height: 1080 }), "16:9");
  assert.throws(() => suppliedCanvasRatio({ width: 400, height: 300 }), /reformat/);
  assert.throws(() => suppliedCanvasGeometry({ width: 100, height: 100 }, {}, "crop=-1:-1:100:100"), /Could not detect/);
});

test("real supplied canvas detects borders, keeps placement and prepares inward overlap without original input", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "newt-supplied-canvas-"));
  const exec = promisify(execFile);
  const run = args => exec(ffmpeg, args, { windowsHide: true, timeout: 30000 });
  try {
    const source = path.join(dir, "canvas.mp4");
    await run(["-y", "-f", "lavfi", "-i", "color=red:s=64x32:r=24", "-vf", "pad=64:64:0:16:black", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", source]);
    const settings = { model: "seedance-2.5", seedanceResolution: "480p", feather: 32 };
    const service = createVideoOutpaintService({ resolveAsset: async url => ({ filePath: url }), probeVideo: async () => ({ width: 64, height: 64, fps: 24, duration: 1 }), createTarget: async (_body, kind, ext) => ({ filePath: path.join(dir, kind + ext), publicPath: path.join(dir, kind + ext) }), runFfmpeg: run, statFile: stat });
    const prepared = await service.prepare({ videoOutpaint: settings, canvasVideoUrl: source }, "");
    assert.equal(prepared.sourceUrl, source);
    assert.deepEqual(prepared.plan.sourceCrop, { x: 0, y: 16, width: 64, height: 32 });
    assert.equal(prepared.plan.top, 120);
    assert.equal(prepared.plan.sourceHeight, 240);
    assert.equal(prepared.plan.settings.aspectRatio, "1:1");
    assert.equal(prepared.plan.generationOverlap.top, 32);
    assert.equal(prepared.fingerprint, videoOutpaintFingerprint("", settings, source));
    assert.ok(prepared.maskImageUrl && prepared.generationVideoUrl);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
