import test from "node:test";
import assert from "node:assert/strict";
import { measureOutpaintMotion } from "../server/outpaint-motion.js";
import { outpaintNeedsFinishing } from "../src/outpaintQuality.js";
import { outpaintQcStatus } from "../src/outpaintQcStatus.js";
import { recoveredVideoPatches } from "../src/remoteVideoRecovery.js";

const width = 128, height = 80, count = 8, stride = width * height;
function shot() {
  const pixels = new Uint8Array(count * stride).fill(150);
  for (let f = 0; f < count; f++) for (let y = 0; y < height; y++) for (let x = 30 + f * 4; x < 38 + f * 4; x++) pixels[f * stride + y * width + x] = 20;
  return pixels;
}
const settings = { width, height, count, edges: ["top", "bottom"] };
test("every-frame correspondence accepts an unchanged shot, rejects a missing narrow prop and local motion drift", () => {
  const original = shot();
  const same = measureOutpaintMotion(original, original, settings);
  assert.equal(same.status, "passed_checks"); assert.equal(same.framesChecked, count);
  const missing = original.slice();
  for (let y = 0; y < 24; y++) for (let x = 42; x < 50; x++) missing[3 * stride + y * width + x] = 150;
  const result = measureOutpaintMotion(original, missing, settings);
  assert.equal(result.status, "needs_review");
  assert.deepEqual(result.frames.filter(f => f.flagged).map(f => f.frame), [3]);
  assert.ok(result.frames[3].edges.includes("top"));
  assert.ok(result.meanError < 1, "A whole-frame average would have missed this prop");
  const drift = original.slice();
  drift.set(original.subarray(3 * stride, 4 * stride), 5 * stride);
  assert.equal(measureOutpaintMotion(original, drift, settings).status, "needs_review");
});
test("short or misaligned media cannot pass, and only a verified uniform offset is compared", () => {
  const original = shot();
  assert.equal(measureOutpaintMotion(original, original.subarray(stride), settings).status, "needs_review");
  const delayed = new Uint8Array(original.length + stride); delayed.set(original, stride);
  assert.equal(measureOutpaintMotion(original, delayed, { ...settings, offset: 1 }).status, "passed_checks");
  assert.equal(measureOutpaintMotion(original, delayed, settings).status, "needs_review");
});
test("motion rejection holds Output even while aesthetic QC is disabled", () => {
  const details = { qc: { status: "off" }, matching: { finishVersion: 3, motionValidation: { status: "needs_review", flaggedFrames: 2 } } };
  assert.equal(outpaintNeedsFinishing({ videoOutpaint: details }), true);
  assert.match(outpaintQcStatus({ details }), /Motion needs review/);
  details.matching.motionValidation.status = "passed_checks";
  assert.equal(outpaintNeedsFinishing({ videoOutpaint: details }), false);
  assert.match(outpaintQcStatus({ details }), /still need visual review/);
});

test("durable recovery retains rejected candidate without replacing an accepted Output", () => {
  const videoOutpaint = { qc: { status: "off" }, matching: { finishVersion: 3, motionValidation: { status: "needs_review", flaggedFrames: 2 } }, warning: "Motion needs review" };
  const nodes = [{ id: "u", type: "utility", data: { utilityMode: "video", utilityVideoModel: "Video Outpaint" } }, { id: "o", type: "output", data: { resultUrl: "/accepted.mov" } }];
  const jobs = [{ runId: "r", nodeId: "u", groupId: "g", state: "completed", batchIndex: 1, createdAt: "2026-10-22", outputTargetNodeId: "o", result: { video: { localUrl: "/candidate.mov" }, videoOutpaint, warning: "Motion needs review" } }];
  const patches = recoveredVideoPatches(nodes, jobs, new Set(), [{ from: { nodeId: "u" }, to: { nodeId: "o" } }]);
  assert.equal(patches.find(p => p.nodeId === "u").patch.resultUrl, "/candidate.mov");
  const output = patches.find(p => p.nodeId === "o").patch;
  assert.equal(output.status, "error"); assert.equal(output.resultUrl, undefined);
});
