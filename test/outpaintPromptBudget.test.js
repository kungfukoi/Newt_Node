import test from "node:test";
import assert from "node:assert/strict";
import { fitOutpaintPrompt, outpaintEditablePromptBudget, outpaintSubmissionByteLimit } from "../src/outpaintPromptBudget.js";
import { seedanceOutpaintPrompt, planVideoOutpaint } from "../src/videoOutpaint.js";

test("draft and submission budgets include actual hidden canvas and overlap instructions", () => {
  for (const feather of [0, 32, 128]) {
    const plan = planVideoOutpaint({ width: 1920, height: 1080, fps: 24, duration: 4 }, { model: "seedance-2.5", feather });
    plan.generationContentRect = { x: 0, y: 700, width: 1080, height: 500 };
    const budget = outpaintEditablePromptBudget(plan, plan.settings);
    const text = fitOutpaintPrompt("Continue the visible surfaces. ".repeat(300), budget);
    assert.ok(Buffer.byteLength(text) <= budget);
    const complete = seedanceOutpaintPrompt(text, false, [], feather, plan);
    assert.ok(Buffer.byteLength(complete) <= outpaintSubmissionByteLimit);
    assert.match(complete, /subject appearing later must never be painted into earlier frames/);
  }
});

test("UTF-8 fitting preserves short prompts, full characters, and prioritizes timing over description", () => {
  assert.equal(fitOutpaintPrompt("Keep the lighting.", 1100), "Keep the lighting.");
  const long = "Decorative description. ".repeat(200) + "Before 2.5 seconds, extend background only. After 2.5 seconds extend the entering subject.";
  const fitted = fitOutpaintPrompt(long, 200);
  assert.match(fitted, /Before 2.5 seconds/); assert.match(fitted, /After 2.5 seconds/);
  for (const text of ["🙂".repeat(900), "自然な風景を拡張する。".repeat(200)]) {
    const clipped = fitOutpaintPrompt(text, 1100);
    assert.ok(Buffer.byteLength(clipped) <= 1100);
    assert.doesNotMatch(clipped, /�/);
  }
});
