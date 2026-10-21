import test from "node:test";
import assert from "node:assert/strict";
import { outpaintQcStatus } from "../src/outpaintQcStatus.js";

test("QC status follows real finishing progress and identifies review targets without promising regeneration", () => {
  assert.equal(outpaintQcStatus({ running: true, message: "QC: Reviewing seams, motion and consistency…" }), "Reviewing seams, motion and consistency…");
  assert.equal(outpaintQcStatus({ running: true, stage: "qc-edits", findings: [{ category: "anatomy" }, { category: "timing" }] }), "Matching color and blending edges…\nChecking anatomy, timing.");
  assert.equal(outpaintQcStatus({ running: true, stage: "extension", details: { qc: { status: "passed_checks" } } }), "Waiting for generated fill…");
});

test("QC status distinguishes passing checks from unresolved defects without diagnostic copy", () => {
  assert.equal(outpaintQcStatus({ details: { qc: { status: "passed_checks" } } }), "QC passed.");
  assert.equal(outpaintQcStatus({ details: { qc: { status: "off" } } }), "QC disabled.\nSource overlap blended.");
  assert.equal(outpaintQcStatus({ details: { qc: { status: "needs_review", missingFillFrames: 21 } } }), "Needs review.\nIncomplete fill remains.");
  assert.equal(outpaintQcStatus({ details: { qc: { status: "needs_review", visual: { issues: [{ category: "seam", description: "Long technical report" }, { category: "seam" }, { category: "color" }] } } } }), "Needs review.\nRemaining: edge seams, color and brightness.");
});
