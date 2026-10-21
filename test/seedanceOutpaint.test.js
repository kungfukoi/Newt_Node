import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVideoOutpaintSettings, planVideoOutpaint, videoOutpaintFingerprint, seedanceOutpaintRequest, seedanceOutpaintPrompt } from "../src/videoOutpaint.js";
import { prepareSeedanceOutpaint, finishSeedanceOutpaint } from "../server/seedance-outpaint.js";
import { buildOutpaintAnalysisPrompt } from "../src/videoOutpaintPrompt.js";
import { recoveredVideoPatches } from "../src/remoteVideoRecovery.js";
import { normalizeUtilityVideoGenerationResult } from "../src/nodeRunners/videoModels.js";

const settings = { model: "seedance-2.5", seedanceResolution: "1080p" };
const prepared = { sourceUrl: "/outputs/source.mp4", videoUrl: "/outputs/padded.mp4", maskVideoUrl: "/outputs/mask.mp4", plan: planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 1.666667 }, settings) };
const body = seedanceOutpaintRequest({ prompt: "Continue the moving foliage", referenceVideoUrls: [prepared.sourceUrl], referenceImageUrls: ["/outputs/look.png"], videoOutpaint: settings, wanVaceInpainting: { seed: "42" }, projectId: "project", nodeId: "node" });

test("legacy workflows keep Wan and engine changes invalidate preparation", () => {
  assert.equal(normalizeVideoOutpaintSettings().model, "wan-vace");
  assert.notEqual(videoOutpaintFingerprint("source", {}), videoOutpaintFingerprint("source", settings));
  assert.equal(prepared.plan.frames, 96); assert.equal(prepared.plan.duration, 4);
  assert.equal(prepared.plan.loopFrames, 40); assert.equal(prepared.plan.looped, true);
  assert.equal(planVideoOutpaint({ width: 640, height: 360, fps: 16, duration: 2 }, settings).fps, 24);
});

test("one Seedance resolution controls generation and export dimensions, overriding old delivery settings", () => {
  for (const [resolution, width, height] of [["480p", 480, 854], ["720p", 720, 1280], ["1080p", 1080, 1920]]) {
    const plan = planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 4 }, { model: "seedance-2.5", seedanceResolution: resolution, outputSize: "1080p" });
    assert.equal(plan.settings.seedanceResolution, resolution); assert.equal(plan.settings.outputSize, resolution);
    assert.deepEqual([plan.outputWidth, plan.outputHeight], [width, height]);
  }
  assert.equal(normalizeVideoOutpaintSettings({ model: "seedance-2.5", seedanceResolution: "auto" }).outputSize, "720p");
});

test("Seedance editing submits only the padded source with explicit border extrapolation and keeps workflow context", async () => {
  for (const provider of ["fal", "atlas"]) {
    const result = await prepareSeedanceOutpaint(body, { provider, apiKey: "test-fixture", prepare: async (request, url) => { assert.equal(request, body); assert.equal(url, prepared.sourceUrl); return prepared; } });
    assert.deepEqual(result.body.referenceVideoUrls, [prepared.videoUrl]);
    assert.deepEqual(result.body.referenceImageUrls, body.referenceImageUrls);
    assert.equal(result.body.seedanceTask, "edit"); assert.equal(result.body.seedanceDraft, false);
    assert.equal(result.body.resolution, "1080p"); assert.equal(result.body.duration, "auto"); assert.equal(result.body.aspectRatio, "auto");
    assert.equal(result.body.generateAudio, false); assert.equal(result.body.seed, undefined);
    assert.equal(result.body.projectId, "project"); assert.equal(result.body.nodeId, "node");
    assert.equal(result.body.videoOutpaintContext, prepared);
    assert.match(result.body.prompt, /solid black padded expansion/); assert.match(result.body.prompt, /context clues/); assert.match(result.body.prompt, /parallax/);
    assert.match(result.body.prompt, /Continue the moving foliage/); assert.doesNotMatch(result.body.prompt, /mask/);
    assert.equal(result.body.outpaintUserPrompt, body.prompt);
  }
});

test("unsupported providers, missing keys, missing sources and blank prompts reject before generation", async () => {
  const deps = { provider: "fal", apiKey: "test-fixture", prepare: async () => prepared };
  for (const [patch, dependencies, error] of [
    [{}, { provider: "krea" }, /supports Fal or Atlas/], [{}, { apiKey: "" }, /selected Fal/],
    [{ prompt: "" }, {}, /Enter or draft/], [{ referenceVideoUrls: [] }, {}, /exactly one/],
    [{ model: "Other" }, {}, /requires the Seedance/]
  ]) await assert.rejects(prepareSeedanceOutpaint({ ...body, ...patch }, { ...deps, ...dependencies }), error);
  const crop = await prepareSeedanceOutpaint({ ...body, prompt: "" }, { ...deps, provider: "krea", apiKey: "", prepare: async () => ({ ...prepared, plan: { ...prepared.plan, needsOutpaint: false } }) });
  assert.equal(crop.prepared.plan.needsOutpaint, false);
});

test("analysis uses the same visual context and mask reasoning but writes for Seedance's unmasked edit input", () => {
  const wan = buildOutpaintAnalysisPrompt({ mode: "guided" });
  const seedance = buildOutpaintAnalysisPrompt({ mode: "guided", outpaintModel: "seedance-2.5", guidance: "Continue the trees" });
  assert.match(wan, /white pixels request generation/); assert.match(seedance, /white pixels request generation/);
  assert.match(seedance, /extrapolate from visible context clues/); assert.match(seedance, /NOT the analysis mask/);
  assert.match(seedance, /Continue the trees/); assert.match(seedanceOutpaintPrompt("Manual direction"), /Manual direction/);
});

test("finishing preserves raw paid output on failure and records model and restoration metadata", async () => {
  const raw = { filePath: "/raw.mp4", publicPath: "/outputs/raw.mp4" }, native = { width: 432, height: 768, duration: 4 };
  const success = await finishSeedanceOutpaint(body, prepared, raw, native, { finish: async () => ({ filePath: "/finished.mp4" }), probeVideo: async () => ({ width: 1080, height: 1920, duration: 4 }) });
  assert.equal(success.details.rawVideoUrl, raw.publicPath); assert.equal(success.details.model, "seedance-2.5"); assert.equal(success.details.restoredSource, true);
  const failure = await finishSeedanceOutpaint(body, prepared, raw, native, { finish: async () => { throw new Error("Timing mismatch"); }, probeVideo: () => assert.fail("must retain raw") });
  assert.equal(failure.output, raw); assert.equal(failure.video, native); assert.equal(failure.details.restoredSource, false); assert.match(failure.warning, /paid raw result was preserved/);
});

test("completed Seedance outpaints recover into Utility and connected Output without duplication", () => {
  const result = { generationRunId: "run", video: { localUrl: "/outputs/final.mp4" }, videoOutpaint: { rawVideoUrl: "/outputs/raw.mp4" } };
  const nodes = [{ id: "node", type: "utility", data: { utilityMode: "video", utilityVideoModel: "Video Outpaint", resultItems: [] } }, { id: "output", type: "output", data: {} }];
  const job = { runId: "run", nodeId: "node", groupId: "group", state: "completed", batchIndex: 1, createdAt: "2026-10-20", result, outputTargetNodeId: "output" };
  const patches = recoveredVideoPatches(nodes, [job], new Set(), [{ from: { nodeId: "node" }, to: { nodeId: "output" } }]);
  assert.equal(patches.length, 2); assert.equal(patches[0].patch.resultItems[0].videoOutpaint.rawVideoUrl, result.videoOutpaint.rawVideoUrl);
  assert.equal(normalizeUtilityVideoGenerationResult(result, 0).generationRunId, "run");
  assert.deepEqual(recoveredVideoPatches([{ ...nodes[0], data: { ...nodes[0].data, ...patches[0].patch } }], [job]), []);
});
