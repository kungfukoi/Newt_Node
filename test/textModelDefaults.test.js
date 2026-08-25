import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultFalTextModel,
  defaultFalVideoTextModel,
  falVideoTextEndpoint,
  nativeVideoAnalysisPrompt
} from "../src/textModelDefaults.js";

test("text and native-video analysis use their intended Fal models", () => {
  assert.equal(defaultFalTextModel, "openai/gpt-5.6-terra");
  assert.equal(defaultFalVideoTextModel, "google/gemini-3.1-pro-preview");
  assert.equal(falVideoTextEndpoint, "openrouter/router/video");
});

test("native-video analysis requests temporal, audio, and camera context", () => {
  const prompt = nativeVideoAnalysisPrompt([{ label: "Opening shot" }, { label: "Close-up" }]);

  assert.match(prompt, /Video 1: Opening shot/);
  assert.match(prompt, /Video 2: Close-up/);
  assert.match(prompt, /temporal progression and audio/i);
  assert.match(prompt, /Distinguish subject motion from camera motion/i);
  assert.match(prompt, /timestamps/i);
});
