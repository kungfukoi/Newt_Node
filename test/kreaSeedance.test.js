import test from "node:test";
import assert from "node:assert/strict";
import { apiErrorMessage } from "../src/apiErrors.js";
import {
  compactKreaSeedancePrompt,
  estimateKreaSeedanceCost,
  extractKreaJobResultUrl,
  kreaSeedanceEndpoint,
  kreaReferenceImageTarget,
  resolveSeedanceRuntimeProvider
} from "../src/kreaSeedance.js";

test("Seedance preserves legacy Fal-first routing when no explicit provider is set", () => {
  assert.equal(resolveSeedanceRuntimeProvider({ falKey: "fal", kreaKey: "krea" }), "fal");
  assert.equal(resolveSeedanceRuntimeProvider({ falKey: "", kreaKey: "krea" }), "krea");
  assert.equal(resolveSeedanceRuntimeProvider({ falKey: "", kreaKey: "" }), "");
});

test("Seedance honors the explicit Settings provider without silently falling back", () => {
  assert.equal(resolveSeedanceRuntimeProvider({ preferredProvider: "krea", falKey: "fal", kreaKey: "krea" }), "krea");
  assert.equal(resolveSeedanceRuntimeProvider({ preferredProvider: "fal", falKey: "fal", kreaKey: "krea" }), "fal");
  assert.equal(resolveSeedanceRuntimeProvider({ preferredProvider: "krea", falKey: "fal", kreaKey: "" }), "");
});

test("Krea Seedance endpoints reflect speed", () => {
  assert.equal(kreaSeedanceEndpoint("standard"), "/generate/video/bytedance/seedance-2");
  assert.equal(kreaSeedanceEndpoint("fast"), "/generate/video/bytedance/seedance-2-fast");
});

test("Krea Seedance pricing uses resolution and video-reference tier", () => {
  const cost = estimateKreaSeedanceCost({
    durationSeconds: 15,
    resolution: "720p",
    hasVideoReference: true
  });
  assert.equal(cost.unitRateUsd, 0.1911);
  assert.equal(cost.amountUsd, 2.8665);
});

test("Krea result URLs normalize supported response shapes", () => {
  assert.equal(extractKreaJobResultUrl({ result: { urls: ["https://example.com/video.mp4"] } }), "https://example.com/video.mp4");
  assert.equal(
    extractKreaJobResultUrl({ result: { urls: [{ type: "thumbnail", url: "thumb" }, { type: "model", url: "video" }] } }),
    "video"
  );
  assert.equal(extractKreaJobResultUrl({ result: { urls: { output: "mapped" } } }), "mapped");
});

test("Krea reference images place panoramic storyboard strips on a standard canvas", () => {
  assert.deepEqual(kreaReferenceImageTarget(1344, 298), {
    width: 1344,
    height: 756,
    needsNormalization: true
  });
  assert.deepEqual(kreaReferenceImageTarget(1920, 1080), {
    width: 1920,
    height: 1080,
    needsNormalization: false
  });
});

test("structured provider errors remain readable instead of becoming object strings", () => {
  assert.equal(
    apiErrorMessage({ error: { detail: [{ loc: ["body", "prompt"], msg: "Prompt is too long" }] } }),
    "prompt: Prompt is too long"
  );
  assert.equal(apiErrorMessage({ code: "invalid_request", field: "prompt" }), '{"code":"invalid_request","field":"prompt"}');
});

test("Krea Seedance compacts oversized Director prompts while preserving supplemental direction", () => {
  const prompt = [
    "@Hero = Character reference.\n\nScene rules: live action.",
    `Style Direction: ${"ornate lighting detail ".repeat(30)}`,
    "Camera Direction: Slow push in.",
    `Shot List: ${"CUT 1 hero crosses the atrium. ".repeat(12)}`,
    "Additional direction:\nHold on the final expression for two seconds."
  ].join("\n\n");
  const compacted = compactKreaSeedancePrompt(prompt, 700);

  assert.ok(new TextEncoder().encode(compacted).length <= 700);
  assert.match(compacted, /@Hero = Character reference/);
  assert.match(compacted, /CUT 1 hero crosses the atrium/);
  assert.match(compacted, /Additional direction:\nHold on the final expression for two seconds\./);
});

test("Krea Seedance prompt budget is measured as UTF-8 bytes", () => {
  const unicodeDetail = `Style Direction: ${"precise — cinematic motion ".repeat(180)}`;
  const prompt = `${unicodeDetail}\n\nCamera Direction: Hold.\n\nShot List: CUT 1.\n\nAdditional direction:\nKeep the final beat.`;
  const compacted = compactKreaSeedancePrompt(prompt, 900);

  assert.ok(new TextEncoder().encode(compacted).length <= 900);
  assert.match(compacted, /Additional direction:\nKeep the final beat\./);
});

test("Krea Seedance leaves prompts below its provider-safe budget unchanged", () => {
  const prompt = "Director scene package\n\nAdditional direction:\nKeep the motion natural.";
  assert.equal(compactKreaSeedancePrompt(prompt), prompt);
});
