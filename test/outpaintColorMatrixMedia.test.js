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

test("RGB seam matching composites both colored surfaces in BT.709 and tags the master", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-seam-matrix-"));
  const run = args => execute(ffmpeg, args, { windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  const probe = async file => {
    const { stdout } = await execute(ffprobe.path, ["-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", file], { windowsHide: true });
    const v = JSON.parse(stdout).streams[0];
    return { ...v, duration: Number(v.duration), fps: 24, frameRate: v.avg_frame_rate, num_frames: Number(v.nb_frames) };
  };
  try {
    const source = path.join(directory, "source.mp4"), raw = path.join(directory, "raw.mp4");
    const encode = ["-vf", "scale=out_color_matrix=bt709:out_range=tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-c:v", "libx264", "-crf", "0"];
    await run(["-y", "-f", "lavfi", "-i", "color=c=0x805028:s=64x64:r=24:d=1", ...encode, source]);
    let sequence = 0;
    const service = createVideoOutpaintService({ resolveAsset: async filePath => ({ filePath }), probeVideo: probe, runFfmpeg: run, statFile: stat,
      createTarget: async (_body, kind, ext) => { const filePath = path.join(directory, `${++sequence}-${kind}${ext}`); return { filePath, publicPath: filePath }; } });
    const prepared = await service.prepare({ videoOutpaint: { model: "seedance-2.5", seedanceResolution: "480p", feather: 32, matchExtensionColor: true } }, source);
    await run(["-y", "-f", "lavfi", "-i", "color=c=0x785028:s=480x854:r=24", "-frames:v", String(prepared.plan.frames), ...encode, raw]);
    const output = await service.finish({}, prepared, { filePath: raw });
    const info = await probe(output.filePath);
    assert.equal(output.matching.colorMatching.applied, true);
    assert.equal(info.color_space, "bt709");
    assert.equal(info.color_transfer, "bt709");
    assert.equal(info.color_primaries, "bt709");
    // ProRes MOV does not signal range in all FFprobe builds; video values are
    // explicitly limited during conversion and the matrix/transfer are tagged.
    const pixel = async (file, x, y) => {
      const { stdout } = await execute(ffmpeg, ["-v", "error", "-i", file, "-vf", `crop=8:8:${x}:${y},scale=1:1,format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, encoding: "buffer" });
      return [...stdout];
    };
    const original = await pixel(source, 20, 20), core = await pixel(output.filePath, 240, 400), extension = await pixel(output.filePath, 240, 40);
    for (let c = 0; c < 3; c++) {
      assert.ok(Math.abs(core[c] - original[c]) <= 2, `Source color changed: ${original} -> ${core}`);
      assert.ok(Math.abs(extension[c] - core[c]) <= 2, `Matrix mismatch at join: ${core} / ${extension}`);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
