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

test("real FFmpeg outpainting prep and restoration preserve the source center, generated border, timing and audio", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-outpaint-media-"));
  const run = args => execute(ffmpeg, args, { windowsHide: true, timeout: 30000 });
  const probe = async file => {
    const { stdout } = await execute(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { windowsHide: true, timeout: 10000 });
    const data = JSON.parse(stdout), video = data.streams.find(s => s.codec_type === "video");
    return { width: video.width, height: video.height, duration: Number(video.duration || data.format.duration), fps: 24, frames: Number(video.nb_frames), audio: data.streams.some(s => s.codec_type === "audio") };
  };
  try {
    const source = path.join(directory, "source.mp4"), generated = path.join(directory, "generated.mp4");
    await run(["-y", "-f", "lavfi", "-i", "color=red:s=64x64:r=24", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "3.5", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", source]);
    await run(["-y", "-f", "lavfi", "-i", "color=blue:s=432x768:r=24", "-frames:v", "81", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", generated]);
    const service = createVideoOutpaintService({ resolveAsset: async filePath => ({ filePath }), probeVideo: probe,
      createTarget: async (body, kind, ext) => ({ filePath: path.join(directory, kind + ext), publicPath: path.join(directory, kind + ext), fileName: kind + ext }),
      runFfmpeg: run, statFile: stat });
    const prepared = await service.prepare({ videoOutpaint: { outputSize: "720p", feather: 0 } }, source);
    const padded = await probe(prepared.videoUrl), mask = await probe(prepared.maskVideoUrl);
    assert.equal(padded.frames, 81); assert.equal(mask.frames, 81); assert.equal(padded.duration, mask.duration);
    const output = await service.finish({}, prepared, { filePath: generated });
    const final = await probe(output.filePath);
    assert.deepEqual([final.width, final.height, final.frames], [720, 1280, 81]); assert.equal(final.audio, true);
    const pixel = async (x, y, file = output.filePath) => {
      const { stdout } = await execute(ffmpeg, ["-v", "error", "-ss", "1", "-i", file, "-vf", `crop=2:2:${x}:${y},format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, timeout: 10000, encoding: "buffer" });
      return [...stdout.subarray(0, 3)];
    };
    const center = await pixel(360, 640), border = await pixel(360, 10);
    assert.ok(center[0] > 200 && center[2] < 20, `Original red source was not restored: ${center}`);
    assert.ok(border[2] > 200 && border[0] < 20, `Generated blue border was not retained: ${border}`);
    const split = path.join(directory, "split.mp4");
    await run(["-y", "-f", "lavfi", "-i", "color=red:s=64x64:r=24", "-vf", "drawbox=x=32:y=0:w=32:h=64:color=lime:t=fill", "-t", "3.5", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", split]);
    const offset = await service.prepare({ videoOutpaint: { aspectRatio: "1:1", frame: { x: 0.5, y: -0.25, width: 1 }, outputSize: "720p", feather: 0 } }, split);
    assert.deepEqual(offset.plan.sourceCrop, { x: 32, y: 0, width: 32, height: 48 });
    const maskInside = await pixel(100, 300, offset.maskVideoUrl), maskOutside = await pixel(500, 300, offset.maskVideoUrl);
    assert.ok(maskInside.every(value => value < 10)); assert.ok(maskOutside.every(value => value > 240));
    const offsetOutput = await service.finish({}, offset, { filePath: generated });
    const retained = await pixel(100, 400, offsetOutput.filePath), right = await pixel(600, 400, offsetOutput.filePath), top = await pixel(100, 10, offsetOutput.filePath);
    assert.ok(retained[1] > 200 && retained[0] < 20, `Offset source crop was not restored: ${retained}`);
    assert.ok(right[2] > 200 && top[2] > 200, "Generated right/top areas were overwritten by cropped-out source footage.");
  } finally {
    const relative = path.relative(os.tmpdir(), directory);
    if (!relative.startsWith("newt-outpaint-media-") || relative.includes(path.sep)) throw new Error("Refusing cleanup outside owned test directory.");
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
