import assert from "node:assert/strict";
import test from "node:test";
import { falLlmInput } from "../server/creative-llm.js";
import {
  defaultFalTextModel,
  defaultFalVideoTextModel,
  falVideoTextEndpoint,
  nativeVideoAnalysisInput,
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

test("native-video analysis enables reasoning required by Gemini 3.1 Pro", () => {
  const input = nativeVideoAnalysisInput({
    videoUrls: ["https://example.com/reference.mp4"],
    videoInputs: [{ label: "Reference" }],
    prompt: "Describe this clip for the Text Agent.",
    systemPrompt: "Return concise context."
  });

  assert.deepEqual(input.video_urls, ["https://example.com/reference.mp4"]);
  assert.equal(input.model, "google/gemini-3.1-pro-preview");
  assert.equal(input.prompt, "Describe this clip for the Text Agent.");
  assert.equal(input.system_prompt, "Return concise context.");
  assert.equal(input.reasoning, true);
});

test("Gemini frame-presence vision requests enable mandatory reasoning", () => {
  const input = falLlmInput({ model: defaultFalVideoTextModel, route: "video-outpaint-frame-presence", prompt: "Inspect every frame." });
  assert.equal(input.reasoning, true);
});
