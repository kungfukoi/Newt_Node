import test from "node:test";
import assert from "node:assert/strict";
import { fitOutpaintColor, overlapError, matchingGeometry, inspectOutpaint } from "../server/outpaint-matching.js";
import { registerVideoOutpaintFinishRoute } from "../server/routes/videoOutpaintFinish.js";
import { normalizeVideoOutpaintSettings } from "../src/videoOutpaint.js";

const plan = { width: 192, height: 192, left: 0, top: 48, sourceWidth: 192, sourceHeight: 96, fps: 24, frames: 12, duration: 0.5 };
const g = matchingGeometry(plan);
function pixels(frames, fn) {
  const data = Buffer.alloc(g.stride * frames);
  for (let f = 0; f < frames; f++) for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) for (let c = 0; c < 3; c++) data[f * g.stride + (y * g.width + x) * 3 + c] = fn(f, x, y, c);
  return data;
}
test("bounded overlap fit removes a color cast without applying an unsafe correction", () => {
  const original = pixels(12, (_f, x, _y, c) => 50 + x / 2 + c * 10);
  const generated = Buffer.from(original.map(v => v + 16));
  const fit = fitOutpaintColor(original, generated, g, 12);
  assert.equal(fit.applied, true);
  assert.ok(overlapError(original, generated, g, 12, fit.channels) < 1);
  assert.ok(overlapError(original, generated, g, 12) > 15);
  const unrelated = pixels(12, (_f, x, _y, c) => 240 - x / 2 - c * 10);
  const unsafe = fitOutpaintColor(original, unrelated, g, 12);
  assert.equal(unsafe.applied, false);
  assert.deepEqual(unsafe.channels, [{ gain: 1, offset: 0 }, { gain: 1, offset: 0 }, { gain: 1, offset: 0 }]);
  const contrastChanged = pixels(12, (_f, x, _y, c) => (50 + x / 2 + c * 10) / 0.85);
  assert.equal(fitOutpaintColor(original, contrastChanged, g, 12).applied, false, "A correlated fit at the old darkening clamp must be withheld");
});
test("every-frame QC identifies a matte edge and short held tail, without claiming visual perfection", () => {
  const original = pixels(12, () => 100), raw = Buffer.from(original);
  const final = pixels(12, (_f, _x, y) => y >= 48 && y < 144 ? 100 : 140);
  const fit = { requested: false, ...fitOutpaintColor(original, raw, g, 12) };
  const report = inspectOutpaint(original, raw, final, g, 12, plan, { duration: 0.375 }, fit);
  assert.equal(report.status, "needs_review"); assert.equal(report.framesChecked, 12); assert.equal(report.missingFrames, 3);
  assert.ok(report.flags.some(s => /boundary/i.test(s))); assert.ok(report.segments.some(s => s.reason === "Held generated tail"));
  assert.match(report.scope, /not a guarantee/);
  const clean = inspectOutpaint(original, raw, original, g, 12, plan, { duration: 0.5 }, fit);
  assert.equal(clean.status, "passed_checks");
});
test("QC finds a content timing offset and flags a frozen generated overlap", () => {
  const original = pixels(12, f => 60 + f * 10), raw = pixels(12, f => 60 + Math.max(0, f - 2) * 10);
  const fit = { requested: false, applied: false, channels: [{ gain: 1, offset: 0 }, { gain: 1, offset: 0 }, { gain: 1, offset: 0 }] };
  const timing = inspectOutpaint(original, raw, original, g, 12, plan, { duration: 0.5 }, fit);
  assert.equal(timing.suggestedOffsetFrames, 2); assert.ok(timing.flags.some(s => /timing offset/.test(s)));
  const frozen = inspectOutpaint(original, pixels(12, () => 60), original, g, 12, plan, { duration: 0.5 }, fit);
  assert.ok(frozen.flags.some(s => /freezes/.test(s)));
});
test("saved explicit feather survives; saved matching controls survive while QC stays disabled, blend is bounded", () => {
  assert.equal(normalizeVideoOutpaintSettings({ feather: 8 }).feather, 8);
  assert.equal(normalizeVideoOutpaintSettings().feather, 32);
  assert.equal(normalizeVideoOutpaintSettings().autoMatch, true);
  assert.equal(normalizeVideoOutpaintSettings({ feather: 500 }).feather, 128);
  assert.equal(normalizeVideoOutpaintSettings({ finalQc: true, visualQc: true }).finalQc, false);
  assert.equal(normalizeVideoOutpaintSettings({ finalQc: true, visualQc: true }).visualQc, false);
});
test("local reprocessing rebuilds the original geometry, preserves raw and records zero new provider cost", async () => {
  let handler, preparation, history, preparationTiming;
  const previous = { sourceUrl: "/outputs/source.mp4", plan: { frames: 201, prerollFrames: 94, outputFrames: 94, outputDuration: 94 * 1001 / 24000, sourceFps: 24000 / 1001, sourceFrameRate: "24000/1001", sourceStartSeconds: 0, settings: { frame: { x: 0, y: -0.5, width: 1 }, model: "seedance-2.5", duration: 4 } } };
  registerVideoOutpaintFinishRoute({ post: (_route, fn) => { handler = fn; } }, {
    isLocalAssetUrl: s => typeof s === "string" && s.startsWith("/outputs/"),
    service: { prepare: async (body, _source, timing) => { preparation = body; preparationTiming = timing; return { ...previous, plan: { settings: body.videoOutpaint } }; }, finish: async () => ({ filePath: "final.mp4", publicPath: "/outputs/final.mp4", fileName: "final.mp4", bytes: 100, qc: { status: "needs_review" }, warning: "Needs review" }) },
    resolveAsset: async () => ({ filePath: "raw.mp4" }), probeVideo: async () => ({ width: 720, height: 1280, duration: 4 }), appendHistory: async record => { history = record; }, projectFromBody: () => ({}), nodeFromBody: () => ({})
  });
  let result;
  await handler({ body: { rawVideoUrl: "/outputs/raw.mp4", prepared: previous, videoOutpaint: { frame: { x: 7 }, model: "wan-vace", feather: 64 } } }, { json: item => { result = item; } });
  assert.deepEqual(preparation.videoOutpaint.frame, previous.plan.settings.frame); assert.equal(preparation.videoOutpaint.model, "seedance-2.5"); assert.equal(preparation.videoOutpaint.feather, 64);
  assert.deepEqual(preparationTiming, { prerollFrames: 94, frames: 201, outputFrames: 94, outputDuration: previous.plan.outputDuration, sourceFps: 24000 / 1001, sourceFrameRate: "24000/1001", sourceStartSeconds: 0 }, "Existing raw generations must keep their original counts and clocks");
  assert.equal(result.cost.amountUsd, 0); assert.equal(history.provider, "local"); assert.equal(history.videoOutpaint.rawVideoUrl, "/outputs/raw.mp4"); assert.equal(result.videoOutpaint.qc.status, "needs_review");
});
