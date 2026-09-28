import assert from "node:assert/strict";
import test from "node:test";
import { insertOutputToken, outputSourceFileName, outputSourceNodeTitle, outputTokenOptions } from "../src/outputTokens.js";

test("Output token list exposes only the supported user-facing tokens", () => {
  assert.deepEqual(outputTokenOptions, ["$node", "$filename", "$date", "$index", "$time"]);
});

test("Output $node uses the connected node title instead of its asset filename", () => {
  const source = {
    type: "image",
    data: {
      title: "xshape",
      resultUrl: "/outputs/2026-08-06T19-12-56-965Z-edit-hue-bfee8e7d.png"
    }
  };

  assert.equal(outputSourceNodeTitle(source, "2026-08-06T19-12-56-965Z-edit-hue-bfee8e7d.png"), "xshape");
});

test("Output $filename prefers the original source filename", () => {
  const source = {
    data: {
      fileName: "Original Plate.v2.mov",
      resultUrl: "/uploads/stored-asset-123.mov"
    }
  };

  assert.equal(outputSourceFileName(source), "Original Plate.v2.mov");
});

test("Output $filename follows a single upstream video through a processing node", () => {
  const sourceVideo = {
    id: "video-1",
    type: "video",
    data: { fileName: "Camera Original.mov", resultUrl: "/uploads/stored-video.mp4" }
  };
  const utility = {
    id: "utility-1",
    type: "utility",
    data: { resultUrl: "/outputs/depth-anything-123.mp4" }
  };
  const incomingByNode = {
    "utility-1": {
      referenceVideoIn: [{ source: sourceVideo }]
    }
  };

  assert.equal(
    outputSourceFileName(utility, { fileName: "depth-anything-123.mp4", url: utility.data.resultUrl }, incomingByNode),
    "Camera Original.mov"
  );
});

test("Output $filename does not choose arbitrarily between multiple video inputs", () => {
  const utility = {
    id: "utility-1",
    type: "utility",
    data: { resultUrl: "/outputs/composite-video.mp4" }
  };
  const incomingByNode = {
    "utility-1": {
      referenceVideoIn: [
        { source: { id: "video-1", data: { fileName: "Background.mov" } } },
        { source: { id: "video-2", data: { fileName: "Foreground.mov" } } }
      ]
    }
  };

  assert.equal(
    outputSourceFileName(utility, { fileName: "composite-video.mp4", url: utility.data.resultUrl }, incomingByNode),
    "composite-video.mp4"
  );
});

test("Output tokens insert at the current cursor", () => {
  assert.deepEqual(insertOutputToken("render--final", "$date", 7, 7), {
    value: "render-$date-final",
    cursor: 12
  });
});

test("Output tokens replace the current field selection", () => {
  assert.deepEqual(insertOutputToken("render-DATE-final", "$time", 7, 11), {
    value: "render-$time-final",
    cursor: 12
  });
});

test("Output $filename inserts at the current cursor", () => {
  assert.deepEqual(insertOutputToken("render--final", "$filename", 7, 7), {
    value: "render-$filename-final",
    cursor: 16
  });
});
