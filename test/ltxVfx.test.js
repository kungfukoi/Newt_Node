import test from "node:test";
import assert from "node:assert/strict";
import { findLtxVfxModel, ltxVfxFalInput, ltxVfxModelNames, ltxVfxModels, ltxVfxRate, ltxVfxSourceError } from "../src/ltxVfx.js";
import { enabledUtilityVideoModelOptions } from "../src/modelOptions.js";
import { providerSupportedModels } from "../src/modelProviderRouting.js";
import { buildUtilityVideoRequest, normalizeUtilityVideoGenerationResult } from "../src/nodeRunners/videoModels.js";
import { nodeApi } from "../src/api/newtApi.js";

test("HDR blocks an older backend before submitting to Fal", async (t) => {
  const calls = [];
  let hasBatching = false;
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(new URL(url, "http://localhost").pathname);
    return Response.json({ routes: { ltxVfx: true, ltxHdrBatches: hasBatching } });
  });
  const body = { model: ltxVfxModels.hdr.displayName };
  await assert.rejects(nodeApi.utilityVideo(body), /Restart the NewtNode backend to enable 65-frame HDR batching/);
  assert.deepEqual(calls, ["/api/health"]);
  hasBatching = true;
  assert.equal((await nodeApi.utilityVideo(body)).response.ok, true);
  assert.deepEqual(calls, ["/api/health", "/api/health", "/api/node/utility-video"]);
});

test("all four LTX VFX tools are enabled Utility Video models routed to Fal", () => {
  const enabled = enabledUtilityVideoModelOptions();
  for (const label of ltxVfxModelNames) {
    assert.ok(enabled.includes(label));
    assert.ok(providerSupportedModels("utilityVideo", "fal").includes(label));
    assert.ok(!providerSupportedModels("utilityVideo", "krea").includes(label));
    assert.equal(findLtxVfxModel(findLtxVfxModel(label).id).displayName, label);
  }
});

test("LTX VFX Utility settings map to each Fal request schema", () => {
  const video_url = "https://fal.example/source.mp4";
  const { alphaGen, reframe, upscale, hdr } = ltxVfxModels;
  const selectedSettings = { aspect_ratio: "9:16", resolution: "720p", anchor: "bottom_left" };
  const request = buildUtilityVideoRequest({
    node: { id: "utility", data: { ltxVfx: { [reframe.id]: selectedSettings } } },
    model: reframe.displayName,
    referenceVideoUrls: ["/outputs/source.mp4"]
  });
  assert.deepEqual(request.ltxVfx, selectedSettings);
  assert.deepEqual(ltxVfxFalInput(reframe, request.ltxVfx, video_url), {
    video_url, aspect_ratio: "9:16", resolution: "720p", placement: { anchor: "bottom_left" }
  });
  const rectangle = { x: 0.1, y: 0.2, width: 0.6 };
  const custom = { ...selectedSettings, rectangle, enable_safety_checker: false };
  assert.deepEqual(ltxVfxFalInput(reframe, custom, video_url), {
    video_url, aspect_ratio: "9:16", resolution: "720p", placement: rectangle, enable_safety_checker: false
  });
  assert.equal(ltxVfxSourceError(reframe, custom, { width: 640, height: 360 }), "");
  assert.match(ltxVfxSourceError(reframe, custom, { width: 128, height: 72 }), /up to 2×/);
  assert.deepEqual(ltxVfxFalInput(alphaGen, selectedSettings, video_url), { video_url });
  assert.deepEqual(ltxVfxFalInput(upscale, { resolution: "8k" }, video_url), { video_url, resolution: "8k" });
  assert.deepEqual(ltxVfxFalInput(hdr, {}, video_url), { video_url, output_colorspace: "acescg" });
});

test("LTX VFX preflight and pricing use source constraints and selected tier", () => {
  const { alphaGen, reframe, upscale, hdr } = ltxVfxModels;
  const source = { width: 1920, height: 1080, fps: 24, num_frames: 242, codecName: "h264", bytes: 100_000 };
  assert.equal(ltxVfxSourceError(upscale, { resolution: "4k" }, source), "");
  assert.match(ltxVfxSourceError(upscale, { resolution: "8k" }, source), /241/);
  assert.match(ltxVfxSourceError(upscale, { resolution: "1080p" }, { ...source, codecName: "prores" }), /H.264 or HEVC/);
  assert.match(ltxVfxSourceError(alphaGen, {}, { ...source, bytes: 200_000_001 }), /200 MB/);
  assert.equal(ltxVfxRate(alphaGen, {}, { width: 1440, height: 2560 }), 0.25);
  assert.equal(ltxVfxRate(reframe, { resolution: "720p" }, source), 0.10);
  assert.equal(ltxVfxRate(upscale, { resolution: "8k" }, source), 1.20);
  assert.equal(ltxVfxRate(hdr, {}, { width: 2560, height: 1440 }), 0.40);
});

test("LTX VFX results retain both Alpha videos and the HDR archive download", () => {
  const cost = { amountUsd: 0.5 };
  const alpha = normalizeUtilityVideoGenerationResult({
    cost,
    resultItems: [
      { type: "video", label: "Alpha matte", localUrl: "/outputs/matte.mp4" },
      { type: "video", label: "ProRes 4444 cutout", localUrl: "/outputs/cutout.mov", mimeType: "video/quicktime" }
    ]
  }, 0);
  assert.deepEqual(alpha.map(({ url }) => url), ["/outputs/matte.mp4", "/outputs/cutout.mov"]);
  assert.deepEqual(alpha.map((item) => item.cost), [cost, null]);
  const exrArchive = { url: "/outputs/frames.zip", fileName: "frames.zip" };
  const [hdr] = normalizeUtilityVideoGenerationResult({
    resultItems: [{ type: "video", localUrl: "/outputs/hdr.mp4", exrArchive }]
  }, 0);
  assert.deepEqual(hdr.exrArchive, exrArchive);
});
