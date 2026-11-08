// Shared, model-neutral catalog contract. No Midjourney parameters enter other models.
import { lookStyleBlocks } from "./createLookStyle.js";
import { lookStyleText } from "./lookStyleText.js";
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
  try { const url = new URL(value.sourceUrl); if (url.protocol === "https:" && ["midlibrary.io","styleref.io"].includes(url.hostname) && !url.username && !url.password) sourceUrl = url.href; } catch { /* Optional source. */ }
  return {
    id: text(value.id, 80), name: text(value.name, 120), prompt: text(value.prompt), category: text(value.category, 80), catalogId: text(value.catalogId, 80),
    notes: value.sourceProvider==="Newt"?lookStyleText(text(value.notes,4000)):text(value.notes, 4000), sourceUrl, sourceProvider: text(value.sourceProvider,80), sourceAuthor: text(value.sourceAuthor,120), sourceAttribution: text(value.sourceAttribution,200),
    ...(Array.isArray(value.styleBlocks)?{styleBlocks:lookStyleBlocks(value.styleBlocks)}:{}),
    colours: (Array.isArray(value.colours) ? value.colours : []).filter(colour => typeof colour?.hex === "string" && /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(colour.hex)).slice(0,20).map(colour => ({ name: text(colour.name,80), hex: colour.hex, percent: typeof colour.percent === "number" && Number.isFinite(colour.percent) && colour.percent>=0 && colour.percent<=100 ? colour.percent : null })),
    styleAnalysis: value.styleAnalysis?.stylePrompt ? {
      stylePrompt: lookStyleText(text(value.styleAnalysis.stylePrompt, 6000)), fingerprint: text(value.styleAnalysis.fingerprint, 64),
      model: text(value.styleAnalysis.model, 120), provider: text(value.styleAnalysis.provider, 80),
      createdAt: text(value.styleAnalysis.createdAt, 40), version: Number(value.styleAnalysis.version) || 1
    } : null,
    sref: text(value.sref, 300), tags: (Array.isArray(value.tags) ? value.tags : []).map(tag => text(tag, 80)).filter(Boolean).slice(0, 40),
    examples: (Array.isArray(value.examples) ? value.examples : []).filter(image => /^\/(uploads|workflow-assets|outputs)\//.test(image?.localUrl || "") && !image.localUrl.includes("..") && !/[?#\\]/.test(image.localUrl)).slice(0, 8).map(image => {
      // This is an identity for reusing an import, never a fetch target.
      const catalogUrl = typeof image.catalogUrl === "string" && image.catalogUrl.length <= 2048 ? image.catalogUrl : "";
      return { id: text(image.id, 80), localUrl: image.localUrl, fileName: text(image.fileName, 200), mimeType: text(image.mimeType, 80), ...(catalogUrl ? { catalogUrl } : {}) };
    })
  };
}
export function portableStylePrompt(value = "") {
  return text(value).replace(/--[a-z][\w-]*(?:\s+(?!--)[^\s]+)*/gi, "").trim();
}
export function libraryStyleSnapshot(style) {
  const value = normalizeLibraryStyle(style);
  const { catalogUrl: _catalogUrl, ...gradeReference } = value.examples[0] || normalizeLibraryStyle({ examples: [style?.gradeReference] }).examples[0] || {};
  return { id: value.id, name: value.name, prompt: lookStyleText(portableStylePrompt(value.styleAnalysis?.stylePrompt || value.prompt)), sourceUrl: value.sourceUrl, sref: value.sref,
    ...(gradeReference.localUrl ? { gradeReference } : {}) };
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
