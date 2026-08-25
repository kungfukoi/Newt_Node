import assert from "node:assert/strict";
import test from "node:test";
import {
  appendTextAgentMessage,
  createTextAgentMessage,
  normalizeTextAgentMessages,
  replaceLatestTextAgentAssistantMessage,
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

test("Text Agent response edits update the latest hidden assistant turn", () => {
  const messages = [
    createTextAgentMessage("user", "First question", { id: "user-1", createdAt: "one" }),
    createTextAgentMessage("assistant", "First answer", { id: "assistant-1", createdAt: "two" }),
    createTextAgentMessage("user", "Follow-up", { id: "user-2", createdAt: "three" }),
    createTextAgentMessage("assistant", "Original response", { id: "assistant-2", createdAt: "four" })
  ];
  const revised = replaceLatestTextAgentAssistantMessage(messages, "Revised response");

  assert.equal(revised[1].text, "First answer");
  assert.deepEqual(revised[3], {
    id: "assistant-2",
    role: "assistant",
    text: "Revised response",
    createdAt: "four"
  });
});

test("clearing or creating a Text Agent response keeps hidden context aligned", () => {
  const messages = [
    createTextAgentMessage("user", "Question", { id: "user-1", createdAt: "one" }),
    createTextAgentMessage("assistant", "Answer", { id: "assistant-1", createdAt: "two" })
  ];
  assert.deepEqual(replaceLatestTextAgentAssistantMessage(messages, ""), [messages[0]]);

  const manuallyCreated = replaceLatestTextAgentAssistantMessage([messages[0]], "Manual response");
  assert.equal(manuallyCreated.length, 2);
  assert.equal(manuallyCreated[1].role, "assistant");
  assert.equal(manuallyCreated[1].text, "Manual response");
});
