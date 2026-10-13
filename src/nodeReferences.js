export function defaultNodeReferenceLabel(node) {
  return String(node?.data?.title || node?.type || "").trim();
}

const upstreamIndexes = new WeakMap();

// Cache per immutable graph snapshot; groups/positions never establish access.
export function upstreamReferenceNodeIds(nodes = [], edges = [], currentNodeId = "") {
  if (!currentNodeId || !Array.isArray(nodes) || !Array.isArray(edges)) return new Set();
  let byNodes = upstreamIndexes.get(edges);
  if (!byNodes) { byNodes = new WeakMap(); upstreamIndexes.set(edges, byNodes); }
  let index = byNodes.get(nodes);
  if (!index) {
    const ids = new Set(nodes.map(node => node?.id).filter(Boolean));
    const parents = new Map();
    for (const edge of edges) {
      const source = edge?.from?.nodeId, target = edge?.to?.nodeId;
      if (!ids.has(source) || !ids.has(target)) continue;
      if (!parents.has(target)) parents.set(target, []);
      parents.get(target).push(source);
    }
    index = { parents, ancestors: new Map() };
    byNodes.set(nodes, index);
  }
  if (!index.ancestors.has(currentNodeId)) {
    const visited = new Set([currentNodeId]), pending = [currentNodeId];
    while (pending.length) {
      for (const parent of index.parents.get(pending.pop()) || []) {
        if (visited.has(parent)) continue;
        visited.add(parent); pending.push(parent);
      }
    }
    visited.delete(currentNodeId);
    index.ancestors.set(currentNodeId, visited);
  }
  return index.ancestors.get(currentNodeId);
}

export function nodeReferenceNameVariants(node, labelForNode = defaultNodeReferenceLabel) {
  const rawLabel = normalizeReferenceWhitespace(labelForNode(node));
  if (!rawLabel) return [];

  const compact = rawLabel.replace(/[^A-Za-z0-9_-]+/g, "");
  const dashed = rawLabel
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return [...new Set([rawLabel, compact, dashed].filter((value) => value.length >= 2))];
}

export function findNodeReferenceMentions(text, nodes = [], {
  currentNodeId = "",
  labelForNode = defaultNodeReferenceLabel,
  bindings = {},
  rankForNode = null,
  edges = [],
  scopeNodeId = currentNodeId
} = {}) {
  const sourceText = String(text || "");
  if (!sourceText || !Array.isArray(nodes) || !nodes.length) return [];

  const upstream = scopeNodeId ? upstreamReferenceNodeIds(nodes, edges, scopeNodeId) : null;
  const availableNodes = nodes.filter((node) => node?.id && node.id !== currentNodeId && (!upstream || upstream.has(node.id)));
  const nodesById = new Map(availableNodes.map((node) => [node.id, node]));
  const boundIds = new Map(Object.entries(bindings || {}).map(([alias, id]) => [nodeReferenceBindingKey(alias), id]));
  const boundCandidates = Object.entries(bindings || {}).flatMap(([name, nodeId]) => {
    const node = nodesById.get(nodeId);
    if (!node || !normalizeReferenceWhitespace(name)) return [];
    return [{
      node,
      nodeIndex: nodes.indexOf(node),
      name: normalizeReferenceWhitespace(name).replace(/^@/, ""),
      bound: true
    }];
  });
  const candidates = [
    ...boundCandidates,
    ...availableNodes.flatMap((node, nodeIndex) =>
      nodeReferenceNameVariants(node, labelForNode)
        .filter(name => !boundIds.has(nodeReferenceBindingKey(name)) || boundIds.get(nodeReferenceBindingKey(name)) === node.id)
        .map((name) => ({
          node,
          nodeIndex,
          name,
          bound: false
        }))
    )
  ].sort((first, second) => {
    if (second.name.length !== first.name.length) return second.name.length - first.name.length;
    if (first.bound !== second.bound) return first.bound ? -1 : 1;
    const firstRank = typeof rankForNode === "function" ? Number(rankForNode(first.node)) || 0 : 0;
    const secondRank = typeof rankForNode === "function" ? Number(rankForNode(second.node)) || 0 : 0;
    return secondRank - firstRank || first.nodeIndex - second.nodeIndex;
  });
  const occupied = [];
  // Reserve disconnected bound tokens so a shorter connected title cannot
  // reinterpret part of the saved token (e.g. @Hero inside @Hero Product).
  for (const [alias, nodeId] of Object.entries(bindings || {})) {
    if (nodesById.has(nodeId) || !nodeReferenceBindingKey(alias)) continue;
    const pattern = nodeReferencePattern(normalizeReferenceWhitespace(alias).replace(/^@/, ""));
    let match;
    while ((match = pattern.exec(sourceText))) {
      const start = match.index + (match[1] || "").length;
      occupied.push({ start, end: match.index + match[0].length });
    }
  }
  const mentions = [];

  candidates.forEach((candidate) => {
    const pattern = nodeReferencePattern(candidate.name);
    let match;
    while ((match = pattern.exec(sourceText))) {
      const prefix = match[1] || "";
      const start = match.index + prefix.length;
      const end = start + match[0].length - prefix.length;
      if (rangesOverlap(occupied, start, end)) continue;

      occupied.push({ start, end });
      mentions.push({
        node: candidate.node,
        nodeId: candidate.node.id,
        name: normalizeReferenceWhitespace(labelForNode(candidate.node)) || candidate.name,
        mention: sourceText.slice(start, end),
        start,
        end
      });
    }
  });

  return mentions.sort((first, second) => first.start - second.start || first.end - second.end);
}

export function nodeReferenceBindingKey(value) {
  return normalizeReferenceWhitespace(value).replace(/^@/, "").toLowerCase();
}

export function replaceNodeReferenceToken(text, previousName, nextName) {
  const sourceText = String(text || "");
  const previous = normalizeReferenceWhitespace(previousName).replace(/^@/, "");
  const next = normalizeReferenceWhitespace(nextName).replace(/^@/, "");
  if (!sourceText || !previous || !next) return sourceText;
  return sourceText.replace(nodeReferencePattern(previous), (match, prefix = "") => `${prefix}@${next}`);
}

export function renameBoundNodeReferenceTokenInData(data = {}, sourceNodeId = "", nextName = "") {
  const nextLabel = normalizeReferenceWhitespace(nextName).replace(/^@/, "");
  if (!sourceNodeId || !nextLabel) return data;
  const bindings = data?.nodeReferenceBindings || {};
  const aliases = Object.entries(bindings)
    .filter(([, nodeId]) => nodeId === sourceNodeId)
    .map(([alias]) => alias);
  if (!aliases.length) return data;

  const nextBindings = Object.fromEntries(
    Object.entries(bindings).filter(([, nodeId]) => nodeId !== sourceNodeId)
  );
  nextBindings[nodeReferenceBindingKey(nextLabel)] = sourceNodeId;
  return {
    ...replaceBoundReferenceTokens(data, aliases, nextLabel),
    nodeReferenceBindings: nextBindings
  };
}

function replaceBoundReferenceTokens(value, aliases, nextLabel, key = "") {
  if (key === "nodeReferenceBindings") return value;
  if (typeof value === "string") {
    return aliases.reduce((text, alias) => replaceNodeReferenceToken(text, alias, nextLabel), value);
  }
  if (Array.isArray(value)) return value.map((item) => replaceBoundReferenceTokens(item, aliases, nextLabel));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, item]) => [
        entryKey,
        replaceBoundReferenceTokens(item, aliases, nextLabel, entryKey)
      ])
    );
  }
  return value;
}

function nodeReferencePattern(name) {
  const escapedName = escapeRegExp(normalizeReferenceWhitespace(name)).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^A-Za-z0-9_])@${escapedName}(?=$|[^A-Za-z0-9_])`, "gi");
}

function normalizeReferenceWhitespace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function rangesOverlap(ranges, start, end) {
  return ranges.some((range) => start < range.end && end > range.start);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
