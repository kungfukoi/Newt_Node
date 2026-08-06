import assert from "node:assert/strict";
import test from "node:test";
import { insertOutputToken, outputTokenOptions } from "../src/outputTokens.js";

test("Output token list exposes only the supported user-facing tokens", () => {
  assert.deepEqual(outputTokenOptions, ["$node", "$date", "$index", "$time"]);
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