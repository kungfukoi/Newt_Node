import { nodeApi } from "../api/newtApi.js";
import { workflowContextPayload } from "../workflowContext.js";

export async function runTextNodeProcessing({
  node,
  incoming,
  workflowContext,
  sourceLabel,
  promptPiecesForSource,
  nodeReferences = {}
}) {
  const { response, data } = await nodeApi.processText({
    text: node.data.text,
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
    nodeTitle: node.data.title
  });
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
      text: ["plainText", "text"].includes(source.type) ? source.data.resultText || source.data.text : source.data.resultText || source.data.prompt || source.data.title
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
