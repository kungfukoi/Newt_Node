import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";
import { createVideoOutpaintService } from "../server/video-outpaint.js";
const execute = promisify(execFile);

test("real finishing improves extension color, preserves the original core and frame count", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-color-finish-"));
  const run = args => execute(ffmpeg, args, { windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  const probe = async file => {
    const { stdout } = await execute(ffprobe.path, ["-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", file], { windowsHide: true });
    const v = JSON.parse(stdout).streams[0], [n, d] = v.avg_frame_rate.split("/").map(Number);
    return { width: v.width, height: v.height, fps: n / d, frameRate: v.avg_frame_rate, num_frames: Number(v.nb_frames), duration: Number(v.duration) };
  };
  try {
    const source = path.join(directory, "source.mp4"), raw = path.join(directory, "raw.mp4");
    await run(["-y", "-f", "lavfi", "-i", "color=c=0x808080:s=64x64:r=24:d=1", "-c:v", "libx264", "-crf", "0", source]);
    let targets = 0;
    const service = createVideoOutpaintService({ resolveAsset: async filePath => ({ filePath }), probeVideo: probe, runFfmpeg: run, statFile: stat,
      createTarget: async (_body, kind, ext) => { const filePath = path.join(directory, `${++targets}-${kind}${ext}`); return { filePath, publicPath: filePath }; } });
    const prepared = await service.prepare({ videoOutpaint: { model: "seedance-2.5", seedanceResolution: "480p", feather: 32 } }, source);
    await run(["-y", "-f", "lavfi", "-i", `color=c=0x787878:s=480x854:r=24`, "-frames:v", String(prepared.plan.frames), "-c:v", "libx264", "-crf", "0", raw]);
    const baseline = await service.finish({}, prepared, { filePath: raw });
    const enabled = { ...prepared, plan: { ...prepared.plan, settings: { ...prepared.plan.settings, matchExtensionColor: true } } };
    const corrected = await service.finish({}, enabled, { filePath: raw });
    assert.equal(corrected.matching.colorMatching.applied, true);
    assert.equal((await probe(corrected.filePath)).num_frames, 24);
    assert.equal(corrected.matching.deliveredFrameRate, "24/1");
    const mean = async (file, filter) => {
      const { stdout } = await execute(ffmpeg, ["-v", "error", "-i", file, "-vf", `${filter},scale=8:8,format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, encoding: "buffer", maxBuffer: 1024 * 1024 });
      return [...stdout].reduce((a, b) => a + b, 0) / stdout.length;
    };
    const original = await mean(source, "null");
    const before = await mean(baseline.filePath, "crop=100:100:190:730");
    const after = await mean(corrected.filePath, "crop=100:100:190:730");
    assert.ok(Math.abs(after - original) < Math.abs(before - original) / 2, `Color error ${before - original} -> ${after - original}`);
    const core = await mean(corrected.filePath, "crop=100:100:190:350");
    const baselineCore = await mean(baseline.filePath, "crop=100:100:190:350");
    assert.ok(Math.abs(core - baselineCore) < 0.1, `Color matching altered the restored source: ${core - baselineCore}`);
    assert.ok(Math.abs(core - original) <= 2, `Source restoration exceeded delivery conversion tolerance: ${core - original}`);
    assert.equal(corrected.qc.status, "off");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
