function normalizedTextPart(value) {
  const text = String(value || "");
  return text.trim() ? text : "";
}

export function textOutputForNode(source = {}) {
  const data = source.data || {};
  if (source.type === "text") return data.resultText || data.text || "";
  if (source.type === "textAgent") return data.resultText || data.agentDraft || "";
  if (source.type === "skillDirector") return data.resultText || data.text || "";
  if (source.type === "plainText") return data.resultText || data.text || "";
  if (["imageModel", "videoModel", "utility", "edit"].includes(source.type)) return data.resultText || "";
  return data.title || "";
}

export function concatenatePlainTextInputs(items = [], ownText = "") {
  return [
    ...items.map(({ source }) => textOutputForNode(source)),
    ownText
  ]
    .map(normalizedTextPart)
    .filter(Boolean)
    .join("\n");
}

export function wouldCreatePlainTextCycle({ edges = [], nodes = [], sourceNodeId = "", targetNodeId = "" } = {}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (nodeById.get(sourceNodeId)?.type !== "plainText" || nodeById.get(targetNodeId)?.type !== "plainText") return false;

  const outgoing = new Map();
  edges.forEach((edge) => {
    const fromId = edge.from?.nodeId;
    const toId = edge.to?.nodeId;
    if (nodeById.get(fromId)?.type !== "plainText" || nodeById.get(toId)?.type !== "plainText") return;
    if (edge.to?.port !== "textIn") return;
    if (!outgoing.has(fromId)) outgoing.set(fromId, []);
    outgoing.get(fromId).push(toId);
  });

  const pending = [targetNodeId];
  const visited = new Set();
  while (pending.length) {
    const nodeId = pending.pop();
    if (nodeId === sourceNodeId) return true;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    pending.push(...(outgoing.get(nodeId) || []));
  }
  return false;
}
