import test from "node:test";
import assert from "node:assert/strict";
import { outpaintNeedsFinishing, outpaintOutputError, outpaintCanRegenerate, outpaintCanRefinish } from "../src/outpaintQuality.js";
import { recoveredVideoPatches } from "../src/remoteVideoRecovery.js";

test("cached raw can be matched locally before generation, only for the same source/framing", () => {
  const settings = { model: "seedance-2.5", frame: { x: 0, y: -0.3, width: 1 } };
  const item = { videoOutpaint: { rawVideoUrl: "/raw.mp4", prepared: { sourceUrl: "/source.mp4", plan: { settings } } } };
  assert.equal(outpaintCanRefinish(item, { ...settings, feather: 64 }, "/source.mp4"), true);
  assert.equal(outpaintCanRefinish(item, settings, "/different.mp4"), false);
  assert.equal(outpaintCanRefinish(item, { ...settings, frame: { x: 0, y: -0.5, width: 1 } }), false);
});

test("Output accepts a QC pass or a local crop, and blocks failed or unreviewed outpaints", () => {
  assert.equal(outpaintNeedsFinishing({ type: "video" }), false);
  assert.equal(outpaintNeedsFinishing({ videoOutpaint: { localCrop: true } }), false);
  assert.equal(outpaintNeedsFinishing({ videoOutpaint: { qc: { status: "passed_checks" } } }), false);
  assert.equal(outpaintNeedsFinishing({ videoOutpaint: { qc: { status: "off" }, matching: { finishVersion: 3 } } }), false);
  assert.equal(outpaintNeedsFinishing({ videoOutpaint: { qc: { status: "off" } } }), true);
  const rejected = { videoOutpaint: { qc: { status: "needs_review" } }, warning: "Seam repair exhausted" };
  assert.equal(outpaintNeedsFinishing(rejected), true); assert.equal(outpaintOutputError(rejected), "Seam repair exhausted");
  assert.equal(outpaintNeedsFinishing({ videoOutpaint: { rawVideoUrl: "/raw.mp4" } }), true);
});

test("QC never permits regeneration, including observed structural or timing defects", () => {
  assert.equal(outpaintCanRegenerate({ videoOutpaint: { qc: { visual: { status: "needs_review", issues: [{ category: "seam" }] } } } }), false);
  assert.equal(outpaintCanRegenerate({ videoOutpaint: { qc: { visual: { status: "needs_review", issues: [{ category: "geometry" }] } } } }), false);
  assert.equal(outpaintCanRegenerate({ videoOutpaint: { qc: { visual: { status: "needs_review", issues: [{ category: "uncertainty" }] } } } }), false);
  assert.equal(outpaintCanRegenerate({ videoOutpaint: { qc: { visual: { status: "needs_review", issues: [{ category: "geometry" }, { category: "uncertainty" }] } } } }), false);
  assert.equal(Boolean(outpaintCanRegenerate({ warning: "Visual QC could not complete" })), false);
  assert.equal(outpaintCanRegenerate({ warning: "Generated timing does not cover the source segment" }), false);
});
test("durable recovery retains a rejected candidate on its producer and does not replace Output", () => {
  const nodes = [{ id: "u", type: "utility", data: { utilityMode: "video", utilityVideoModel: "Video Outpaint" } }, { id: "o", type: "output", data: { resultUrl: "/previous.mp4" } }];
  const jobs = [{ runId: "r", nodeId: "u", groupId: "g", batchIndex: 1, createdAt: "2026-10-21", state: "completed", outputTargetNodeId: "o", result: { video: { localUrl: "/candidate.mp4" }, videoOutpaint: { qc: { status: "needs_review" } }, warning: "Seam remains" } }];
  const patches = recoveredVideoPatches(nodes, jobs, new Set(), [{ from: { nodeId: "u" }, to: { nodeId: "o" } }]);
  assert.equal(patches[0].patch.resultUrl, "/candidate.mp4"); assert.equal(patches[0].patch.status, "error"); assert.equal(patches[1].patch.status, "error"); assert.equal(patches[1].patch.resultUrl, undefined);
});
