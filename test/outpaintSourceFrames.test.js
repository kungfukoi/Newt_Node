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

test("94 native 23.976 source frames repeat in full before source-clock delivery", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-source-clock-"));
  const run = args => execute(ffmpeg, args, { windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  const probe = async file => {
    const { stdout } = await execute(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { windowsHide: true });
    const info = JSON.parse(stdout), v = info.streams.find(s => s.codec_type === "video"), a = info.streams.find(s => s.codec_type === "audio");
    const [n, d] = v.avg_frame_rate.split("/").map(Number);
    return { width: v.width, height: v.height, fps: n / d, frameRate: v.avg_frame_rate, num_frames: Number(v.nb_frames), duration: Number(v.duration), audioDuration: Number(a?.duration || 0) };
  };
  try {
    const source = path.join(directory, "source.mp4");
    await run(["-y", "-f", "lavfi", "-i", "testsrc2=s=64x64:r=24000/1001", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", String(94 * 1001 / 24000), "-frames:v", "94", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", source]);
    const service = createVideoOutpaintService({ resolveAsset: async filePath => ({ filePath }), probeVideo: probe, runFfmpeg: run, statFile: stat,
      createTarget: async (_body, kind, ext) => ({ filePath: path.join(directory, kind + ext), publicPath: path.join(directory, kind + ext) }) });
    const prepared = await service.prepare({ videoOutpaint: { model: "seedance-2.5", seedanceResolution: "480p", duration: 3.375, repeatCount: 2, feather: 32 } }, source);
    assert.equal(prepared.plan.outputFrames, 94);
    assert.equal(prepared.plan.prerollFrames, 94);
    assert.equal(prepared.plan.frames, 201);
    assert.equal(prepared.plan.sourceFrameRate, "24000/1001");
    assert.equal((await probe(prepared.generationVideoUrl)).num_frames, 201);
    const debug = await service.finish({}, prepared, { filePath: prepared.generationVideoUrl });
    const debugInfo = await probe(debug.filePath);
    assert.equal(debugInfo.num_frames, 201);
    assert.equal(debugInfo.frameRate, "24000/1001");
    assert.ok(Math.abs(debugInfo.duration - 201 * 1001 / 24000) < 0.00001);
    assert.ok(Math.abs(debugInfo.audioDuration - debugInfo.duration) < 0.001);
    const pixels = async (file, filter) => (await execute(ffmpeg, ["-v", "error", "-i", file, "-vf", filter + ",format=gray", "-an", "-f", "rawvideo", "pipe:1"], { windowsHide: true, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 })).stdout;
    const original = await pixels(source, "scale=480:480:out_color_matrix=bt709,crop=320:320:80:80,scale=32:32");
    const result = await pixels(debug.filePath, `crop=320:320:80:${prepared.plan.top + 80},scale=32:32`);
    for (let frame = 0; frame < 201; frame++) {
      const sourceFrame = frame < 188 ? frame % 94 : 93;
      let error = 0;
      for (let i = 0; i < 1024; i++) error += Math.abs(original[sourceFrame * 1024 + i] - result[frame * 1024 + i]);
      const nearby = [];
      if (error / 1024 >= 2) for (let candidate = Math.max(0, sourceFrame - 2); candidate <= Math.min(93, sourceFrame + 2); candidate++) {
        let diff = 0;
        for (let i = 0; i < 1024; i++) diff += Math.abs(original[candidate * 1024 + i] - result[frame * 1024 + i]);
        nearby.push([candidate, diff / 1024]);
      }
      assert.ok(error / 1024 < 2, `Output frame ${frame} must restore source frame ${sourceFrame}; error=${error / 1024}, nearby=${JSON.stringify(nearby)}`);
    }
    const trimmed = { ...prepared, plan: { ...prepared.plan, settings: { ...prepared.plan.settings, keepAllRepeats: false } } };
    const single = await service.finish({}, trimmed, { filePath: prepared.generationVideoUrl });
    const singleInfo = await probe(single.filePath);
    assert.equal(singleInfo.num_frames, 94);
    assert.equal(singleInfo.frameRate, "24000/1001");
    assert.ok(Math.abs(singleInfo.duration - 94 * 1001 / 24000) < 0.00001);
    assert.ok(Math.abs(singleInfo.audioDuration - singleInfo.duration) < 0.001);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
