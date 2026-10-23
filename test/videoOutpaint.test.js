import test from "node:test";
import assert from "node:assert/strict";
import { planVideoOutpaint, normalizeVideoOutpaintSettings, videoOutpaintFingerprint } from "../src/videoOutpaint.js";
import { createVideoOutpaintService } from "../server/video-outpaint.js";
import { buildUtilityVideoRequest, normalizeUtilityVideoGenerationResult } from "../src/nodeRunners/videoModels.js";
import { utilityVideoModelOptions } from "../src/modelOptions.js";

test("square source keeps its full composition centered in the tested 9:16 canvas", () => {
  const plan = planVideoOutpaint({ width: 1440, height: 1440, fps: 24, duration: 4.041667 });
  assert.deepEqual([plan.width, plan.height, plan.sourceWidth, plan.sourceHeight, plan.left, plan.top], [720, 1280, 720, 720, 0, 280]);
  assert.equal(plan.frames, 81); assert.equal(plan.duration, 3.375);
  assert.deepEqual([plan.outputWidth, plan.outputHeight], [1080, 1920]);
});
test("landscape footage is fitted without a crop and short sources loop at normal speed", () => {
  const plan = planVideoOutpaint({ width: 1920, height: 1080, fps: 24, duration: 5 });
  assert.equal(plan.sourceWidth, 720); assert.equal(plan.sourceHeight, 404);
  assert.ok(Math.abs(plan.sourceWidth / plan.sourceHeight - 16 / 9) < 0.01);
  assert.equal(planVideoOutpaint({ width: 1080, height: 1920, duration: 5 }).needsOutpaint, false);
  const short = planVideoOutpaint({ width: 1440, height: 1440, fps: 24, duration: 1.666667 });
  assert.equal(short.looped, true); assert.equal(short.loopFrames, 40);
  assert.equal(short.frames, 81); assert.equal(short.duration, 3.375); assert.equal(short.fps, 24);
  const offset = planVideoOutpaint({ width: 1440, height: 1440, fps: 24, duration: 4 }, { start: 2 });
  assert.equal(offset.looped, true); assert.equal(offset.loopFrames, 48);
  assert.equal(plan.looped, false);
  assert.equal(planVideoOutpaint({ width: 64, height: 64, fps: 16, duration: 1 }).frames, 81);
  assert.throws(() => planVideoOutpaint({ width: 64, height: 64, fps: 24, duration: 2 }, { start: 2 }), /source frame/);
  assert.deepEqual(normalizeVideoOutpaintSettings(null), normalizeVideoOutpaintSettings());
});
test("framing signatures invalidate prepared assets when source or settings change", () => {
  const key = videoOutpaintFingerprint("/outputs/a.mp4", {});
  assert.notEqual(key, videoOutpaintFingerprint("/outputs/b.mp4", {}));
  assert.notEqual(key, videoOutpaintFingerprint("/outputs/a.mp4", { aspectRatio: "16:9" }));
});

test("Seedance repeats select the final shot without changing delivery timing", () => {
  const metadata = { width: 1920, height: 1080, fps: 24, duration: 8 };
  const options = { model: "seedance-2.5", duration: 3.375 };
  const single = planVideoOutpaint(metadata, options);
  const repeated = planVideoOutpaint(metadata, { ...options, repeatCount: 3 });
  assert.equal(single.settings.repeatCount, 1);
  assert.equal(repeated.prerollFrames, 162);
  assert.equal(repeated.outputFrames, 81);
  assert.equal(repeated.outputDuration, single.outputDuration);
  assert.ok(repeated.frames >= 3 * 81 + 12);
  assert.equal((repeated.frames - 1) % 8, 0);
  assert.notEqual(videoOutpaintFingerprint("source", options), videoOutpaintFingerprint("source", { ...options, repeatCount: 2 }));
  assert.throws(() => planVideoOutpaint(metadata, { ...options, duration: 8, repeatCount: 4 }), /30-second/);
  assert.equal(normalizeVideoOutpaintSettings({ ...options, repeatCount: 0 }).repeatCount, 1);
  assert.equal(normalizeVideoOutpaintSettings({ ...options, repeatCount: "2" }).repeatCount, 2);
  assert.equal(normalizeVideoOutpaintSettings({ model: "wan-vace", repeatCount: 4 }).repeatCount, 1);
});

test("Seedance preparation repeats moving frames before its held guard tail", async () => {
  const { service, calls } = serviceHarness();
  const prepared = await service.prepare({ videoOutpaint: { model: "seedance-2.5", repeatCount: 2 } }, "/outputs/source.mp4");
  assert.equal(prepared.plan.prerollFrames, prepared.plan.outputFrames);
  const filter = calls[0].args[calls[0].args.indexOf("-vf") + 1];
  assert.match(filter, /trim=end_frame=81,setpts=PTS-STARTPTS,loop=loop=1:size=81:start=0,setpts=N\/\(24\*TB\)/);
  assert.match(filter, /start_duration=0:/);
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

function serviceHarness({ generatedDuration = 3.375, reviewVisual } = {}) {
  const calls = [], targets = [];
  const service = createVideoOutpaintService({
    resolveAsset: async url => ({ filePath: url }),
    probeVideo: async file => file.includes("generated") ? { width: 720, height: 1280, duration: generatedDuration } : { width: 1440, height: 1440, fps: 24, duration: 4.041667 },
    createTarget: async (body, kind, ext, dependency) => { const result = { filePath: `/managed/${kind}${ext}`, publicPath: `/outputs/${kind}${ext}`, fileName: kind + ext }; targets.push({ ...result, dependency }); return result; },
    runFfmpeg: async (args, label) => { calls.push({ args, label }); }, statFile: async () => ({ size: 100 }), reviewVisual
  });
  return { service, calls, targets };
}
test("preparation creates a matching source/mask and preview without calling generation", async () => {
  const { service, calls, targets } = serviceHarness();
  const prepared = await service.prepare({}, "/outputs/source.mp4");
  assert.equal(calls.length, 5); assert.ok(targets.every(t => t.dependency));
  assert.match(calls[0].args.join(" "), /pad=720:1280:0:280:black/);
  assert.match(calls[1].args.join(" "), /drawbox=x=0:y=302:w=720:h=676:color=black/);
  assert.equal(prepared.fingerprint, videoOutpaintFingerprint("/outputs/source.mp4", {}));
});

test("Seedance gray preparation covers the outer bands and authorized inward overlap", async () => {
  const { service, calls } = serviceHarness();
  const prepared = await service.prepare({ videoOutpaint: { model: "seedance-2.5", seedanceResolution: "480p", feather: 32 } }, "/outputs/source.mp4");
  assert.equal(prepared.plan.generationPaddingColor, "gray");
  assert.ok(prepared.plan.generationContentRect.y > prepared.plan.top);
  assert.ok(prepared.plan.generationContentRect.height < prepared.plan.sourceHeight);
  const conditioning = calls.find(call => call.label === "Prepare Seedance gray padding and inward overlap");
  const filter = conditioning.args[conditioning.args.indexOf("-vf") + 1];
  assert.match(filter, /color=0x7f7f7f:t=fill/);
  assert.match(filter, new RegExp(`drawbox=x=0:y=0:w=${prepared.plan.width}:h=${prepared.plan.generationContentRect.y}`));
  assert.doesNotMatch(filter, /color=black/);
});

test("reprocessing preserves historical leading holds and frame counts", async () => {
  const { service, calls } = serviceHarness();
  const prepared = await service.prepare({ videoOutpaint: { model: "seedance-2.5" } }, "/outputs/source.mp4", { prerollFrames: 24, frames: 117 });
  assert.equal(prepared.plan.prerollFrames, 24); assert.equal(prepared.plan.frames, 117);
  assert.match(calls[0].args.join(" "), /start_duration=1:/);
  assert.equal(prepared.plan.duration, 117 / 24);
});
test("finishing restores original source, maps optional audio and retains raw on timing mismatch", async () => {
  const { service, calls } = serviceHarness(); const prepared = await service.prepare({}, "/outputs/source.mp4");
  const finished = await service.finish({}, prepared, { filePath: "/outputs/generated.mp4" });
  assert.equal(finished.bytes, 100);
  assert.match(calls.at(-1).args.join(" "), /overlay=0:420:shortest=1/);
  assert.ok(calls.at(-1).args.includes("1:a?"));
  assert.ok(calls.at(-1).args.includes("/outputs/source.mp4"));
  const mismatch = serviceHarness({ generatedDuration: 5 });
  await assert.rejects(mismatch.service.finish({}, prepared, { filePath: "/outputs/generated.mp4" }), /timing does not cover/);
  assert.equal(mismatch.calls.length, 0);
});

test("QC stays disabled even for saved enabled settings, with one inward blend and no paid review", async () => {
  let reviews = 0;
  const { service } = serviceHarness({ reviewVisual: async () => { reviews++; throw new Error("Provider unavailable"); } });
  const prepared = await service.prepare({ videoOutpaint: { finalQc: true, visualQc: true } }, "/outputs/source.mp4");
  const result = await service.finish({}, prepared, { filePath: "/outputs/generated.mp4" });
  assert.equal(reviews, 0); assert.equal(result.publicPath, "/outputs/video-outpaint.mov");
  assert.equal(result.qc.status, "off"); assert.equal(result.warning, "");
  assert.equal(result.matching.finishVersion, 3);
  assert.match(result.matching.sourcePolicy, /fully opaque/);
});
