import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

import { createAtlasMedia } from "../server/atlas-media.js";
import { prepareAtlasVideoReferenceAsset, prepareAtlasSeedanceImageAsset } from "../server/atlas-video-input.js";

function dependencies({ width, height }) {
  const calls = { ffmpeg: [], removed: [] };
  return {
    calls,
    values: {
      resolveLocalAssetPath: async () => ({ fileName: "motion.mov", filePath: "C:\\media\\motion.mov" }),
      readLocalAsset: async () => ({ fileName: "motion.mov", buffer: Buffer.from("original"), mimeType: "video/quicktime" }),
      probeVideoFile: async () => ({ width, height }),
      runFfmpeg: async (args) => calls.ffmpeg.push(args),
      readFile: async () => Buffer.from("normalized"),
      removeFile: async (filePath) => calls.removed.push(filePath),
      temporaryDirectory: path.join("temporary"),
      randomId: () => "test-id"
    }
  };
}

test("Atlas video references pass through unchanged when their pixel count is valid", async () => {
  const { calls, values } = dependencies({ width: 1280, height: 720 });
  const result = await prepareAtlasVideoReferenceAsset("/workflow-assets/project/inputs/motion.mov", values);
  assert.equal(result.buffer.toString(), "original");
  assert.equal(calls.ffmpeg.length, 0);
});

test("Atlas video references below the provider minimum are upscaled without crop or padding", async () => {
  const { calls, values } = dependencies({ width: 740, height: 400 });
  const result = await prepareAtlasVideoReferenceAsset("/workflow-assets/project/inputs/motion.mov", values);
  assert.equal(result.fileName, "motion-atlas-reference.mp4");
  assert.equal(result.mimeType, "video/mp4");
  assert.equal(result.buffer.toString(), "normalized");
  assert.equal(calls.ffmpeg.length, 1);
  assert.ok(calls.ffmpeg[0].includes("scale=870:470:flags=lanczos,setsar=1"));
  assert.equal(calls.ffmpeg[0].some((argument) => String(argument).includes("crop")), false);
  assert.equal(calls.ffmpeg[0].some((argument) => String(argument).includes("pad=")), false);
  assert.deepEqual(calls.removed, [path.join("temporary", "newtnode-atlas-video-reference-test-id.mp4")]);
});

test("Atlas upload preparation applies only to video references", async () => {
  const image = await sharp({ create: { width: 600, height: 400, channels: 4, background: "white" } }).png().toBuffer();
  const uploaded = [];
  const atlas = createAtlasMedia({
    client: {
      upload: async (asset) => {
        uploaded.push(asset.fileName);
        return `https://example.com/upload-${uploaded.length}`;
      },
      generate: async () => ({ requestId: "request-1", url: "https://example.com/result.mp4" })
    },
    readLocalAsset: async (source) => ({ fileName: path.basename(source), buffer: source.endsWith(".png") ? image : Buffer.from(source), mimeType: source.endsWith(".png") ? "image/png" : "application/octet-stream" }),
    prepareVideoSource: async () => ({ fileName: "prepared-reference.mp4", buffer: Buffer.from("prepared"), mimeType: "video/mp4" }),
    imageSize: () => "1024x1024",
    labelPrompt: (prompt) => prompt
  });

  await atlas.video({
    model: "Seedance 2.5",
    prompt: "Use the references",
    images: ["/local/reference.png"],
    videos: ["/local/reference.mp4"],
    audios: ["/local/reference.wav"],
    duration: "5 seconds",
    resolution: "720p",
    aspectRatio: "16:9"
  }, "atlas-key");

  assert.deepEqual(uploaded, ["reference.png", "prepared-reference.mp4", "reference.wav"]);
});

test("Atlas pads the Shot 6 crop without cutting or stretching its pixels", async () => {
  const original = await sharp({ create: { width: 2752, height: 308, channels: 4, background: "#123456" } }).png().toBuffer();
  const asset = await prepareAtlasSeedanceImageAsset({ buffer: original, mimeType: "image/png", fileName: "paddles.png" });
  const info = await sharp(asset.buffer).metadata();
  assert.equal(info.width, 2752); assert.equal(info.height, 1101); assert.ok(info.width / info.height <= 2.5);
  const restored = await sharp(asset.buffer).extract({ left: 0, top: Math.floor((1101 - 308) / 2), width: 2752, height: 308 }).raw().toBuffer();
  assert.deepEqual(restored, await sharp(original).raw().toBuffer());
  assert.equal(asset.atlasNormalization.padded, true);
});

test("Atlas keeps valid images byte-identical and fits tiny, tall and oversized references", async () => {
  for (const [width, height] of [[2000, 2000], [80, 60], [308, 2752], [6500, 300]]) {
    const original = await sharp({ create: { width, height, channels: 4, background: "white" } }).png().toBuffer();
    const asset = { fileName: "reference.png", buffer: original, mimeType: "image/png" };
    const result = await prepareAtlasSeedanceImageAsset(asset), info = await sharp(result.buffer).metadata();
    assert.ok(info.width / info.height >= .4 && info.width / info.height <= 2.5);
    assert.ok(Math.min(info.width, info.height) >= 300 && Math.max(info.width, info.height) <= 6000);
    if (width === 2000) assert.equal(result, asset);
  }
});


test('Atlas normalizes unsupported codecs and out-of-range FPS without changing playback speed', async () => {
  const { calls, values } = dependencies({ width: 1280, height: 720 });
  values.probeVideoFile = async () => ({ width: 1280, height: 720, fps: 12, codecName: 'prores' });
  const result = await prepareAtlasVideoReferenceAsset('/workflow-assets/p/inputs/motion.mov', values);
  assert.equal(result.mimeType, 'video/mp4');
  assert.ok(calls.ffmpeg[0].includes('libx264'));
  assert.ok(calls.ffmpeg[0].some(value => String(value).includes('fps=24')));
  assert.equal(calls.ffmpeg[0].some(value => /setpts|atempo/.test(String(value))), false);
});
