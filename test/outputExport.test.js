import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOutputExportFormat,
  outputExportExtension,
  outputExportFormatOptions,
  outputExportMimeType,
  preferredOutputExportFormat
} from "../src/outputExport.js";
import { buildOutputExportFfmpegArgs, outputExportRequiresConversion, originalSourceExport } from "../server/output-export.js";

test("outpaint Same as original source converts the whole MP4 back to the original container and codec", () => {
  const original = originalSourceExport({ codecName: "prores", profile: "4444 XQ" }, "original.mov");
  assert.equal(outputExportRequiresConversion("finish.mp4", "video", "source", "h264", original), true);
  const args = buildOutputExportFfmpegArgs({ sourcePath: "finish.mp4", targetPath: "output.mov", mediaType: "video", format: "source", originalSource: original });
  assert.ok(args.includes("prores_ks"));
  assert.equal(args[args.indexOf("-profile:v") + 1], "5");
  assert.ok(!args.includes("-frames:v") && !args.includes("-t"), "Export must retain the whole clip");
  const same = originalSourceExport({ codecName: "h264" }, "original.mp4");
  assert.equal(outputExportRequiresConversion("finish.mp4", "video", "source", "h264", same), false);
  const tenBit = originalSourceExport({ codecName: "h264", pixelFormat: "yuv420p10le", colorSpace: "smpte170m" }, "original.mp4");
  assert.equal(outputExportRequiresConversion("finish.mp4", "video", "source", "h264", tenBit, { pixelFormat: "yuv420p", colorSpace: "bt709" }), true);
  assert.throws(() => originalSourceExport({ codecName: "unknown" }, "original.mov"), /not supported/);
  const item = { videoOutpaint: { prepared: { plan: { sourceFormat: { sourceUrl: "/original.mov" } } } } };
  assert.match(outputExportFormatOptions("video", item)[0].label, /original source/);
});

test("Output export exposes still and video formats", () => {
  assert.deepEqual(outputExportFormatOptions("image").map((option) => option.value), ["png", "jpg"]);
  assert.deepEqual(outputExportFormatOptions("video").map((option) => option.value), ["source", "mp4", "prores"]);
  assert.deepEqual(outputExportFormatOptions("audio"), []);
});

test("outpaint masters default to a byte-preserving export; explicit delivery choices still apply", () => {
  assert.equal(preferredOutputExportFormat({ outputVideoFormat: "mp4" }, "video", { url: "/source.webm" }), "source");
  assert.equal(normalizeOutputExportFormat("video"), "source");
  const item = { videoOutpaint: { outputFormat: "ProRes 4444 MOV (10-bit processing)" } };
  assert.equal(preferredOutputExportFormat({ outputVideoFormat: "mp4" }, "video", item), "source");
  assert.equal(preferredOutputExportFormat({ outputVideoFormat: "mp4", outputVideoFormatExplicit: true }, "video", item), "mp4");
  const mov = { outputVideoFormat: "prores", outputVideoFormatExplicit: true };
  assert.equal(preferredOutputExportFormat(mov, "video", item), "prores");
  assert.equal(preferredOutputExportFormat(mov, "video", item, { saving: true }), "source");
  assert.match(outputExportFormatOptions("video", item).find(option => option.value === "prores").label, /MOV.*4444 XQ/);
  assert.equal(outputExportRequiresConversion("master.mov", "video", "source"), false);
  assert.equal(outputExportExtension("video", "source", ".mov"), ".mov");
  assert.equal(outputExportMimeType("video", "source", "video/quicktime"), "video/quicktime");
});

test("Output export normalizes extensions and MIME types", () => {
  assert.equal(normalizeOutputExportFormat("image", "jpeg"), "jpg");
  assert.equal(normalizeOutputExportFormat("video", "ProRes 422 HQ"), "prores");
  assert.equal(outputExportExtension("image", "jpg"), ".jpg");
  assert.equal(outputExportExtension("video", "prores"), ".mov");
  assert.equal(outputExportMimeType("video", "prores"), "video/quicktime");
});

test("Output export only transcodes when the container or codec must change", () => {
  assert.equal(outputExportRequiresConversion("clip.mp4", "video", "mp4"), false);
  assert.equal(outputExportRequiresConversion("clip.mp4", "video", "mp4", "hevc"), true);
  assert.equal(outputExportRequiresConversion("clip.mp4", "video", "mp4", "h264"), false);
  assert.equal(outputExportRequiresConversion("clip.mp4", "video", "source", "hevc"), false);
  assert.equal(outputExportRequiresConversion("clip.mov", "video", "mp4"), true);
  assert.equal(outputExportRequiresConversion("clip.mov", "video", "prores"), true);
  assert.equal(outputExportRequiresConversion("still.jpeg", "image", "jpg"), false);
  assert.equal(outputExportRequiresConversion("still.png", "image", "jpg"), true);
});

test("Output ProRes export uses ProRes 422 HQ with optional audio", () => {
  const args = buildOutputExportFfmpegArgs({
    sourcePath: "source.mp4",
    targetPath: "output.mov",
    mediaType: "video",
    format: "prores"
  });
  assert.ok(args.includes("prores_ks"));
  assert.deepEqual(args.slice(args.indexOf("-profile:v"), args.indexOf("-profile:v") + 2), ["-profile:v", "3"]);
  assert.ok(args.includes("pcm_s24le"));
  assert.ok(args.includes("0:a?"));
  assert.equal(args.at(-1), "output.mov");
});
