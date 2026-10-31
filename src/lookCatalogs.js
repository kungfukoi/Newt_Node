export function lookCatalogOptions(collections = []) {
  return [{ value: "library", label: "Catalog" }, { value: "starred", label: "Starred" },
    ...collections.filter(item => item.name.toLowerCase() !== "starred").map(item => ({ value: `collection:${item.id}`, label: item.name }))];
}

export function lookSaveOptions(collections = []) {
  const starred = collections.find(item => item.name.toLowerCase() === "starred");
  return [{ value: starred?.id || "system-starred", label: "Starred" }, ...collections.filter(item => item !== starred).map(item => ({ value: item.id, label: item.name }))];
}

// Stars retain their existing saved-anywhere meaning; show each look only once.
export function starredCatalogLooks(collections = []) {
  const looks = new Map();
  for (const collection of collections) for (const style of collection.styles) {
    const identity = style.catalogId || (style.sourceUrl ? `${style.sourceUrl}\n${style.name}` : style.id);
    const previous = looks.get(identity);
    if (!previous || (!previous.styleAnalysis?.stylePrompt && style.styleAnalysis?.stylePrompt)) looks.set(identity, style);
  }
  return [...looks.values()];
}
