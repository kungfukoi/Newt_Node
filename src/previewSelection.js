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

  const savedIndex = Math.trunc(Number(node?.data?.previewItemIndex));
  if (
    node?.data?.previewSourceId === source?.id &&
    Number.isInteger(savedIndex) &&
    savedIndex >= 0 &&
    savedIndex < items.length
  ) {
    return savedIndex;
  }

  const sourceSelectedIndex = items.findIndex((item) => item.sourceSelectedResult);
  return sourceSelectedIndex >= 0 ? sourceSelectedIndex : 0;
}

function selectedPreviewSource(sources = [], selectedId) {
  if (!sources.length || !selectedId) return null;
  return sources.find((source) => source.id === selectedId) || null;
}
