export function imageLayerDraftKey(workflow, sourceUrl) {
  const project = workflow?.workflowPackageId || workflow?.projectId || workflow?.workflowFileName || "";
  return "newtnode:image-layers:" + JSON.stringify([project, sourceUrl]);
}

export function readImageLayerDraft(key) {
  try {
    const stored = JSON.parse(globalThis.localStorage.getItem(key));
    if (stored?.schema === 1 && Array.isArray(stored.results) && Array.isArray(stored.drafts)) {
      stored.results = stored.results.filter(result => typeof result?.url === "string");
      stored.drafts = stored.drafts.filter(entry => Array.isArray(entry) && typeof entry[0] === "string" &&
        Array.isArray(entry[1]?.layers) && entry[1].layers.every(layer => typeof layer?.url === "string" && typeof layer.name === "string"));
      return stored;
    }
  } catch { /* Missing or unreadable storage opens an empty editor. */ }
  return { schema: 1, results: [], drafts: [] };
}

export function saveImageLayerDraft(key, { results = [], stackKey, draft, replaceResults = false }) {
  const stored = readImageLayerDraft(key);
  if (replaceResults) {
    const retired = new Set(stored.results.filter(result => result.layerGroup && result.layerGroup !== stackKey).map(result => result.layerGroup));
    stored.results = stored.results.filter(result => !result.layerGroup);
    stored.drafts = stored.drafts.filter(([key]) => !retired.has(key));
  }
  const known = new Set(stored.results.map(result => result.url));
  for (const result of results) {
    if (known.has(result.url)) {
      if (replaceResults && result.layerGroup) stored.results = stored.results.map(entry => entry.url === result.url ? result : entry);
      continue;
    }
    known.add(result.url);
    stored.results.push(result);
  }
  if (draft) {
    const drafts = new Map(stored.drafts);
    drafts.set(stackKey, draft);
    stored.drafts = [...drafts];
  }
  if (stackKey) stored.lastStack = stackKey;
  globalThis.localStorage.setItem(key, JSON.stringify(stored));
}
