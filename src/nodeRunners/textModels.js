import { nodeApi } from "../api/newtApi.js";
import { workflowContextPayload } from "../workflowContext.js";
import { runTrackedGeneration } from "../generationProgressStore.js";
import { textAgentRequestMessages } from "../textAgent.js";

export async function runTextNodeProcessing({
  node,
  incoming,
  workflowContext,
  sourceLabel,
  promptPiecesForSource,
  text,
  nodeReferences = {},
  generationGroupId = "",
  mode = "process",
  messages = []
}) {
  const agentMode = mode === "agent";
  const { response, data } = await runTrackedGeneration({
    nodeId: node.id,
    nodeTitle: node.data.title,
    kind: "text",
    label: agentMode ? "Text Agent" : "Text Model",
    groupId: generationGroupId,
    batchIndex: 1,
    batchTotal: 1
  }, (progress) => nodeApi.processText({
    mode: agentMode ? "agent" : "process",
    messages: agentMode ? textAgentRequestMessages(messages) : [],
    text: text ?? node.data.text,
    textInputs: [
      ...normalizedReferenceInputs(nodeReferences.textInputs),
      ...connectedTextInputItems(incoming.textIn, sourceLabel),
      ...connectedStyleInputItems(incoming.styleIn, sourceLabel, promptPiecesForSource)
    ],
    imageInputs: [
      ...connectedMediaInputItems(incoming.imageIn, "image", sourceLabel),
      ...normalizedReferenceInputs(nodeReferences.imageInputs)
    ],
    videoInputs: [
      ...connectedMediaInputItems(incoming.videoIn, "video", sourceLabel),
      ...normalizedReferenceInputs(nodeReferences.videoInputs)
    ],
    ...workflowContextPayload(workflowContext),
    nodeId: node.id,
    nodeTitle: node.data.title,
    ...progress
  }));
  if (!response.ok) throw new Error(data.error || "Text processing failed.");

  return {
    text: data.text || "",
    model: data.model || ""
  };
}

function normalizedReferenceInputs(items = []) {
  return Array.isArray(items) ? items.filter((item) => item && (item.text || item.url)) : [];
}

function connectedTextInputItems(items = [], sourceLabel) {
  return items
    .map(({ source }) => ({
      label: sourceLabel(source),
      text: ["plainText", "text", "textAgent"].includes(source.type) ? source.data.resultText || source.data.text || source.data.agentDraft : source.data.resultText || source.data.prompt || source.data.title
    }))
    .filter((item) => item.text);
}

function connectedStyleInputItems(items = [], sourceLabel, promptPiecesForSource) {
  return items
    .map(({ source }) => ({
      label: `Style: ${sourceLabel(source)}`,
      text: promptPiecesForSource(source).join("\n\n")
    }))
    .filter((item) => item.text);
}

function connectedMediaInputItems(items = [], mediaType, sourceLabel) {
  return items
    .map(({ source }) => {
      if (!source.data.resultUrl) return null;
      return {
        url: source.data.resultUrl,
        label: sourceLabel(source),
        type: mediaType
      };
    })
    .filter(Boolean);
}
