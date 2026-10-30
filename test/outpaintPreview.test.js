import test from "node:test";
import assert from "node:assert/strict";
import { outpaintOutputItem, outpaintPlatePreview } from "../src/outpaintPreview.js";
import { outpaintNeedsFinishing } from "../src/outpaintQuality.js";
import { originalOutpaintSourceUrl, outputExportFormatOptions } from "../src/outputExport.js";

test("selected plate is an ordinary exportable video without composite finish metadata", () => {
  const item = { url: "/composite.mp4", fileName: "composite.mp4", thumbnailUrl: "/composite.png", videoOutpaint: { rawVideoUrl: "/raw.mov", prepared: { plan: { sourceFormat: { sourceUrl: "/original.mp4" } } } } };
  assert.equal(outpaintOutputItem(item), item);
  const raw = outpaintOutputItem(item, false);
  assert.equal(raw.url, "/raw.mov");
  assert.equal(raw.fileName, "raw.mov");
  assert.equal(raw.mimeType, "video/quicktime");
  assert.equal(raw.originResultUrl, item.url);
  assert.equal(raw.outpaintOrigin, item.videoOutpaint);
  assert.equal(raw.thumbnailUrl, undefined);
  assert.equal(outpaintNeedsFinishing(raw), false);
  assert.equal(originalOutpaintSourceUrl(raw), "");
  assert.match(outputExportFormatOptions("video", raw)[0].label, /Same as input/);
  assert.equal(item.url, "/composite.mp4");
  item.videoOutpaint.matching = { generatedPlateUrl: "/plate.mp4" };
  assert.equal(outpaintOutputItem(item, false).url, "/plate.mp4");
  assert.equal(outpaintOutputItem({ url: "/legacy.mp4" }, false).url, "/legacy.mp4");
});

test("raw comparison maps native 24000/1001 source frames onto provider frames including retained handles", () => {
  const item = { videoOutpaint: { rawVideoUrl: "/raw.mov", prepared: { plan: { fps: 24, sourceFps: 23.976, sourceFrameRate: "24000/1001", prerollFrames: 94 } }, matching: { temporalAlignment: { offsetFrames: -3 } } } };
  const preview = outpaintPlatePreview(item);
  const sourceFrame = 93, sourceTime = sourceFrame * 1001 / 24000;
  assert.ok(Math.abs((preview.offset + sourceTime * preview.rate) * 24 - 184) < 1e-8);
  item.videoOutpaint.matching.repeatOutput = "all";
  assert.equal(outpaintPlatePreview(item).offset, 0);
});

test("exact retained plate previews use delivery time and legacy/crop results degrade safely", () => {
  assert.equal(outpaintPlatePreview({ url: "/old.mp4" }), null);
  assert.equal(outpaintPlatePreview({ videoOutpaint: { localCrop: true, rawVideoUrl: "/raw.mov" } }), null);
  const legacy = outpaintPlatePreview({ videoOutpaint: { rawVideoUrl: "/raw.mov" } });
  assert.equal(legacy.rate, 1);
  assert.equal(legacy.offset, 0);
  const plate = outpaintPlatePreview({ videoOutpaint: { rawVideoUrl: "/raw.mov", matching: { generatedPlateUrl: "/plate.mp4" } } });
  assert.equal(plate.url, "/plate.mp4");
  assert.equal(plate.rate, 1);
  assert.equal(plate.offset, 0);
});
