import assert from "node:assert/strict";
import test from "node:test";
import {
  appendTextAgentMessage,
  createTextAgentMessage,
  normalizeTextAgentMessages,
  textAgentReferenceText,
  textAgentRequestMessages
} from "../src/textAgent.js";

test("Text Agent normalizes and preserves alternating saved conversation turns", () => {
  const messages = normalizeTextAgentMessages([
    { id: "one", role: "user", text: " First question " },
    { id: "two", role: "assistant", content: "First answer" },
    { role: "system", text: "Discard me" },
    { role: "user", text: "" }
  ]);

  assert.deepEqual(messages, [
    { id: "one", role: "user", text: "First question", createdAt: "" },
    { id: "two", role: "assistant", text: "First answer", createdAt: "" }
  ]);
  assert.deepEqual(textAgentRequestMessages(messages), [
    { role: "user", text: "First question" },
    { role: "assistant", text: "First answer" }
  ]);
});

test("Text Agent appends messages and scans user turns plus the draft for node references", () => {
  const first = createTextAgentMessage("user", "Compare @FrameA", { id: "first", createdAt: "now" });
  const second = createTextAgentMessage("assistant", "Ready", { id: "second", createdAt: "later" });
  const messages = appendTextAgentMessage(appendTextAgentMessage([], first), second);

  assert.equal(messages.length, 2);
  assert.equal(textAgentReferenceText({ agentMessages: messages, agentDraft: "Use @StyleB" }), "Compare @FrameA\nUse @StyleB");
});
