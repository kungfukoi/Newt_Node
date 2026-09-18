import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createAtlasMedia } from "../server/atlas-media.js";
import { prepareAtlasVideoReferenceAsset } from "../server/atlas-video-input.js";

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
  const uploaded = [];
  const atlas = createAtlasMedia({
    client: {
      upload: async (asset) => {
        uploaded.push(asset.fileName);
        return `https://example.com/upload-${uploaded.length}`;
      },
      generate: async () => ({ requestId: "request-1", url: "https://example.com/result.mp4" })
    },
    readLocalAsset: async (source) => ({ fileName: path.basename(source), buffer: Buffer.from(source), mimeType: "application/octet-stream" }),
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
