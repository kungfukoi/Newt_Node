import test from "node:test";
import assert from "node:assert/strict";
import { outpaintFrameOneRule } from "../src/outpaintFrameOne.js";
import { normalizeVideoOutpaintSettings, normalizeUtilityOutpaintSettings, videoOutpaintModels, planVideoOutpaint, videoOutpaintFingerprint, seedanceOutpaintRequest, seedanceOutpaintPrompt } from "../src/videoOutpaint.js";
import { prepareSeedanceOutpaint, finishSeedanceOutpaint } from "../server/seedance-outpaint.js";
import { buildOutpaintAnalysisPrompt } from "../src/videoOutpaintPrompt.js";
import { recoveredVideoPatches } from "../src/remoteVideoRecovery.js";
import { normalizeUtilityVideoGenerationResult } from "../src/nodeRunners/videoModels.js";

const settings = { model: "seedance-2.5", seedanceResolution: "1080p" };
const prepared = { sourceUrl: "/outputs/source.mp4", videoUrl: "/outputs/padded.mp4", maskVideoUrl: "/outputs/mask.mp4", plan: planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 1.666667 }, settings) };
const body = seedanceOutpaintRequest({ prompt: "Continue the moving foliage", referenceVideoUrls: [prepared.sourceUrl], referenceImageUrls: ["/outputs/look.png"], videoOutpaint: settings, wanVaceInpainting: { seed: "42" }, projectId: "project", nodeId: "node" });

test("Seedance gray conditioning and analysis name RGB 127 padding while legacy plans keep black wording", async () => {
  const gray = { ...prepared, generationVideoUrl: "/outputs/gray.mp4", plan: { ...prepared.plan, generationPaddingColor: "gray" } };
  const result = await prepareSeedanceOutpaint(body, { provider: "fal", apiKey: "fixture", prepare: async () => gray });
  assert.deepEqual(result.body.referenceVideoUrls, [gray.generationVideoUrl]);
  assert.match(result.body.prompt, /Replace all gray padding/);
  assert.match(result.body.prompt, /#7F7F7F \/ RGB 127, 127, 127/);
  assert.match(result.body.prompt, /real gray objects inside the source picture/);
  assert.match(result.body.prompt, /Gray padding identifies input pixels/);
  assert.doesNotMatch(result.body.prompt, /black padding|black-padded|black bands/);
  const analysis = buildOutpaintAnalysisPrompt({ mode: "guided", outpaintModel: "seedance-2.5", maskIsImage: true, preparedPlan: gray.plan });
  assert.match(analysis, /solid gray padding \(#7F7F7F/);
  assert.doesNotMatch(analysis, /solid black padding|black-padded/);
  assert.match(seedanceOutpaintPrompt("Direction", false, [], 0, prepared.plan), /Replace all black padding/);
  const oldFingerprint = JSON.stringify(["outpaint-canvas-v14-frame-grid", "source", normalizeVideoOutpaintSettings(settings), ""]);
  assert.notEqual(videoOutpaintFingerprint("source", settings), oldFingerprint);
  assert.equal(JSON.parse(videoOutpaintFingerprint("source", { model: "wan-vace" }))[0], "outpaint-canvas-v14-frame-grid");
});

test("legacy preparation timing remains readable and engine changes invalidate preparation", () => {
  assert.equal(normalizeVideoOutpaintSettings().model, "wan-vace");
  assert.notEqual(videoOutpaintFingerprint("source", {}), videoOutpaintFingerprint("source", settings));
  assert.equal(prepared.plan.frames, 97); assert.equal(prepared.plan.duration, 97 / 24);
  assert.equal(prepared.plan.outputFrames, 40); assert.equal(prepared.plan.looped, false); assert.equal(prepared.plan.tailPadded, true);
  assert.equal(planVideoOutpaint({ width: 640, height: 360, fps: 16, duration: 2 }, settings).fps, 24);
});

test("Utility defaults to Seedance and preserves selectable Wan settings and old results", () => {
  assert.deepEqual(videoOutpaintModels, [["seedance-2.5", "Seedance Edit"], ["wan-vace", "Wan VACE 14B"]]);
  assert.equal(normalizeUtilityOutpaintSettings().model, "seedance-2.5");
  const old = { model: "wan-vace", frame: { x: 0, y: -0.2, width: 1 }, feather: 48 };
  const current = normalizeUtilityOutpaintSettings(old);
  assert.equal(current.model, "wan-vace"); assert.equal(current.feather, 48);
  assert.deepEqual(current.frame, old.frame); assert.equal(old.model, "wan-vace");
  const raw = { videoOutpaint: { rawVideoUrl: "/old.mp4", prepared: { sourceUrl: "/source.mp4", plan: { settings: old } } } };
  assert.equal(normalizeVideoOutpaintSettings(raw.videoOutpaint.prepared.plan.settings).model, "wan-vace");
});

test("Seedance pads only its submission and delivers the real selected source duration", () => {
  const full = planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 4 }, { ...settings, duration: 4 });
  assert.equal(full.outputFrames, 96); assert.equal(full.outputDuration, 4);
  assert.equal(full.frames, 113); assert.equal(full.duration, 113 / 24); assert.equal(full.prerollFrames, 0);
  assert.equal(full.looped, false);
  const selected = planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 4 }, { ...settings, duration: 1.25 });
  assert.equal(selected.outputFrames, 30); assert.equal(selected.frames, 97);
  for (const fps of [24, 25, 30, 60]) for (const duration of [0.25, 1.25, 3.375, 4, 8]) {
    const p = planVideoOutpaint({ width: 640, height: 360, fps, duration }, { ...settings, duration });
    assert.equal((p.frames - 1) % 8, 0);
    assert.ok(p.frames >= p.outputFrames + Math.ceil(fps / 2));
    assert.equal(p.outputFrames, Math.floor((duration + 0.001) * fps));
  }
});

test("one Seedance resolution controls generation and export dimensions, overriding old delivery settings", () => {
  for (const [resolution, width, height] of [["480p", 480, 854], ["720p", 720, 1280], ["1080p", 1080, 1920]]) {
    const plan = planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 4 }, { model: "seedance-2.5", seedanceResolution: resolution, outputSize: "1080p" });
    assert.equal(plan.settings.seedanceResolution, resolution); assert.equal(plan.settings.outputSize, resolution);
    assert.deepEqual([plan.outputWidth, plan.outputHeight], [width, height]);
    assert.deepEqual([plan.width, plan.height], [width, height]);
  }
  assert.equal(normalizeVideoOutpaintSettings({ model: "seedance-2.5", seedanceResolution: "auto" }).outputSize, "1080p");
  assert.equal(planVideoOutpaint({ width: 1920, height: 1080, fps: 60, duration: 2 }, settings).fps, 60);
});

test("Seedance editing submits only the padded source with explicit border extrapolation and keeps workflow context", async () => {
  for (const provider of ["fal", "atlas", "krea"]) {
    const result = await prepareSeedanceOutpaint(body, { provider, apiKey: "test-fixture", prepare: async (request, url) => { assert.equal(request, body); assert.equal(url, prepared.sourceUrl); return prepared; } });
    assert.deepEqual(result.body.referenceVideoUrls, [prepared.videoUrl]);
    assert.deepEqual(result.body.referenceImageUrls, body.referenceImageUrls);
    assert.equal(result.body.seedanceTask, "edit"); assert.equal(result.body.seedanceDraft, false);
    assert.equal(result.body.resolution, "1080p"); assert.equal(result.body.duration, "auto"); assert.equal(result.body.aspectRatio, "auto");
    assert.equal(result.body.generateAudio, false); assert.equal(result.body.seed, undefined);
    assert.equal(result.body.projectId, "project"); assert.equal(result.body.nodeId, "node");
    assert.equal(result.body.videoOutpaintContext, prepared);
    assert.match(result.body.prompt, /Replace all black padding/); assert.match(result.body.prompt, /seamless continuation/); assert.match(result.body.prompt, /Preserve the existing picture/);
    assert.match(result.body.prompt, /Continue the moving foliage/); assert.doesNotMatch(result.body.prompt, /@Video2|@Image2/);
    assert.equal(result.body.outpaintUserPrompt, body.prompt);
    assert.match(result.body.prompt, /@Image1 is a visual reference\. APPEARANCE REFERENCE ONLY, NOT COMPOSITION/);
    assert.match(result.body.prompt, /FRAME 1 REQUIREMENT/);
    assert.match(result.body.prompt, /SAME-FRAME ATTACHMENT/);
    assert.match(result.body.prompt, /never a separately invented walking cycle/);
    assert.match(result.body.prompt, /Only the original scene action and camera motion continue/);
  }
});

test("unsupported providers, missing keys, missing sources and blank prompts reject before generation", async () => {
  const deps = { provider: "fal", apiKey: "test-fixture", prepare: async () => prepared };
  for (const [patch, dependencies, error] of [
    [{}, { provider: "google" }, /supports Fal, Atlas Cloud or Krea/], [{}, { apiKey: "" }, /selected Fal/],
    [{ prompt: "" }, {}, /Enter or draft/], [{ referenceVideoUrls: [] }, {}, /exactly one/],
    [{ model: "Other" }, {}, /requires the Seedance/]
  ]) await assert.rejects(prepareSeedanceOutpaint({ ...body, ...patch }, { ...deps, ...dependencies }), error);
  const crop = await prepareSeedanceOutpaint({ ...body, prompt: "" }, { ...deps, provider: "krea", apiKey: "", prepare: async () => ({ ...prepared, plan: { ...prepared.plan, needsOutpaint: false } }) });
  assert.equal(crop.prepared.plan.needsOutpaint, false);
});

test("Seedance receives the inward generation overlap canvas while finishing retains the full reference", async () => {
  const overlap = { ...prepared, generationVideoUrl: "/outputs/overlap.mp4", plan: { ...prepared.plan, generationContentRect: { x: 0, y: 700, width: 1080, height: 500 } } };
  const result = await prepareSeedanceOutpaint(body, { provider: "atlas", apiKey: "fixture", prepare: async () => overlap });
  assert.deepEqual(result.body.referenceVideoUrls, [overlap.generationVideoUrl]);
  assert.equal(result.body.videoOutpaintContext.videoUrl, prepared.videoUrl);
  assert.doesNotMatch(result.body.prompt, /inward overlap strip|PREPARED CANVAS|COMPOSITING OVERLAP/);
  assert.match(result.body.prompt, /starting at frame one/);
  assert.ok(Buffer.byteLength(result.body.prompt) < 3900);
  const longPrompt = "Long direction ".repeat(500);
  const fitted = await prepareSeedanceOutpaint({ ...body, prompt: longPrompt }, { provider: "atlas", apiKey: "fixture", prepare: async () => overlap });
  assert.ok(Buffer.byteLength(fitted.body.prompt) <= 3900);
  assert.equal(fitted.body.outpaintUserPrompt, longPrompt);
  assert.equal(fitted.body.outpaintPromptCompacted, true);
  assert.match(fitted.body.prompt, /Edit @Video1/);
});

test("Seedance edit never receives a preparation fill or mask video", async () => {
  const local = { ...prepared, maskImageUrl: "/outputs/local-matte.png", filledVideoUrl: "/outputs/old-wan-fill.mov" };
  const result = await prepareSeedanceOutpaint(body, { provider: "atlas", apiKey: "fixture", prepare: async () => local });
  assert.equal(result.body.seedanceTask, "edit");
  assert.deepEqual(result.body.referenceVideoUrls, [prepared.videoUrl]);
  assert.deepEqual(result.body.referenceImageUrls, body.referenceImageUrls);
  assert.doesNotMatch(result.body.prompt, /@Video2|already contains a complete masked/);
  assert.match(result.body.prompt, /seamless continuation/);
});

test("analysis uses the same visual context and mask reasoning but writes for Seedance's unmasked edit input", () => {
  const wan = buildOutpaintAnalysisPrompt({ mode: "guided" });
  const seedance = buildOutpaintAnalysisPrompt({ mode: "guided", outpaintModel: "seedance-2.5", guidance: "Continue the trees" });
  assert.match(wan, /white pixels request generation/); assert.match(seedance, /white pixels request generation/);
  assert.match(seedance, /extrapolate from visible context clues/); assert.match(seedance, /NOT the analysis mask/);
  assert.match(seedance, /Continue the trees/); assert.match(seedanceOutpaintPrompt("Manual direction"), /Manual direction/);
  const repair = seedanceOutpaintPrompt("User direction", true, [{ category: "seam", description: "Coat join is displaced" }]);
  assert.match(repair, /TECHNICAL QUALITY REPAIR/); assert.match(repair, /exact user framing and creative direction/); assert.match(repair, /User direction/); assert.ok(repair.endsWith(outpaintFrameOneRule));
  assert.match(repair, /Coat join is displaced/);
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
