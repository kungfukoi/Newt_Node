export function lookCatalogOptions(collections = [], showLocal = false, showFilmStills = false) {
  return [{ value: "all", label: "All" }, { value: "library", label: "Commercial" }, { value: "stylefinder", label: "StyleFinder" }, { value: "shared-user-looks", label: "User Looks" },
    ...(showFilmStills ? [{value:"film-stills",label:"Film Stills"}] : []),
    ...(showLocal ? [{value:"local-looks",label:"Local Looks"}] : []), { value: "starred", label: "Starred" },
    ...collections.filter(item => item.name.toLowerCase() !== "starred").map(item => ({ value: `collection:${item.id}`, label: item.name }))];
}

export function uniqueCatalogLooks(styles) {
  const seen = new Set();
  return styles.filter(style => {
    const keys = [style.id,style.catalogId].filter(Boolean).map(id=>`id:${id}`);
    if(style.sourceUrl)keys.push(`source:${style.sourceUrl}\n${style.name}`);
    const duplicate=keys.some(key=>seen.has(key));
    keys.forEach(key=>seen.add(key));
    return !duplicate;
  });
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
