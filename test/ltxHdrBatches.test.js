import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import test from "node:test";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";
import yauzl from "yauzl";
import yazl from "yazl";
import { assembleHdrArchive, assembleHdrVideo, extractHdrFrames, prepareHdrBatches } from "../server/ltx-hdr-batches.js";

const exec = promisify(execFile);
const runFfmpeg = (args) => exec(ffmpeg, args, { windowsHide: true });
const frameRate = "30000/1001";
const fps = 30000 / 1001;

async function probeVideo(file) {
  const { stdout } = await exec(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", file]);
  const { streams } = JSON.parse(stdout);
  const video = streams.find((stream) => stream.codec_type === "video");
  const [numerator, denominator] = video.avg_frame_rate.split("/").map(Number);
  return {
    fps: numerator / denominator, frameRate: video.avg_frame_rate, num_frames: Number(video.nb_frames),
    width: video.width, height: video.height, codecName: video.codec_name, pixelFormat: video.pix_fmt,
    colorSpace: video.color_space, colorTransfer: video.color_transfer, colorPrimaries: video.color_primaries,
    colorRange: video.color_range, audio: streams.some((stream) => stream.codec_type === "audio")
  };
}

for (const sourceFrames of [130, 131]) {
  test(`HDR batches assemble ${sourceFrames} frames at fractional fps with audio and HLG metadata`, { skip: !ffmpeg }, async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), "newtnode-hdr-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const source = path.join(directory, "input.mp4");
    await runFfmpeg([
      "-v", "error", "-f", "lavfi", "-i", `testsrc2=size=96x64:rate=${frameRate}`,
      "-f", "lavfi", "-i", "sine=duration=5", "-t", String(sourceFrames / fps),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", source
    ]);
    const metadata = await probeVideo(source);
    assert.equal(metadata.num_frames, sourceFrames);
    const batches = await prepareHdrBatches(source, directory, metadata, runFfmpeg, probeVideo);
    assert.deepEqual(batches.map(({ frames, submittedFrames }) => [frames, submittedFrames]),
      sourceFrames === 130 ? [[65, 65], [65, 65]] : [[65, 65], [65, 65], [1, 9]]);
    for (const [index, batch] of batches.entries()) {
      assert.equal((await probeVideo(batch.input)).num_frames, batch.submittedFrames);
      batch.videoName = `hdr-${index}.mp4`;
      const video = path.join(directory, batch.videoName);
      await runFfmpeg([
        "-v", "error", "-i", batch.input, "-c:v", "libx265", "-threads", "1", "-x265-params", "pools=1",
        "-pix_fmt", "yuv420p10le", "-color_primaries", "bt2020", "-colorspace", "bt2020nc",
        "-color_trc", "arib-std-b67", "-color_range", "tv", video
      ]);
      batch.videoMetadata = await probeVideo(video);
    }
    const output = path.join(directory, "output.mp4");
    const assembled = await assembleHdrVideo(batches, source, directory, metadata, output, runFfmpeg, probeVideo);
    assert.equal(assembled.num_frames, sourceFrames);
    assert.equal(assembled.fps, fps);
    assert.equal(assembled.audio, true);
    assert.equal(assembled.pixelFormat, "yuv420p10le");
    assert.equal(assembled.colorTransfer, "arib-std-b67");
  });
}

test("OpenEXR batches retain frame order, discard padded frames, and restart numbering only once", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "newtnode-hdr-exr-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const archive = path.join(directory, "batch.zip");
  const zip = new yazl.ZipFile();
  const written = pipeline(zip.outputStream, createWriteStream(archive));
  for (const index of [10, 2, 1]) zip.addBuffer(Buffer.from(String(index)), `render/frame_${index}.exr`);
  zip.addBuffer(Buffer.from("metadata"), "info.txt");
  zip.end();
  const batch = { frames: 2, videoMetadata: { num_frames: 3 } };
  await written;
  await extractHdrFrames(archive, directory, 0, batch);
  await extractHdrFrames(archive, directory, 2, batch);
  assert.equal(await readFile(path.join(directory, "frame_00000003.exr"), "utf8"), "2");
  const output = path.join(directory, "output.zip");
  await assembleHdrArchive(directory, 4, output);
  const assembled = await yauzl.openPromise(output, { lazyEntries: true });
  const names = [];
  for await (const entry of assembled.eachEntry()) names.push(entry.fileName);
  assert.deepEqual(names, Array.from({ length: 4 }, (_, index) => `frame_0000000${index}.exr`));
});
