import test from "node:test";
import assert from "node:assert/strict";
import { appendTextPromptHistory, normalizeTextPromptHistory, recallTextPrompt } from "../src/textPromptHistory.js";

test("prompt history keeps successful user prompts without adjacent duplicates", () => {
  assert.deepEqual(normalizeTextPromptHistory(["first", "first", "", "second"]), ["first", "second"]);
  assert.deepEqual(appendTextPromptHistory(["first"], "second"), ["first", "second"]);
  assert.deepEqual(appendTextPromptHistory(["first"], "first"), ["first"]);
});

test("prompt recall walks backward and restores the unfinished draft", () => {
  const previous = recallTextPrompt({ history: ["first", "second"], index: null, direction: "previous", currentText: "draft" });
  assert.deepEqual(previous, { text: "second", index: 1, draft: "draft" });

  const older = recallTextPrompt({ history: ["first", "second"], index: previous.index, direction: "previous", currentText: previous.text, draft: previous.draft });
  assert.equal(older.text, "first");

  const newer = recallTextPrompt({ history: ["first", "second"], index: older.index, direction: "next", currentText: older.text, draft: older.draft });
  const restored = recallTextPrompt({ history: ["first", "second"], index: newer.index, direction: "next", currentText: newer.text, draft: newer.draft });
  assert.deepEqual(restored, { text: "draft", index: null, draft: "" });
});
