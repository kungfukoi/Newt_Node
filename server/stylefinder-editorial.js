import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import { parse } from "parse5";

const attrs = node => Object.fromEntries((node?.attrs || []).map(item => [item.name, item.value]));
const has = (node, name) => (attrs(node).class || "").split(/\s+/).includes(name);
const children = node => node?.childNodes || [];
const ignored = new Set(["script", "style", "svg", "button", "form", "iframe", "nav", "footer", "noscript"]);
const text = node => ignored.has(node?.nodeName) ? "" : node?.nodeName === "#text" ? node.value : children(node).map(text).join("");
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const all = (node, test) => node ? [...(test(node) ? [node] : []), ...children(node).flatMap(child => all(child, test))] : [];
const first = (node, test) => all(node, test)[0];
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const editorialSections = [
  { id: "guides", title: "Guides", description: "Techniques, tools, and creative approaches.", file: "midguide/midjourney-guides.html" },
  { id: "compilations", title: "Compilations", description: "Curated collections of styles and visual ideas.", file: "midguide/midjounrey-styles-and-sref-codes-compilations.html" },
  { id: "in-focus", title: "In Focus", description: "Explore the character and possibilities of a style.", file: "midguide/midjourney-styles-in-focus-series.html" }
];
const articlePath = /^(midguide|tops|focus|midlibrary-recommends)\/[a-z0-9-]+\.html$/;
function localPath(value, file) {
  if (!value || /^(?:[a-z]+:|\/\/)/i.test(value) || /[\\\x00]/.test(value)) return "";
  let decoded; try { decoded = decodeURIComponent(value.split(/[?#]/)[0]); } catch { return ""; }
  const resolved = path.posix.normalize(decoded.startsWith("/") ? decoded.slice(1) : path.posix.join(path.posix.dirname(file), decoded));
  return resolved.startsWith("../") ? "" : resolved;
}
function image(node, file) {
  const relative = localPath(attrs(node).src, file);
  return /^img\/.+\.(jpe?g|png|webp)$/i.test(relative) ? { url: `/api/style-library/catalog-image?file=${encodeURIComponent(relative)}`, alt: clean(attrs(node).alt) } : null;
}
function link(href, file) {
  const relative = localPath(href, file);
  const section = editorialSections.find(item => item.file === relative);
  if (section) return { type: "section", id: section.id };
  if (/^library\/[a-z0-9-]+\.html$/.test(relative)) return { type: "look", id: path.posix.basename(relative, ".html") };
  return articlePath.test(relative) ? { type: "article", id: relative } : null;
}
function runs(node, file, inherited = null) {
  if (ignored.has(node?.nodeName)) return [];
  if (node?.nodeName === "#text") return [{ text: node.value, ...(inherited ? { link: inherited } : {}) }];
  if (node?.nodeName === "br") return [{ text: "\n" }];
  const target = node?.nodeName === "a" ? link(attrs(node).href, file) : inherited;
  return children(node).flatMap(child => runs(child, file, target)).slice(0, 1000);
}
export function parseEditorialList(html, file) {
  return all(parse(html), node => node.nodeName === "a" && has(node, "sp-feat")).map(card => {
    const id = localPath(attrs(card).href, file);
    return { id, title: clean(text(first(card, node => has(node, "sp-feat-title")))), summary: clean(text(first(card, node => has(node, "sp-feat-facts")))), cover: image(first(card, node => node.nodeName === "img"), file) };
  }).filter(item => articlePath.test(item.id) && item.title && !editorialSections.some(section => section.file === item.id));
}
export function parseEditorialArticle(html, file) {
  const document = parse(html), main = first(document, node => node.nodeName === "main");
  if (!main) fail("This article has not finished downloading.", 404);
  const body = first(main, node => has(node, "g-body")) || main;
  const blocks = [];
  function walk(node) {
    if (!node || blocks.length >= 2000 || ignored.has(node.nodeName) || ["cp-head", "g-head", "g-line", "g-toc", "g-end", "cp-cards", "sp-feat", "cp-cover", "g-cover", "cp-by"].some(name => has(node, name))) return;
    if (has(node, "g-gallery") || has(node, "cp-four")) {
      const items = all(node, item => has(item, "g-card") || has(item, "cp-pic")).map(card => ({ ...image(first(card, item => item.nodeName === "img"), file),
        caption: clean(text(first(card, item => has(item, "cp-prompt-text"))) || text(first(card, item => has(item, "g-caption")))) })).filter(item => item.url);
      if (items.length) { blocks.push({ type: "gallery", images: items }); return; }
    }
    if (node.nodeName === "table") {
      blocks.push({ type: "table", rows: all(node, item => item.nodeName === "tr").slice(0, 200).map(row => children(row).filter(cell => ["th", "td"].includes(cell.nodeName)).slice(0, 20).map(cell => ({ heading: cell.nodeName === "th", runs: runs(cell, file) }))) }); return;
    }
    if (/^h[2-4]$/.test(node.nodeName) || has(node, "cp-pick-name")) {
      blocks.push({ type: "heading", text: clean(text(node)), ...(node.nodeName === "a" ? { link: link(attrs(node).href, file) } : {}) }); return;
    }
    if (node.nodeName === "p" || node.nodeName === "li" || has(node, "cp-pick-facts") || has(node, "g-caption")) {
      const inline = runs(node, file); if (clean(inline.map(item => item.text).join(""))) blocks.push({ type: node.nodeName === "li" ? "list-item" : "paragraph", runs: inline }); return;
    }
    if (node.nodeName === "pre" || has(node, "cp-prompt-text")) { if (clean(text(node))) blocks.push({ type: "code", text: clean(text(node)) }); return; }
    if (node.nodeName === "img") { const item = image(node, file); if (item) blocks.push({ type: "image", ...item }); return; }
    children(node).forEach(walk);
  }
  children(body).forEach(walk);
  const title = clean(text(first(main, node => node.nodeName === "h1")));
  if (!title || !blocks.length) fail("This article has not finished downloading.", 404);
  const coverNode = first(main, node => has(node, "g-cover") || has(node, "cp-cover"));
  return { id: file, title, author: clean(text(first(main, node => has(node, "cp-author-name")))), lead: clean(text(first(main, node => has(node, "g-lead")))), cover: image(first(coverNode, node => node.nodeName === "img"), file), blocks };
}

export function createStyleFinderEditorial({ root, cacheMs = 30000 }) {
  let snapshot = null, expires = 0, pending;
  const articles = new Map();
  async function siteRoot() {
    if (!root) fail("The local catalog is not configured.", 503);
    const base = path.resolve(root);
    try { await stat(path.join(base, "library.html")); return realpath(base); }
    catch { return realpath(path.join(base, "midlibrary.io")); }
  }
  async function source(directory, file) {
    if (!articlePath.test(file)) fail("Choose a valid local article.");
    const target = await realpath(path.join(directory, file));
    const relative = path.relative(directory, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) fail("Invalid local article.");
    const info = await stat(target);
    if (!info.isFile() || info.size > 12 * 1024 * 1024) fail("This article is not available locally.", 404);
    return { target, info };
  }
  async function index(refresh = false) {
    if (!refresh && snapshot && Date.now() < expires) return snapshot;
    if (pending) return pending;
    pending = (async () => {
      let directory; try { directory = await siteRoot(); } catch { return { ready: false, sections: editorialSections.map(({ file, ...section }) => ({ ...section, items: [], count: 0 })) }; }
      const sections = [];
      for (const { file, ...section } of editorialSections) {
        let items = [];
        try { const { target } = await source(directory, file); items = parseEditorialList(await readFile(target, "utf8"), file); } catch { /* Partial downloads remain visible. */ }
        items = await Promise.all(items.map(async item => { try { await source(directory, item.id); return { ...item, available: true }; } catch { return { ...item, available: false }; } }));
        sections.push({ ...section, items, count: items.length });
      }
      snapshot = { ready: sections.some(section => section.count), sections }; expires = Date.now() + cacheMs; return snapshot;
    })().finally(() => { pending = null; });
    return pending;
  }
  async function article(file) {
    if (!articlePath.test(file || "") || editorialSections.some(section => section.file === file)) fail("Choose a valid local article.");
    const directory = await siteRoot(), { target, info } = await source(directory, file);
    const previous = articles.get(file);
    if (previous?.mtime === info.mtimeMs && previous.size === info.size) return previous.article;
    const value = parseEditorialArticle(await readFile(target, "utf8"), file);
    articles.set(file, { article: value, mtime: info.mtimeMs, size: info.size }); return value;
  }
  return { index, article };
}
export function registerStyleFinderEditorialRoutes(app, options) {
  const editorial = createStyleFinderEditorial(options);
  app.get("/api/style-library/editorial", async (req, res) => { try { res.json(await editorial.index(req.query.refresh === "1")); } catch { res.status(500).json({ error: "Could not read local articles. Refresh when the download finishes." }); } });
  app.get("/api/style-library/editorial/article", async (req, res) => { try { res.json(await editorial.article(req.query.file)); } catch (error) { res.status(error.status || 404).json({ error: error.status ? error.message : "This article has not downloaded yet." }); } });
}
