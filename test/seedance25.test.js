import assert from "node:assert/strict";
import test from "node:test";

import {
  isSeedance25Model,
  normalizeSeedance25AspectRatio,
  normalizeSeedance25Duration,
  normalizeSeedance25Resolution,
  seedance25AspectRatioOptions,
  seedance25DurationOptions,
  seedance25Endpoint,
  seedance25ModelName,
  seedance25ReferenceLimits,
  seedance25ResolutionOptions
} from "../src/seedance25.js";
import { videoModelNames, videoModelOptions } from "../src/modelOptions.js";
import { videoModelSupportsFilmDirector } from "../src/nodeRunners/videoModels.js";
import { supportsKreaModel } from "../src/kreaApi.js";

test("Seedance 2.5 is a distinct dual-provider Video Model option", () => {
  assert.equal(seedance25ModelName, "Seedance 2.5");
  assert.equal(videoModelNames.seedance25, seedance25ModelName);
  assert.ok(videoModelOptions.includes(seedance25ModelName));
  assert.equal(videoModelSupportsFilmDirector(seedance25ModelName), true);
  assert.equal(supportsKreaModel("video", seedance25ModelName), true);
});

test("Seedance 2.5 controls match the published Fal schema", () => {
  assert.equal(seedance25DurationOptions[0], "auto");
  assert.equal(seedance25DurationOptions[1], "4 seconds");
  assert.equal(seedance25DurationOptions.at(-1), "30 seconds");
  assert.deepEqual(seedance25ResolutionOptions, ["1080p", "720p", "480p"]);
  assert.deepEqual(seedance25AspectRatioOptions, ["auto", "21:9", "16:9 (Landscape)", "4:3", "1:1", "3:4", "9:16 (Portrait)"]);
  assert.deepEqual(seedance25ReferenceLimits, {
    images: 30,
    videos: 10,
    audios: 10,
    total: 50,
    minimumMediaSeconds: 1.8,
    videoSeconds: 30.2,
    audioSeconds: 30.2
  });
});

test("Seedance 2.5 normalizes API values without inheriting 2.0 limits", () => {
  assert.equal(isSeedance25Model("Seedance 2.5"), true);
  assert.equal(isSeedance25Model("Seedance 2.0"), false);
  assert.equal(normalizeSeedance25Duration("auto"), "auto");
  assert.equal(normalizeSeedance25Duration("30 seconds"), "30");
  assert.equal(normalizeSeedance25Duration("31 seconds"), "auto");
  assert.equal(normalizeSeedance25Resolution("4k"), "720p");
  assert.equal(normalizeSeedance25Resolution("1080p"), "1080p");
  assert.equal(normalizeSeedance25AspectRatio("16:9 (Landscape)"), "16:9");
  assert.equal(normalizeSeedance25AspectRatio("Auto"), "auto");
  assert.equal(normalizeSeedance25AspectRatio("16:9 (Landscape)", "image-to-video"), "auto");
});

test("Seedance 2.5 route IDs use the official Fal endpoint family", () => {
  assert.equal(seedance25Endpoint("text-to-video"), "bytedance/seedance-2.5/text-to-video");
  assert.equal(seedance25Endpoint("image-to-video"), "bytedance/seedance-2.5/image-to-video");
  assert.equal(seedance25Endpoint("reference-to-video"), "bytedance/seedance-2.5/reference-to-video");
});

