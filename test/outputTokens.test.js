import assert from "node:assert/strict";
import test from "node:test";
import { insertOutputToken, outputSourceNodeTitle, outputTokenOptions } from "../src/outputTokens.js";

test("Output token list exposes only the supported user-facing tokens", () => {
  assert.deepEqual(outputTokenOptions, ["$node", "$date", "$index", "$time"]);
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