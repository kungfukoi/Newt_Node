import test from "node:test";
import assert from "node:assert/strict";
import {
  utilityImageModelNames,
  utilityImageModelOptions,
  utilityVideoModelNames,
  utilityVideoModelOptions
} from "../src/modelOptions.js";

test("Topaz upscalers are exposed in both Utility model tabs", () => {
  assert.equal(utilityImageModelNames.topazUpscaler, "Topaz Image Upscale");
  assert.equal(utilityVideoModelNames.topazUpscaler, "Topaz Video Upscale");
  assert.ok(utilityImageModelOptions.includes(utilityImageModelNames.topazUpscaler));
  assert.ok(utilityVideoModelOptions.includes(utilityVideoModelNames.topazUpscaler));
});
