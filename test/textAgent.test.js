import assert from "node:assert/strict";
import test from "node:test";
import {
  appendTextAgentMessage,
  buildTextAgentPrompt,
  createTextAgentMessage,
  normalizeTextAgentMessages,
  replaceLatestTextAgentAssistantMessage,
  textAgentReferenceText,
  textAgentMessagesForPrompt,
  textAgentRequestMessages,
  textAgentSplitRatio
} from "../src/textAgent.js";

test("Text Agent split preserves a saved ratio and derives legacy field proportions", () => {
  assert.equal(textAgentSplitRatio({ agentSplitRatio: .4 }), .4);
  assert.equal(textAgentSplitRatio({ agentSplitRatio: 7 }), .9);
  assert.equal(textAgentSplitRatio({ agentSplitRatio: -1 }), .1);
  assert.equal(textAgentSplitRatio({ textareaResizeMode: true, textareaHeights: { "0:Text Agent response": 300, "1:Message Text Agent": 100 } }), .75);
  assert.equal(textAgentSplitRatio({}), 2 / 3);
});

test("saved output without conversation becomes the prompt editing baseline", () => {
  const messages = textAgentMessagesForPrompt({ resultText: "A cluttered dorm desk. Keep the laptop and mug untouched." });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, "assistant");
  const request = buildTextAgentPrompt({ messages, text: "Add an energy drink." });
  assert.ok(request.includes("Current prompt (authoritative editing baseline):\nA cluttered dorm desk. Keep the laptop and mug untouched."));
  assert.ok(request.includes("Current user instruction:\nAdd an energy drink."));
  assert.ok(request.includes("Return the complete revised prompt"));
});

test("follow-up edits retain the thread and use manually edited output", () => {
  const messages = textAgentMessagesForPrompt({
    resultText: "A red car at night, wide shot. Keep the camera still.",
    agentMessages: [
      { role: "user", text: "Keep the camera still." },
      { role: "assistant", text: "A blue car at night." }
    ]
  });
  assert.equal(messages[0].text, "Keep the camera still.");
  assert.equal(messages[1].text, "A red car at night, wide shot. Keep the camera still.");
  const request = buildTextAgentPrompt({ messages, text: "Make it rain.", context: ["Style: cinematic"] });
  assert.ok(request.includes("Conversation history:"));
  assert.ok(request.includes("Style: cinematic"));
  assert.ok(!request.includes("A blue car"));
});

test("fresh and cleared agents default to a complete generation prompt", () => {
  const request = buildTextAgentPrompt({ messages: textAgentMessagesForPrompt({ resultText: "", agentMessages: [] }), text: "A fox in a snowy forest" });
  assert.ok(!request.includes("Current prompt (authoritative editing baseline):"));
  assert.ok(request.includes("Return the complete descriptive image or video generation prompt."));
});

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
