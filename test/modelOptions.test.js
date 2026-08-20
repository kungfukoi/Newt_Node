import test from "node:test";
import assert from "node:assert/strict";
import {
  compositeVideoBlendModeOptions,
  utilityImageModelNames,
  utilityImageModelOptions,
  utilityVideoModelNames,
  utilityVideoModelOptions
} from "../src/modelOptions.js";

test("Topaz utilities are exposed in their Utility model tabs", () => {
  assert.equal(utilityImageModelNames.topazUpscaler, "Topaz Image Upscale");
  assert.equal(utilityVideoModelNames.topazUpscaler, "Topaz Video Upscale");
  assert.equal(utilityVideoModelNames.topazSdrToHdr, "Topaz SDR to HDR");
  assert.ok(utilityImageModelOptions.includes(utilityImageModelNames.topazUpscaler));
  assert.ok(utilityVideoModelOptions.includes(utilityVideoModelNames.topazUpscaler));
  assert.ok(utilityVideoModelOptions.includes(utilityVideoModelNames.topazSdrToHdr));
});

test("Flux Video Upscale is exposed in Utility video models", () => {
  assert.equal(utilityVideoModelNames.fluxVideoUpscale, "Flux Video Upscale");
  assert.ok(utilityVideoModelOptions.includes(utilityVideoModelNames.fluxVideoUpscale));
});

test("Qwen Camera Edit is exposed in Utility image models", () => {
  assert.equal(utilityImageModelNames.qwenCameraEdit, "Qwen Camera Edit");
  assert.ok(utilityImageModelOptions.includes(utilityImageModelNames.qwenCameraEdit));
});

test("DWPose Video is exposed in Utility video models", () => {
  assert.equal(utilityVideoModelNames.dwposeVideo, "DWPose Video");
  assert.ok(
    utilityVideoModelOptions.includes(utilityVideoModelNames.dwposeVideo)
  );
});

test("legacy Wan Fun Control is hidden from Utility video models", () => {
  assert.equal(utilityVideoModelNames.wanFunControl, "Wan Fun Control");
  assert.equal(utilityVideoModelOptions.includes(utilityVideoModelNames.wanFunControl), false);
});

test("Composite Video exposes standard blend modes", () => {
  const modes = Object.fromEntries(compositeVideoBlendModeOptions);

  assert.equal(modes.normal, "Normal");
  assert.equal(modes.multiply, "Multiply");
  assert.equal(modes.screen, "Screen");
  assert.equal(modes.overlay, "Overlay");
  assert.equal(modes.addition, "Add");
});
