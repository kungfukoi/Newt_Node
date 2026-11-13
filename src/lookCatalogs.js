export const findStarredCatalog = (collections = []) => collections.find(item => item.name.toLowerCase() === "starred");

export function sameLook(first, second) {
  return first.id === second.id ||
    (first.catalogId || first.id) === (second.catalogId || second.id) ||
    Boolean(first.sourceUrl && first.sourceUrl === second.sourceUrl && first.name === second.name);
}

function lookIdentityKeys(style) {
  const keys = [style.id, style.catalogId].filter(Boolean).map(id => `id:${id}`);
  if (style.sourceUrl) keys.push(`source:${style.sourceUrl}\n${style.name}`);
  return keys;
}

export function lookSourceOptions(showLocal = false, showFilmStills = false) {
  return [{ value: "all", label: "All Sources" }, { value: "library", label: "Commercial" }, { value: "stylefinder", label: "StyleFinder" }, { value: "shared-user-looks", label: "User Looks" },
    ...(showFilmStills ? [{value:"film-stills",label:"Film Stills"}] : []),
    ...(showLocal ? [{value:"local-looks",label:"Local Looks"}] : [])];
}

export function namedLookCollections(collections = []) {
  return collections.filter(item => item.name.toLowerCase() !== "starred");
}

export function lookLibraryOptions(collections = []) {
  return [{ value: "saved", label: "All Saved" }, { value: "starred", label: "Starred" },
    ...namedLookCollections(collections).map(item => ({ value: `collection:${item.id}`, label: item.name }))];
}

export function shuffleCatalogLooks(styles) {
  const shuffled = [...styles];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function uniqueCatalogLooks(styles) {
  const seen = new Set();
  return styles.filter(style => {
    const keys = lookIdentityKeys(style);
    const duplicate=keys.some(key=>seen.has(key));
    keys.forEach(key=>seen.add(key));
    return !duplicate;
  });
}

// Prefer a copy with saved analysis when combining collections for the Style picker.
export function allSavedCatalogLooks(collections = []) {
  const aliases = new Map();
  const looks = new Set();
  for (const collection of collections) for (const style of collection.styles) {
    const keys = lookIdentityKeys(style);
    const matches = new Set(keys.map(key => aliases.get(key)).filter(Boolean));
    const group = matches.values().next().value || { style, keys: new Set() };
    looks.add(group);
    for (const match of matches) {
      if (match === group) continue;
      if (!group.style.styleAnalysis?.stylePrompt && match.style.styleAnalysis?.stylePrompt) group.style = match.style;
      for (const key of match.keys) {
        group.keys.add(key);
        aliases.set(key, group);
      }
      looks.delete(match);
    }
    if (!group.style.styleAnalysis?.stylePrompt && style.styleAnalysis?.stylePrompt) group.style = style;
    for (const key of keys) {
      group.keys.add(key);
      aliases.set(key, group);
    }
  }
  return Array.from(looks, group => group.style);
}
