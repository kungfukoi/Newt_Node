export function defaultNodeReferenceLabel(node) {
  return String(node?.data?.title || node?.type || "").trim();
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
  labelForNode = defaultNodeReferenceLabel
} = {}) {
  const sourceText = String(text || "");
  if (!sourceText || !Array.isArray(nodes) || !nodes.length) return [];

  const candidates = nodes
    .filter((node) => node?.id && node.id !== currentNodeId)
    .flatMap((node, nodeIndex) =>
      nodeReferenceNameVariants(node, labelForNode).map((name) => ({
        node,
        nodeIndex,
        name
      }))
    )
    .sort((first, second) => second.name.length - first.name.length || first.nodeIndex - second.nodeIndex);
  const occupied = [];
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
