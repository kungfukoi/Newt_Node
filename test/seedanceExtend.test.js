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

test("Seedance Extend keeps whole loops and embedded audio", async (t) => {
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
    "-f", "lavfi", "-i", "testsrc2=size=64x48:rate=24:duration=2.5",
    "-f", "lavfi", "-i", "sine=duration=2.5", "-c:v", "libx264", "-c:a", "aac", source
  ]);
  const result = await extendSeedanceVideo("/uploads/source.mp4", {
    resolveAsset: async () => ({ filePath: source }),
    probeVideo: async (filePath) => {
      const [video] = await probe(filePath);
      return { ...video, duration: Number(video.duration) };
    },
    createTarget: async () => ({ filePath: target, publicPath: "/outputs/extended.mp4" }),
    runFfmpeg
  });
  assert.equal(result.url, "/outputs/extended.mp4");
  assert.ok(result.duration >= 5 && result.duration < 5.1, `Measured duration: ${result.duration}`);
  const [video, audio] = await probe(target);
  assert.equal(Number(video.nb_frames), 120);
  assert.equal(audio.codec_type, "audio");
  assert.ok(Number(audio.duration) >= 5);
});

test("Seedance Extend passes through a clip that already meets the minimum", async () => {
  const url = "/uploads/source.mp4";
  assert.deepEqual(await extendSeedanceVideo(url, {
    resolveAsset: async () => ({ filePath: "source.mp4" }),
    probeVideo: async () => ({ width: 64, height: 48, duration: 4 }),
    createTarget: () => assert.fail("No derived file is needed")
  }), { url, duration: 4 });
});
