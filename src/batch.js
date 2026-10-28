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

export function validateBatchEntries(entries) {
  if (!entries.length) throw new Error("Add media to the Batch before running.");
  if (entries.length > 100) throw new Error("This audition supports up to 100 batch entries.");
  const missing = entries.find(item => !item.url);
  if (missing) throw new Error(`Batch source “${missing.label}” has no media. Generate or reconnect it before running.`);
  if (new Set(entries.map(item => item.type || "image")).size > 1) throw new Error("A Batch must contain images or videos, not both.");
  return entries;
}

export function isBatchConnection(connection) {
  return connection?.source?.type === "batch" || (connection?.edge?.from?.port === "batchOut" && Array.isArray(connection?.source?.data?.batchResults));
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

// Expose the paired output as soon as a media Batch is connected, so a new
// chain can be wired before making any paid Text Agent request.
export function initializeTextAgentBatches(nodes, edges) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  let changed = false;
  for (let pass = 0; pass < nodes.length; pass++) {
    let added = false;
    const assigned = new Set();
    for (const edge of edges) {
      const source = byId.get(edge.from.nodeId), target = byId.get(edge.to.nodeId);
      if (target?.type !== "textAgent" || edge.from.port !== "batchOut" || !["imageIn", "videoIn"].includes(edge.to.port)) continue;
      if (source?.type !== "batch" && !Array.isArray(source?.data?.batchResults)) continue;
      if (assigned.has(target.id)) continue;
      assigned.add(target.id);
      const kind = edge.to.port === "videoIn" ? "video" : "image";
      if (Array.isArray(target.data?.batchResults) && target.data.batchMediaType === kind) continue;
      byId.set(target.id, { ...target, data: { ...target.data, batchResults: target.data?.batchResults || [], batchMediaType: kind } });
      changed = added = true;
    }
    if (!added) break;
  }
  return changed ? nodes.map(node => byId.get(node.id)) : nodes;
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
      if (!["batchOut", "promptOut"].includes(edge.from.port)) continue;
      const source = byId.get(edge.from.nodeId);
      if (source?.type !== "textAgent" || !(incoming.get(source.id) || []).some(input => input.from.port === "batchOut")) continue;
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
      resultItems: entry.url ? [{ ...entry, type: entry.type || "image" }] : [], selectedResultIndex: 0 } };
}

export function buildBatchPlan(connections, incomingByNode, resolve) {
  const collections = connections.map(({ source }) => ({ source, entries: validateBatchEntries(batchInputEntries(source, incomingByNode, resolve)) }));
  const count = Math.max(...collections.map(item => item.entries.length));
  if (collections.some(item => item.entries.length !== 1 && item.entries.length !== count)) throw new Error("Connected batches must have matching lengths, or contain a single shared entry.");
  return Array.from({ length: count }, (_, runIndex) => {
    const inputs = collections.map(({ source, entries }) => ({ batchId: source.id, entry: entries[entries.length === 1 ? 0 : runIndex] }));
    const first = inputs[0].entry;
    return { ...first, runIndex, variation: 0, inputs, prompt: inputs.map(item => item.entry.prompt).filter(Boolean).join("\n\n") };
  });
}

export function materializeBatchGraph(nodes, edges, targetId, inputs) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const replacements = new Map(inputs.map(({ batchId, entry }) => [batchId, batchEntrySource(nodeMap.get(batchId), entry)]));
  // A paired text processor's promptOut is the aggregate display text. Its
  // matching entry prompt is supplied separately by the batch runner.
  const pairedTextIds = new Set(inputs.filter(({ batchId }) => ["text", "textAgent", "skillDirector"].includes(nodeMap.get(batchId)?.type)).map(({ batchId }) => batchId));
  return { nodes: [...nodes, ...replacements.values()], edges: edges.filter(edge =>
    !(edge.to.nodeId === targetId && edge.from.port === "promptOut" && pairedTextIds.has(edge.from.nodeId))
  ).map(edge => {
    const source = edge.to.nodeId === targetId && edge.from.port === "batchOut" ? replacements.get(edge.from.nodeId) : null;
    return source ? { ...edge, from: { nodeId: source.id, port: source.type === "video" ? "videoOut" : "imageOut" } } : edge;
  }) };
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
