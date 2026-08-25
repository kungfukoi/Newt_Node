import assert from "node:assert/strict";
import test from "node:test";
import { nodeApi } from "../src/api/newtApi.js";
import { runTextNodeProcessing } from "../src/nodeRunners/textModels.js";

const originalProcessText = nodeApi.processText;

test.afterEach(() => {
  nodeApi.processText = originalProcessText;
});

test("Text Model runner sends resolved node-reference text and referenced media", async () => {
  let requestBody = null;
  nodeApi.processText = async (body) => {
    requestBody = body;
    return {
      response: { ok: true },
      data: { text: "Processed prompt", model: "test-model" }
    };
  };

  const resolvedText = [
    "Turn @HeroFrame into tighter art direction.",
    "",
    "Node reference context:",
    "Referenced image node @HeroFrame: /uploads/hero-frame.png"
  ].join("\n");
  const result = await runTextNodeProcessing({
    node: {
      id: "text-1",
      data: {
        title: "Text Model",
        text: "Turn @HeroFrame into tighter art direction."
      }
    },
    incoming: {},
    workflowContext: { projectId: "project-1", projectName: "Project" },
    sourceLabel: (source) => source?.data?.title || source?.type || "",
    promptPiecesForSource: () => [],
    text: resolvedText,
    nodeReferences: {
      imageInputs: [{ label: "@HeroFrame", url: "/uploads/hero-frame.png", type: "image" }]
    }
  });

  assert.equal(result.text, "Processed prompt");
  assert.equal(requestBody.text, resolvedText);
  assert.deepEqual(requestBody.imageInputs, [{ label: "@HeroFrame", url: "/uploads/hero-frame.png", type: "image" }]);
  assert.equal(requestBody.nodeTitle, "Text Model");
  assert.equal(requestBody.projectName, "Project");
});

test("Text Agent runner sends prior turns separately and keeps connected inputs", async () => {
  let requestBody = null;
  nodeApi.processText = async (body) => {
    requestBody = body;
    return {
      response: { ok: true },
      data: { text: "The interface should use the second layout.", model: "test-agent-model" }
    };
  };

  const result = await runTextNodeProcessing({
    node: { id: "agent-1", data: { title: "Design Agent" } },
    incoming: {
      textIn: [{ source: { type: "plainText", data: { title: "Requirements", text: "Keep the controls compact." } } }]
    },
    workflowContext: { projectId: "project-1", projectName: "Project" },
    sourceLabel: (source) => source?.data?.title || source?.type || "",
    promptPiecesForSource: () => [],
    mode: "agent",
    messages: [
      { id: "one", role: "user", text: "Which layout is clearer?" },
      { id: "two", role: "assistant", text: "The second is clearer." }
    ],
    text: "Refine that recommendation."
  });

  assert.equal(result.text, "The interface should use the second layout.");
  assert.equal(requestBody.mode, "agent");
  assert.deepEqual(requestBody.messages, [
    { role: "user", text: "Which layout is clearer?" },
    { role: "assistant", text: "The second is clearer." }
  ]);
  assert.deepEqual(requestBody.textInputs, [{ label: "Requirements", text: "Keep the controls compact." }]);
});
