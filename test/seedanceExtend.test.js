import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";
import { extendSeedanceVideo } from "../server/seedance-extend.js";

const exec = promisify(execFile);

test("Seedance Extend alternates whole forward and reverse passes and keeps audio", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "seedance-extend-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, "source.mp4");
  const target = path.join(directory, "extended.mp4");
  const runFfmpeg = (args) => exec(ffmpeg, args, { timeout: 30000 });
  const probe = async (filePath) => {
    const { stdout } = await exec(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", filePath]);
    return JSON.parse(stdout).streams;
  };
  await runFfmpeg([
    "-f", "lavfi", "-i", "nullsrc=size=64x48:rate=24:duration=1.125,geq=lum='32+6*N':cb=128:cr=128",
    "-f", "lavfi", "-i", "sine=duration=1.125", "-c:v", "libx264", "-c:a", "aac", source
  ]);
  const result = await extendSeedanceVideo("/uploads/source.mp4", {
    resolveAsset: async () => ({ filePath: source }),
    probeVideo: async (filePath) => {
      const [video, audio] = await probe(filePath);
      return { ...video, duration: Number(video.duration), hasAudio: audio?.codec_type === "audio" };
    },
    createTarget: async () => ({ filePath: target, publicPath: "/outputs/extended.mp4" }),
    runFfmpeg
  });
  assert.equal(result.url, "/outputs/extended.mp4");
  assert.ok(Math.abs(result.duration - 4.5) < 0.01, `Measured duration: ${result.duration}`);
  const [video, audio] = await probe(target);
  assert.equal(Number(video.nb_frames), 108);
  assert.equal(audio.codec_type, "audio");
  assert.ok(Number(audio.duration) >= 4.5);
  const { stdout: frames } = await exec(ffmpeg, [
    "-v", "error", "-i", target, "-vf", "scale=1:1,format=gray", "-f", "rawvideo", "-"
  ], { encoding: "buffer" });
  assert.equal(frames.length, 108);
  for (let index = 0; index < frames.length; index++) {
    const withinPass = index % 27;
    const sourceIndex = Math.floor(index / 27) % 2 ? 26 - withinPass : withinPass;
    const expected = (32 + 6 * sourceIndex - 16) * 255 / 219;
    assert.ok(Math.abs(frames[index] - expected) < 4, `Frame ${index} should show source frame ${sourceIndex}`);
  }
});

test("Seedance Extend passes through a clip that already meets the minimum", async () => {
  const url = "/uploads/source.mp4";
  assert.deepEqual(await extendSeedanceVideo(url, {
    resolveAsset: async () => ({ filePath: "source.mp4" }),
    probeVideo: async () => ({ width: 64, height: 48, duration: 4 }),
    createTarget: () => assert.fail("No derived file is needed")
  }), { url, duration: 4 });
});

test("Seedance Extend can repeat a silent one-frame clip without adding audio", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "seedance-extend-silent-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, "source.mp4");
  const target = path.join(directory, "extended.mp4");
  const runFfmpeg = (args) => exec(ffmpeg, args, { timeout: 30000 });
  await runFfmpeg(["-f", "lavfi", "-i", "color=size=64x48:rate=24", "-frames:v", "1", source]);
  await extendSeedanceVideo("/uploads/source.mp4", {
    resolveAsset: async () => ({ filePath: source }),
    probeVideo: async (filePath) => {
      const { stdout } = await exec(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", filePath]);
      const streams = JSON.parse(stdout).streams;
      assert.equal(streams.length, 1);
      assert.equal(streams[0].codec_type, "video");
      return { ...streams[0], duration: Number(streams[0].duration) };
    },
    createTarget: async () => ({ filePath: target, publicPath: "/outputs/extended.mp4" }),
    runFfmpeg
  });
});
