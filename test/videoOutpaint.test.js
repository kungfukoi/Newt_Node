import test from "node:test";
import assert from "node:assert/strict";
import { planVideoOutpaint, normalizeVideoOutpaintSettings, videoOutpaintFingerprint } from "../src/videoOutpaint.js";
import { createVideoOutpaintService } from "../server/video-outpaint.js";
import { buildUtilityVideoRequest, normalizeUtilityVideoGenerationResult } from "../src/nodeRunners/videoModels.js";
import { utilityVideoModelOptions } from "../src/modelOptions.js";

test("square source keeps its full composition centered in the tested 9:16 canvas", () => {
  const plan = planVideoOutpaint({ width: 1440, height: 1440, fps: 24, duration: 4.041667 });
  assert.deepEqual([plan.width, plan.height, plan.sourceWidth, plan.sourceHeight, plan.left, plan.top], [432, 768, 432, 432, 0, 168]);
  assert.equal(plan.frames, 81); assert.equal(plan.duration, 3.375);
  assert.deepEqual([plan.outputWidth, plan.outputHeight], [1080, 1920]);
});
test("landscape footage is fitted without a crop and short sources fail before paid work", () => {
  const plan = planVideoOutpaint({ width: 1920, height: 1080, fps: 24, duration: 5 });
  assert.equal(plan.sourceWidth, 432); assert.equal(plan.sourceHeight, 242);
  assert.ok(Math.abs(plan.sourceWidth / plan.sourceHeight - 16 / 9) < 0.01);
  assert.equal(planVideoOutpaint({ width: 1080, height: 1920, duration: 5 }).needsOutpaint, false);
  assert.throws(() => planVideoOutpaint({ width: 1440, height: 1440, fps: 24, duration: 2 }), /segment must contain/);
  assert.throws(() => planVideoOutpaint({ width: 1440, height: 1440, fps: 24, duration: 4 }, { start: 2 }), /segment must contain/);
  assert.deepEqual(normalizeVideoOutpaintSettings(null), normalizeVideoOutpaintSettings());
});
test("framing signatures invalidate prepared assets when source or settings change", () => {
  const key = videoOutpaintFingerprint("/outputs/a.mp4", {});
  assert.notEqual(key, videoOutpaintFingerprint("/outputs/b.mp4", {}));
  assert.notEqual(key, videoOutpaintFingerprint("/outputs/a.mp4", { aspectRatio: "16:9" }));
});
test("request and result preserve refinements, cost, raw result and partial-success warning", () => {
  assert.ok(utilityVideoModelOptions.includes("Video Outpaint"));
  const request = buildUtilityVideoRequest({ node: { id: "n", data: { videoOutpaint: { feather: 12, restoreSource: false }, seed: "12345" } }, model: "Video Outpaint", prompt: "Complete the person", referenceVideoUrls: ["/outputs/source.mp4"] });
  assert.equal(request.videoOutpaint.feather, 12); assert.equal(request.videoOutpaint.restoreSource, false);
  assert.equal(request.wanVaceInpainting.seed, "12345");
  const details = { rawVideoUrl: "/outputs/raw.mp4" };
  const result = normalizeUtilityVideoGenerationResult({ video: { localUrl: "/outputs/final.mp4" }, videoOutpaint: details, warning: "Raw result kept", cost: { amountUsd: 0.405 } }, 0);
  assert.equal(result.videoOutpaint.rawVideoUrl, details.rawVideoUrl); assert.equal(result.warning, "Raw result kept"); assert.equal(result.cost.amountUsd, 0.405);
});

function serviceHarness({ generatedDuration = 3.375 } = {}) {
  const calls = [], targets = [];
  const service = createVideoOutpaintService({
    resolveAsset: async url => ({ filePath: url }),
    probeVideo: async file => file.includes("generated") ? { width: 720, height: 1280, duration: generatedDuration } : { width: 1440, height: 1440, fps: 24, duration: 4.041667 },
    createTarget: async (body, kind, ext, dependency) => { const result = { filePath: `/managed/${kind}${ext}`, publicPath: `/outputs/${kind}${ext}`, fileName: kind + ext }; targets.push({ ...result, dependency }); return result; },
    runFfmpeg: async (args, label) => { calls.push({ args, label }); }, statFile: async () => ({ size: 100 })
  });
  return { service, calls, targets };
}
test("preparation creates a matching source/mask and preview without calling generation", async () => {
  const { service, calls, targets } = serviceHarness();
  const prepared = await service.prepare({}, "/outputs/source.mp4");
  assert.equal(calls.length, 3); assert.ok(targets.every(t => t.dependency));
  assert.match(calls[0].args.join(" "), /pad=432:768:0:168:black/);
  assert.match(calls[1].args.join(" "), /drawbox=x=0:y=168:w=432:h=432:color=black/);
  assert.equal(prepared.fingerprint, videoOutpaintFingerprint("/outputs/source.mp4", {}));
});
test("finishing restores original source, maps optional audio and retains raw on timing mismatch", async () => {
  const { service, calls } = serviceHarness(); const prepared = await service.prepare({}, "/outputs/source.mp4");
  const finished = await service.finish({}, prepared, { filePath: "/outputs/generated.mp4" });
  assert.equal(finished.bytes, 100);
  assert.match(calls.at(-1).args.join(" "), /overlay=0:420:shortest=1/);
  assert.ok(calls.at(-1).args.includes("1:a?"));
  assert.ok(calls.at(-1).args.includes("/outputs/source.mp4"));
  const mismatch = serviceHarness({ generatedDuration: 5 });
  await assert.rejects(mismatch.service.finish({}, prepared, { filePath: "/outputs/generated.mp4" }), /timing differs/);
  assert.equal(mismatch.calls.length, 0);
});
