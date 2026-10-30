// Shared, model-neutral catalog contract. No Midjourney parameters enter other models.
export const librarySchemaVersion = 1;
const text = (value, max = 12000) => typeof value === "string" ? value.trim().slice(0, max) : "";
export function midlibrarySearchUrl({ query = "", terms = [], colours = [], category = "" } = {}) {
  const url = new URL("https://midlibrary.io/library");
  if (text(query, 200)) url.searchParams.set("q", text(query, 200));
  if (/^[a-z0-9-]+$/.test(category)) url.searchParams.set("category", category);
  for (const term of terms) if (/^[a-z0-9-]+$/.test(term)) url.searchParams.append("term", term);
  for (const colour of colours) if (/^[a-z0-9-]+$/.test(colour)) url.searchParams.append("colour", colour);
  url.searchParams.set("sort", "popular");
  return url.href;
}
export function normalizeLibraryStyle(value = {}) {
  let sourceUrl = "";
  try { const url = new URL(value.sourceUrl); if (url.protocol === "https:" && url.hostname === "midlibrary.io") sourceUrl = url.href; } catch { /* Optional source. */ }
  return {
    id: text(value.id, 80), name: text(value.name, 120), prompt: text(value.prompt),
    notes: text(value.notes, 4000), sourceUrl,
    sref: text(value.sref, 300), tags: (Array.isArray(value.tags) ? value.tags : []).map(tag => text(tag, 80)).filter(Boolean).slice(0, 40),
    examples: (Array.isArray(value.examples) ? value.examples : []).filter(image => /^\/(uploads|workflow-assets|outputs)\//.test(image?.localUrl || "") && !image.localUrl.includes("..") && !/[?#\\]/.test(image.localUrl)).slice(0, 8).map(image => ({ id: text(image.id, 80), localUrl: image.localUrl, fileName: text(image.fileName, 200), mimeType: text(image.mimeType, 80) }))
  };
}
export function portableStylePrompt(value = "") {
  return text(value).replace(/--[a-z][\w-]*(?:\s+(?!--)[^\s]+)*/gi, "").trim();
}
export function libraryStyleSnapshot(style) {
  const value = normalizeLibraryStyle(style);
  return { id: value.id, name: value.name, prompt: portableStylePrompt(value.prompt), sourceUrl: value.sourceUrl, sref: value.sref };
}
export function libraryPrompt(data = {}) { return portableStylePrompt(data.libraryStyle?.prompt); }
export function libraryStylesMatching(styles, query = "") {
  const words = text(query, 300).toLowerCase().split(/\s+/).filter(Boolean);
  return styles.filter(style => words.every(word => [style.name, style.prompt, style.notes, ...(style.tags || [])].join(" ").toLowerCase().includes(word)));
}
export function collectionExamples(styles) {
  const seen = new Set();
  return styles.flatMap(style => style.examples || []).filter(image => { if (seen.has(image.localUrl)) return false; seen.add(image.localUrl); return true; });
}
