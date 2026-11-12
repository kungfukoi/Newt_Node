import { createWriteStream } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import yazl from "yazl";

const batchFrames = 65;
const mediaTimeout = 600_000;
const inputEncode = ["-an", "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p"];
const frameName = (index) => `frame_${String(index).padStart(8, "0")}.exr`;
const exactFps = ({ frameRate }) => {
  const [numerator, denominator = 1] = frameRate.split("/").map(Number);
  return numerator / denominator;
};

export async function prepareHdrBatches(source, directory, metadata, runFfmpeg, probeVideo) {
  const { frameRate } = metadata;
  const fps = exactFps(metadata);
  await runFfmpeg([
    "-v", "error", "-y", "-i", source, "-map", "0:v:0",
    "-vf", `settb=expr=1/(${frameRate}),setpts=N`, "-r", frameRate,
    ...inputEncode, "-sc_threshold", "0", "-force_key_frames", `expr:eq(mod(n,${batchFrames}),0)`,
    "-f", "segment", "-segment_time", String(batchFrames / fps), "-segment_time_delta", String(0.5 / fps),
    "-reset_timestamps", "1", path.join(directory, "source-%08d.mp4")
  ], "Split LTX HDR source into 65-frame batches", mediaTimeout);

  const names = (await readdir(directory)).filter((name) => /^source-\d+\.mp4$/.test(name)).sort();
  const batches = [];
  for (const [index, name] of names.entries()) {
    let input = path.join(directory, name);
    const { num_frames: frames } = await probeVideo(input);
    if (!Number.isInteger(frames) || frames < 1 || frames > batchFrames ||
        (index < names.length - 1 && frames !== batchFrames)) {
      throw new Error(`Could not split HDR source at batch ${index + 1}.`);
    }
    // LTX works with 8k+1 frames. A one-frame tail still needs a video clip.
    const submittedFrames = Math.max(9, Math.ceil((frames - 1) / 8) * 8 + 1);
    if (submittedFrames > frames) {
      const padded = path.join(directory, "source-tail.mp4");
      await runFfmpeg([
        "-v", "error", "-y", "-i", input, "-vf", `tpad=stop_mode=clone:stop=${submittedFrames - frames}`,
        "-r", frameRate, ...inputEncode, padded
      ], "Pad the final LTX HDR batch", mediaTimeout);
      input = padded;
    }
    batches.push({ input, frames, submittedFrames });
  }
  if (!batches.length || (metadata.num_frames && batches.reduce((sum, batch) => sum + batch.frames, 0) !== metadata.num_frames)) {
    throw new Error("The HDR batches do not match the source frame count.");
  }
  return batches;
}

export async function assembleHdrVideo(batches, source, directory, metadata, output, runFfmpeg, probeVideo) {
  const first = batches[0].videoMetadata;
  const videoProperties = ["width", "height", "pixelFormat", "colorSpace", "colorTransfer", "colorPrimaries", "colorRange"];
  if (batches.some(({ videoMetadata }) => videoProperties.some((key) => first[key] !== videoMetadata[key]))) {
    throw new Error("Fal returned HDR batches with inconsistent dimensions or color formats.");
  }
  const frames = batches.reduce((sum, batch) => sum + batch.frames, 0);
  const fps = exactFps(metadata);
  const manifest = path.join(directory, "video.ffconcat");
  await writeFile(manifest, batches.map(({ videoName, videoMetadata }) =>
    `file '${videoName}'\nduration ${videoMetadata.num_frames / exactFps(videoMetadata)}\n`).join(""));
  const canCopy = batches.every(({ frames, videoMetadata }) => videoMetadata.num_frames === frames &&
    Math.abs(videoMetadata.fps - metadata.fps) < 0.001 && videoMetadata.codecName === first.codecName &&
    videoMetadata.frameRate === first.frameRate);
  const colorOptions = Object.entries({
    colorspace: first.colorSpace, color_trc: first.colorTransfer,
    color_primaries: first.colorPrimaries, color_range: first.colorRange
  }).flatMap(([key, value]) => value && value !== "unknown" ? [`-${key}`, value] : []);
  const encode = canCopy ? ["-c:v", "copy"] : [
    "-vf", `trim=end_frame=${frames},settb=expr=1/(${metadata.frameRate}),setpts=N`,
    "-r", metadata.frameRate, "-c:v", "libx265",
    "-preset", "fast", "-crf", "15", "-pix_fmt", first.pixelFormat, ...colorOptions
  ];
  await runFfmpeg([
    "-v", "error", "-y", "-f", "concat", "-i", manifest, "-i", source,
    "-map", "0:v:0", "-map", "1:a?", ...encode,
    ...(!canCopy || first.codecName === "hevc" ? ["-tag:v", "hvc1"] : []),
    "-c:a", "aac", "-b:a", "320k", "-t", String(frames / fps), "-movflags", "+faststart", output
  ], "Assemble LTX HDR video", mediaTimeout);
  const assembled = await probeVideo(output);
  if (assembled.num_frames !== frames || !assembled.fps || Math.abs(assembled.fps - metadata.fps) > 0.01 ||
      videoProperties.some((key) => assembled[key] !== first[key])) {
    throw new Error("The assembled HDR video did not retain the expected frames, timing, or color format.");
  }
  return assembled;
}

export async function extractHdrFrames(archivePath, directory, firstFrame, batch) {
  const archive = await yauzl.openPromise(archivePath, { lazyEntries: true, autoClose: false });
  try {
    const entries = [];
    for await (const entry of archive.eachEntry()) {
      if (/\.exr$/i.test(entry.fileName) && !entry.fileName.startsWith("__MACOSX/")) entries.push(entry);
    }
    const frameOrder = new Intl.Collator("en", { numeric: true });
    entries.sort((a, b) => frameOrder.compare(a.fileName, b.fileName));
    if (entries.length !== batch.videoMetadata.num_frames) {
      throw new Error("Fal returned an OpenEXR frame count that differs from its video.");
    }
    for (const [index, entry] of entries.slice(0, batch.frames).entries()) {
      const frame = await archive.openReadStreamPromise(entry);
      await pipeline(frame, createWriteStream(path.join(directory, frameName(firstFrame + index))));
    }
  } finally {
    archive.close();
  }
}

export async function assembleHdrArchive(directory, frames, output) {
  const zip = new yazl.ZipFile();
  for (let index = 0; index < frames; index++) {
    const name = frameName(index);
    zip.addFile(path.join(directory, name), name, { compress: false });
  }
  const done = pipeline(zip.outputStream, createWriteStream(output));
  zip.on("error", (error) => zip.outputStream.destroy(error));
  zip.end();
  await done;
}
