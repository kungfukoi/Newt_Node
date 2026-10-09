import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { normalizeVideoCropSettings, videoCropRect, videoCropFilter, constrainVideoCrop, dragVideoCrop } from "../src/videoCrop.js";
import { editEffectsForSourceType } from "../src/editEffects.js";

test("video crop is available on Video and preserves legacy centered pixel crops", () => {
  assert.ok(editEffectsForSourceType("video").some(effect => effect.id === "crop"));
  assert.deepEqual(normalizeVideoCropSettings({ width: 320, height: 180 }, { width: 640, height: 360 }), { cropX: 25, cropY: 25, cropWidth: 50, cropHeight: 50 });
  assert.deepEqual(videoCropRect({ cropX: 90, cropY: -5, cropWidth: 50, cropHeight: 25 }), { x: 50, y: 0, width: 50, height: 25 });
});

test("FFmpeg crops the selected off-center region with even dimensions", () => {
  const filter = videoCropFilter({ cropX: 50, cropY: 0, cropWidth: 50, cropHeight: 50 });
  const result = spawnSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=red:s=640x360,drawbox=x=320:y=0:w=320:h=180:color=blue:t=fill", "-vf", filter, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.toString());
  assert.equal(result.stdout.length, 320 * 180 * 3);
  assert.ok(result.stdout[2] > 200 && result.stdout[0] < 30, "crop must contain the blue top-right region");
});

test("fixed ratio respects source aspect and anchors every resize corner", () => {
  const dimensions = { width: 1920, height: 1080 };
  const settings = { cropMode: "ratio", cropRatioWidth: 1, cropRatioHeight: 1 };
  const rect = constrainVideoCrop({ x: 10, y: 10, width: 40, height: 40 }, settings, dimensions);
  for (const handle of ["nw", "ne", "sw", "se"]) {
    const resized = dragVideoCrop(rect, handle, 15, 5, settings, dimensions);
    assert.ok(Math.abs(resized.width * 1920 / (resized.height * 1080) - 1) < 0.0001);
    assert.ok(resized.x >= 0 && resized.y >= 0 && resized.x + resized.width <= 100 && resized.y + resized.height <= 100);
  }
});

test("fixed size remains constant when moved and survives normalization", () => {
  const dimensions = { width: 1920, height: 1080 };
  const settings = { cropMode: "size", cropPixelWidth: 480, cropPixelHeight: 270 };
  const rect = constrainVideoCrop({ x: 90, y: 90, width: 40, height: 40 }, settings, dimensions);
  assert.deepEqual(rect, { x: 75, y: 75, width: 25, height: 25 });
  assert.deepEqual(dragVideoCrop(rect, "se", 10, 10, settings, dimensions), rect);
  const saved = normalizeVideoCropSettings({ ...settings, cropX: 20, cropY: 20, cropWidth: 25, cropHeight: 25 }, dimensions);
  assert.equal(saved.cropMode, "size");
  assert.equal(saved.cropPixelWidth, 480);
  assert.equal(saved.cropWidth, 25);
  const tiny = constrainVideoCrop(rect, { cropMode: "size", cropPixelWidth: 2, cropPixelHeight: 3 }, dimensions);
  assert.ok(Math.abs(tiny.width / 100 * dimensions.width - 2) < 0.0001);
  assert.ok(Math.abs(tiny.height / 100 * dimensions.height - 3) < 0.0001);
});
