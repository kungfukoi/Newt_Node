import test from "node:test";
import assert from "node:assert/strict";
import { lastOutpaintPreparation, preparedOutpaintSettings } from "../src/outpaintPreparation.js";
import { planVideoOutpaint, normalizeUtilityOutpaintSettings } from "../src/videoOutpaint.js";
import { createVideoOutpaintService } from "../server/video-outpaint.js";

const settings = { model: "seedance-2.5", seedanceResolution: "480p" };
const cached = { sourceUrl: "/source", videoUrl: "/canvas", generationVideoUrl: "/generation", maskImageUrl: "/mask", plan: planVideoOutpaint({ width: 640, height: 360, fps: 24, frames: 48, duration: 2 }, settings) };
const service = overrides => createVideoOutpaintService({ resolveAsset: async filePath => ({ filePath }), statFile: async () => ({ size: 100 }), probeVideo: async () => { throw new Error("Fresh preparation reached"); }, createTarget: () => assert.fail("Must reuse canvas files"), runFfmpeg: () => assert.fail("Must not regenerate canvas"), ...overrides });

test("saved canvas is reused across runs and pending canvas edits while current reference roles apply", async () => {
  const body = { videoOutpaintPrepared: cached, videoOutpaint: { ...settings, start: 1, repeatCount: 2, seedanceResolution: "1080p", feather: 64, referenceRoles: ["environment"] } };
  for (let run = 0; run < 2; run++) {
    const result = await service().prepare(body, "/source");
    assert.equal(result.videoUrl, cached.videoUrl);
    assert.equal(result.generationVideoUrl, cached.generationVideoUrl);
    assert.equal(result.plan.outputFrames, cached.plan.outputFrames);
    assert.equal(result.plan.settings.seedanceResolution, "480p");
    assert.equal(result.plan.settings.feather, 32);
    assert.equal(result.plan.settings.start, 0);
    assert.deepEqual(result.plan.settings.referenceRoles, ["environment"]);
  }
  assert.deepEqual(cached.plan.settings.referenceRoles, []);
});

test("explicit preparation rebuilds; missing assets and changed source or model never silently rebuild", async () => {
  const body = { videoOutpaintPrepared: cached, videoOutpaint: settings };
  await assert.rejects(service().prepare({ ...body, forcePrepareOutpaint: true }, "/source"), /Fresh preparation reached/);
  await assert.rejects(service().prepare(body, "/different"), /Source changed/);
  await assert.rejects(service().prepare({ ...body, videoOutpaint: { model: "wan-vace" } }, "/source"), /model changed/);
  await assert.rejects(service({ statFile: async () => { throw Error("missing"); } }).prepare(body, "/source"), /missing or unreadable/);
});

test("legacy results supply the last canvas and explicit preparation takes precedence", () => {
  const old = { ...cached, videoUrl: "/old" };
  assert.equal(lastOutpaintPreparation({ resultItems: [{ videoOutpaint: { prepared: old } }, { videoOutpaint: { prepared: cached } }] }), cached);
  assert.equal(lastOutpaintPreparation({ videoOutpaintPrepared: old, resultItems: [{ videoOutpaint: { prepared: cached } }] }), old);
  const restored = JSON.parse(JSON.stringify({ videoOutpaintPrepared: cached }));
  assert.equal(lastOutpaintPreparation(restored).videoUrl, "/canvas");
  assert.equal(normalizeUtilityOutpaintSettings().restoreSource, true);
  assert.equal(normalizeUtilityOutpaintSettings().matchExtensionColor, true);
  assert.equal(preparedOutpaintSettings(cached, { ...settings, matchExtensionColor: false }).matchExtensionColor, false);
});
