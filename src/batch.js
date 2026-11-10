// Entries are identified by their live source connection, never by list position.
export function batchConnectionKey(connection) {
  return `${connection.source.id}:${connection.edge.from.port}`;
}

export function batchEntries(node, connections = [], resolve = source => source.data?.resultUrl || source.data?.assetUrl || "") {
  if (node.type !== "batch" && Array.isArray(node.data?.batchResults)) return node.data.batchResults;
  const settings = node.data?.batchSettings || {};
  const linked = connections.map(connection => {
    const id = batchConnectionKey(connection);
    const item = resolve(connection.source, connection.edge);
    return { ...(item && typeof item === "object" ? item : {}), id, sourceNodeId: connection.source.id, sourcePort: connection.edge.from.port,
      url: typeof item === "string" ? item : item?.url || "", type: item?.type || (connection.edge.to?.port === "videoIn" ? "video" : "image"), label: connection.source.data?.title || "Linked media",
      ...settings[id], linked: true };
  });
  const files = (node.data?.batchFiles || []).map(item => ({ ...item, ...settings[item.id], linked: false }));
  const order = node.data?.batchOrder || [];
  return [...linked, ...files].sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
  });
}

export function validateBatchEntries(entries, source) {
  if (!entries.length) {
    if (!source || source.type === "batch") throw new Error("Add media to the Batch before running.");
    const name = source.data?.title ? `“${source.data.title}”` : "the connected node";
    const output = source.type === "textAgent" ? "batch prompts" : "batch results";
    throw new Error(`Run ${name} to produce ${output}, then run this node again.`);
  }
  if (entries.length > 100) throw new Error("This audition supports up to 100 batch entries.");
  const missing = entries.find(item => !item.url);
  if (missing) throw new Error(`Batch source “${missing.label}” has no media. Generate or reconnect it before running.`);
  if (new Set(entries.map(item => item.type || "image")).size > 1) throw new Error("A Batch must contain images or videos, not both.");
  return entries;
}

export function isBatchConnection(connection) {
  if (connection?.useSelectedResult) return false;
  return connection?.source?.type === "batch" || Array.isArray(connection?.source?.data?.batchResults);
}

export function batchInputConnections(incoming = {}) {
  const found = new Map();
  for (const connections of Object.values(incoming)) for (const connection of connections || []) {
    const source = connection.batchSource || (isBatchConnection(connection) ? connection.source : null);
    if (source) found.set(source.id, { ...connection, source });
  }
  return [...found.values()];
}

export function representativeBatchIncoming(incoming = {}) {
  return Object.fromEntries(Object.entries(incoming).map(([port, connections]) => {
    const seen = new Set();
    return [port, connections.filter(connection => {
      if (!connection.batchSource) return true;
      if (seen.has(connection.batchSource.id)) return false;
      seen.add(connection.batchSource.id); return true;
    })];
  }));
}

export function batchInputEntries(source, incomingByNode, resolve) {
  return batchEntries(source, [...(incomingByNode[source.id]?.imageIn || []), ...(incomingByNode[source.id]?.videoIn || [])], resolve);
}

export function batchMediaType(node) {
  return node?.data?.batchMediaType || node?.data?.batchFiles?.[0]?.type || node?.data?.batchResults?.[0]?.type || "image";
}

// Trace live collection inputs through Text Agent chains. A saved result from
// an agent whose batch was disconnected cannot start another chain.
function textAgentBatchKinds(nodes, edges) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const kinds = new Map();
  for (let pass = 0; pass < nodes.length; pass++) {
    let added = false;
    for (const edge of edges) {
      const source = byId.get(edge.from.nodeId), target = byId.get(edge.to.nodeId);
      if (target?.type !== "textAgent" || kinds.has(target.id)) continue;
      const kind = source?.type === "textAgent" ? kinds.get(source.id)
        : isBatchConnection({ source }) ? batchMediaType(source) : "";
      if (!kind) continue;
      kinds.set(target.id, kind);
      added = true;
    }
    if (!added) break;
  }
  return kinds;
}

// Carry pending context through ordinary Prompt connections before any requests.
export function initializeTextAgentBatches(nodes, edges) {
  const kinds = textAgentBatchKinds(nodes, edges);
  let changed = false;
  const ready = nodes.map(node => {
    const kind = kinds.get(node.id);
    if (!kind || (Array.isArray(node.data?.batchResults) && node.data.batchMediaType === kind)) return node;
    changed = true;
    return { ...node, data: { ...node.data, batchResults: node.data?.batchResults || [], batchMediaType: kind } };
  });
  return changed ? ready : nodes;
}

export function batchPromptSummary(entries = []) {
  return entries.map(item => `${item.label}\n${item.prompt}`).join("\n\n");
}

export function standaloneTextAgentPrompt(data) {
  if (data.batchResults?.length && data.resultText === batchPromptSummary(data.batchResults)) return "";
  return data.resultText;
}

export function resolveTextAgentBatchOutputs(nodes, edges) {
  if (!nodes.some(node => node.type === "textAgent" && Array.isArray(node.data?.batchResults))) return nodes;
  const kinds = textAgentBatchKinds(nodes, edges);
  return nodes.map(node => {
    if (node.type !== "textAgent" || !Array.isArray(node.data?.batchResults) || kinds.has(node.id)) return node;
    const resultText = standaloneTextAgentPrompt(node.data);
    return { ...node, data: { ...node.data, batchResults: undefined, resultText,
      ...(resultText !== node.data.resultText ? { agentDraft: "" } : {}) } };
  });
}

// UI estimates must include an unrun agent's sources, rather than disabling
// the consumer because its prompts have not been generated yet.
export function batchInputEntryCount(source, incomingByNode, resolve, seen = new Set()) {
  if (seen.has(source.id)) return 0;
  seen = new Set(seen).add(source.id);
  if (source.type === "textAgent") {
    const inputs = batchInputConnections(incomingByNode[source.id]);
    if (inputs.length) return Math.max(...inputs.map(input => batchInputEntryCount(input.source, incomingByNode, resolve, seen)));
  }
  return batchInputEntries(source, incomingByNode, resolve).length;
}

export function upstreamBatchTextAgents(targetId, nodes, edges) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const incoming = new Map();
  for (const edge of edges) {
    if (!incoming.has(edge.to.nodeId)) incoming.set(edge.to.nodeId, []);
    incoming.get(edge.to.nodeId).push(edge);
  }
  const visiting = new Set([targetId]), visited = new Set(), ordered = [];
  function visit(id) {
    for (const edge of incoming.get(id) || []) {
      const source = byId.get(edge.from.nodeId);
      if (source?.type !== "textAgent" || !(incoming.get(source.id) || []).some(input => input.from.port === "batchOut" || isBatchConnection({ source: byId.get(input.from.nodeId), edge: input }))) continue;
      if (visiting.has(source.id)) throw new Error("Batch Text Agent connections contain a cycle.");
      if (visited.has(source.id)) continue;
      visiting.add(source.id); visit(source.id); visiting.delete(source.id);
      visited.add(source.id); ordered.push(source);
    }
  }
  visit(targetId);
  return ordered;
}

export function batchEntrySource(batch, entry) {
  return { id: `${batch.id}:entry:${entry.id}`, type: entry.type || "image", x: batch.x, y: batch.y,
    data: { title: entry.label || batch.data?.title, resultUrl: entry.url || "", resultType: entry.type || "image",
      metadata: entry.metadata, duration: entry.duration, width: entry.width, height: entry.height, thumbnailUrl: entry.thumbnailUrl, fileName: entry.fileName, mimeType: entry.mimeType,
      resultText: entry.prompt || "", resultItems: entry.url ? [{ ...entry, type: entry.type || "image" }] : [], selectedResultIndex: 0 } };
}

export function buildBatchPlan(connections, incomingByNode, resolve) {
  const collections = connections.map(({ source }) => ({ source, entries: validateBatchEntries(batchInputEntries(source, incomingByNode, resolve), source) }));
  const count = Math.max(...collections.map(item => item.entries.length));
  if (collections.some(item => item.entries.length !== 1 && item.entries.length !== count)) throw new Error("Connected batches must have matching lengths, or contain a single shared entry.");
  return Array.from({ length: count }, (_, runIndex) => {
    const inputs = collections.map(({ source, entries }) => ({ batchId: source.id, entry: entries[entries.length === 1 ? 0 : runIndex] }));
    const first = inputs[0].entry;
    return { ...first, runIndex, variation: 0, inputs, prompt: inputs.map(item => item.entry.prompt).filter(Boolean).join("\n\n") };
  });
}

export function materializeBatchGraph(nodes, edges, targetId, inputs, mediaInputPort = () => "") {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const replacements = new Map(inputs.map(({ batchId, entry }) => [batchId, batchEntrySource(nodeMap.get(batchId), entry)]));
  // A paired text processor's promptOut is the aggregate display text. Its
  // matching entry prompt is supplied separately by the batch runner.
  const pairedTextIds = new Set(inputs.filter(({ batchId }) => ["text", "textAgent", "skillDirector"].includes(nodeMap.get(batchId)?.type)).map(({ batchId }) => batchId));
  const materialized = [];
  for (const edge of edges) {
    const replacement = edge.to.nodeId === targetId ? replacements.get(edge.from.nodeId) : null;
    if (!replacement) { materialized.push(edge); continue; }
    if (pairedTextIds.has(edge.from.nodeId) && edge.from.port === "promptOut") {
      // The matching prompt is supplied by the runner. Carry its original media
      // through the consumer's normal media input only in this private graph.
      const port = mediaInputPort(nodeMap.get(targetId), replacement.type, edge.batchMediaInputPort);
      if (port && !edges.some(other => other.to.nodeId === targetId && other.to.port === port && replacements.has(other.from.nodeId))) {
        materialized.push({ ...edge, to: { ...edge.to, port }, from: { nodeId: replacement.id, port: replacement.type === "video" ? "videoOut" : "imageOut" } });
      }
      continue;
    }
    materialized.push({ ...edge, from: { nodeId: replacement.id, port: replacement.type === "video" ? "videoOut" : "imageOut" } });
  }
  return { nodes: [...nodes, ...replacements.values()], edges: materialized };
}

// Saved special outputs become the node's established output, retaining edge IDs.
export function migrateBatchOutputEdge(edge, source, target, normalOutput, promptInput) {
  if (edge.from.port !== "batchOut" || source?.type === "batch" || !normalOutput) return edge;
  const text = ["text", "textAgent"].includes(source?.type);
  return { ...edge, from: { ...edge.from, port: normalOutput },
    ...(text && promptInput && edge.to.port !== promptInput ? { batchMediaInputPort: edge.to.port } : {}),
    to: text && promptInput ? { ...edge.to, port: promptInput } : edge.to };
}

export function batchChildNode(node, entry, preparation) {
  return { ...node, data: { ...node.data, status: "ready", title: node.data.title + " · " + entry.label,
    resultItems: [], resultUrl: "", resultText: "", batchResults: [], batchRetryEntry: null, batchFailedEntries: [],
    ...(node.type === "textAgent" ? { agentMessages: [], textPromptHistoryIndex: null, textPromptHistoryDraft: "" } : {}),
    ...(preparation ? { videoOutpaintPrepared: preparation } : {}),
    ...(["text", "skillDirector"].includes(node.type) ? { text: [node.data.text, entry.prompt].filter(Boolean).join("\n\n") } : {}) } };
}

export async function runBatchEntries(entries, { run, stopped = () => false, onResult = () => {}, concurrency = 3 }) {
  const results = new Array(entries.length);
  let cursor = 0;
  async function worker() {
    while (!stopped() && cursor < entries.length) {
      const index = cursor++;
      try { results[index] = { status: "fulfilled", value: await run(entries[index], index) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
      onResult(results.filter(Boolean), index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(entries.length, concurrency) }, worker));
  return results.filter(Boolean);
}
