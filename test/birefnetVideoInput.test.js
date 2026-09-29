import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  birefnetMaximumFrames,
  birefnetPreparedVideoTargetBytes,
  birefnetPreparedFrameRate,
  birefnetPreparedTargetFrames,
  birefnetVideoBitrates,
  falSinglePartUploadMaximumBytes,
  prepareBirefnetVideoInputAsset
} from "../server/birefnet-video-input.js";

test("BiRefNet keeps ordinary videos on Fal's single-part upload path", async () => {
  let probed = false;
  let transcoded = false;
  const result = await prepareBirefnetVideoInputAsset("/outputs/source.mp4", {
    resolveLocalAssetPath: async () => ({ fileName: "source.mp4", filePath: "source.mp4" }),
    probeVideoFile: async () => {
      probed = true;
      return { duration: 8, fps: 24, num_frames: 192 };
    },
    createTarget: async () => ({ publicPath: "/outputs/prepared.mp4", filePath: "prepared.mp4" }),
    runFfmpeg: async () => { transcoded = true; },
    statFile: async () => ({ size: 12 * 1024 * 1024 })
  });

  assert.equal(result.prepared, false);
  assert.equal(result.publicPath, "/outputs/source.mp4");
  assert.equal(probed, true);
  assert.equal(transcoded, false);
});

test("BiRefNet transcodes multipart-sized videos into an upload-safe MP4", async () => {
  const calls = { args: null, label: "", timeout: 0, sourceBaseName: "", statCount: 0 };
  const result = await prepareBirefnetVideoInputAsset("/workflow-assets/project/inputs/source.mp4", {
    resolveLocalAssetPath: async () => ({
      fileName: "source.mp4",
      filePath: path.join("package", "inputs", "source.mp4")
    }),
    probeVideoFile: async () => ({ duration: 46.833333, fps: 30, num_frames: 1405, width: 2160, height: 2160 }),
    createTarget: async ({ sourceBaseName }) => {
      calls.sourceBaseName = sourceBaseName;
      return { publicPath: "/workflow-assets/project/dependencies/source-birefnet-source.mp4", filePath: "prepared.mp4" };
    },
    runFfmpeg: async (args, label, timeout) => {
      calls.args = args;
      calls.label = label;
      calls.timeout = timeout;
    },
    statFile: async () => ({ size: ++calls.statCount === 1 ? 129_223_697 : 70 * 1024 * 1024 })
  });

  assert.equal(result.prepared, true);
  assert.equal(result.sourceBytes, 129_223_697);
  assert.equal(result.uploadBytes, 70 * 1024 * 1024);
  assert.ok(result.preparedFps > 10.8 && result.preparedFps < 11);
  assert.equal(calls.sourceBaseName, "source");
  assert.equal(calls.label, "BiRefNet video upload preparation");
  assert.equal(calls.timeout, 600000);
  assert.deepEqual(calls.args.slice(0, 8), [
    "-y",
    "-i", path.join("package", "inputs", "source.mp4"),
    "-map", "0:v:0",
    "-map", "0:a?",
    "-vf"
  ]);
  assert.equal(calls.args.at(-1), "prepared.mp4");
  assert.ok(calls.args.includes("libx264"));
  assert.ok(calls.args.includes("aac"));
  assert.match(calls.args[calls.args.indexOf("-vf") + 1], /fps=10\./);
});

test("BiRefNet prepares small videos when they exceed the provider frame limit", async () => {
  let transcoded = false;
  const result = await prepareBirefnetVideoInputAsset("/outputs/long.mp4", {
    resolveLocalAssetPath: async () => ({ fileName: "long.mp4", filePath: "long.mp4" }),
    probeVideoFile: async () => ({ duration: 30, fps: 24, num_frames: 720 }),
    createTarget: async () => ({ publicPath: "/outputs/long-prepared.mp4", filePath: "long-prepared.mp4" }),
    runFfmpeg: async () => { transcoded = true; },
    statFile: async (filePath) => ({ size: filePath === "long.mp4" ? 10 * 1024 * 1024 : 8 * 1024 * 1024 })
  });

  assert.equal(result.prepared, true);
  assert.equal(transcoded, true);
  assert.equal(result.preparedFps, 17);
});

test("BiRefNet preparation targets well below the Fal multipart boundary", () => {
  assert.equal(falSinglePartUploadMaximumBytes, 90 * 1024 * 1024);
  assert.equal(birefnetPreparedVideoTargetBytes, 72 * 1024 * 1024);
  assert.equal(birefnetMaximumFrames, 512);
  assert.equal(birefnetPreparedTargetFrames, 510);
  assert.equal(birefnetPreparedFrameRate({ durationSeconds: 46.833333, fps: 30, frameCount: 1405 }).toFixed(3), "10.890");
  assert.equal(birefnetPreparedFrameRate({ durationSeconds: 8, fps: 24, frameCount: 192 }), null);
  const bitrates = birefnetVideoBitrates(46.833333);
  assert.ok(bitrates.videoKbps > 11_500);
  assert.ok(bitrates.videoKbps < 12_500);
  assert.equal(bitrates.audioKbps, 128);
});
