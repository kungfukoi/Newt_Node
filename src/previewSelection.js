// Batch expansion is for processors. A viewer needs one producer with all of
// its results, rather than one synthetic source per entry.
export function groupPreviewConnections(connections = []) {
  const groups = new Map(), result = [];
  for (const connection of connections) {
    if (!connection.batchSource) { result.push(connection); continue; }
    const source = connection.batchSource;
    const key = `${source.id}:${connection.edge.from.port}`;
    let group = groups.get(key);
    if (!group) {
      group = { ...connection, source, legacyPreviewSources: [], entries: [] };
      groups.set(key, group); result.push(group);
    }
    group.legacyPreviewSources.push({ id: `${connection.source.id}:${connection.edge.from.port}`, url: connection.batchEntry?.url });
    if (connection.batchEntry) group.entries.push(connection.batchEntry);
  }
  return result.map(connection => {
    if (!connection.batchSource || connection.source.type !== "batch") return connection;
    const kind = connection.source.data?.batchMediaType || connection.entries[0]?.type || "image";
    return { ...connection, source: { ...connection.source, type: kind, data: { ...connection.source.data,
      resultType: kind, resultItems: connection.entries, resultUrl: connection.source.data?.resultUrl || connection.entries[0]?.url || "" } } };
  });
}

export function previewSelectionForNode(node, previewSources = []) {
  if (!previewSources.length) return { source: null, item: null, itemIndex: 0 };

  const data = node?.data || {};
  const source =
    selectedPreviewSource(previewSources, data.previewSourceId) ||
    previewSources.find((previewSource) => previewSource.items.some((item) => item.sourceSelectedResult)) ||
    previewSources.at(-1);
  const itemIndex = previewSelectedItemIndexForSource(node, source);

  return {
    source,
    item: source?.items?.[itemIndex] || null,
    itemIndex
  };
}

export function previewSelectedItemIndexForSource(node, source) {
  const items = source?.items || [];
  if (!items.length) return 0;

  const sourceSelectedIndex = items.findIndex((item) => item.sourceSelectedResult);
  if (sourceSelectedIndex >= 0) return sourceSelectedIndex;
  const savedIndex = Math.trunc(Number(node?.data?.previewItemIndex));
  const legacy = source?.legacyPreviewSources?.find(item => item.id === node?.data?.previewSourceId);
  if (legacy) {
    const index = items.findIndex(item => item.url === legacy.url);
    if (index >= 0) return index;
  }
  if (
    node?.data?.previewSourceId === source?.id &&
    Number.isInteger(savedIndex) &&
    savedIndex >= 0 &&
    savedIndex < items.length
  ) {
    return savedIndex;
  }

  return 0;
}

function selectedPreviewSource(sources = [], selectedId) {
  if (!sources.length || !selectedId) return null;
  return sources.find((source) => source.id === selectedId || source.legacyPreviewSources?.some(item => item.id === selectedId)) || null;
}
