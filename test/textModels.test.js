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
