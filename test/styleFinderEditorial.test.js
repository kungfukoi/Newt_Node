import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStyleFinderEditorial, editorialSections, parseEditorialList, parseEditorialArticle } from "../server/stylefinder-editorial.js";

const index = `<main><a class="sp-feat" href="demo.html"><img src="../img/demo.jpg?width=640"><span class="sp-feat-title">Demo guide</span><span class="sp-feat-facts">Creative techniques</span></a><a class="sp-feat" href="https://evil.test/article"><span class="sp-feat-title">External</span></a></main>`;
const article = `<main><header class="g-head"><h1>Demo guide</h1><span class="cp-author-name">Author</span></header><p class="g-lead">Introduction</p><div class="g-body"><h2>Technique</h2><p>Try <a href="../library/ink.html">Ink</a> or <a href="../focus/artist.html">another article</a>. <a href="javascript:alert(1)">Unsafe link</a></p><script>evil()</script><iframe src="https://evil.test"></iframe><div class="g-gallery"><div class="g-card"><img src="../img/example.png" onerror="evil()"><span class="cp-prompt-text">An example --sref 123</span></div></div><table><tr><th>Setting</th><td>Value</td></tr></table><img src="https://evil.test/tracker.png"><img src="../../../secret.png"></div><div class="g-end"><p>Support website</p></div></main>`;
test("Editorial indexes extract local article cards and confined image URLs", () => {
  const items = parseEditorialList(index, editorialSections[0].file);
  assert.equal(items.length, 1); assert.equal(items[0].id, "midguide/demo.html");
  assert.equal(items[0].title, "Demo guide");
  assert.match(items[0].cover.url, /file=img%2Fdemo.jpg/);
});
test("Article parsing preserves readable content, galleries, tables and local Look navigation without active HTML", () => {
  const value = parseEditorialArticle(article, "midguide/demo.html");
  assert.equal(value.title, "Demo guide"); assert.equal(value.author, "Author"); assert.equal(value.lead, "Introduction");
  assert.ok(value.blocks.some(block => block.type === "gallery" && block.images.length === 1));
  const paragraph = value.blocks.find(block => block.type === "paragraph");
  assert.deepEqual(paragraph.runs.find(run => run.text === "Ink").link, { type: "look", id: "ink" });
  assert.deepEqual(paragraph.runs.find(run => run.text === "another article").link, { type: "article", id: "focus/artist.html" });
  assert.equal(paragraph.runs.find(run => run.text === "Unsafe link").link, undefined);
  assert.ok(value.blocks.some(block => block.type === "table"));
  assert.doesNotMatch(JSON.stringify(value), /evil\(|evil.test|onerror|secret.png|Support website/);
});
test("Local sections tolerate partial downloads, refresh arriving files, reject traversal and reread edited articles", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "newt-editorial-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "midlibrary.io"); await mkdir(path.join(directory, "midguide"), { recursive: true });
  await writeFile(path.join(directory, "library.html"), "catalog");
  await writeFile(path.join(directory, editorialSections[0].file), index);
  const service = createStyleFinderEditorial({ root });
  const first = await service.index(); assert.equal(first.sections.length, 3); assert.equal(first.sections[0].count, 1);
  assert.equal(first.sections[0].items[0].available, false);
  await writeFile(path.join(directory, "midguide/demo.html"), article);
  assert.equal((await service.index(true)).sections[0].items[0].available, true);
  assert.equal((await service.article("midguide/demo.html")).title, "Demo guide");
  await writeFile(path.join(directory, "midguide/demo.html"), article.replace("Demo guide", "Updated article"));
  assert.equal((await service.article("midguide/demo.html")).title, "Updated article");
  for (const file of ["../secret.html", "midguide/../../secret.html", "https://evil.test/a", editorialSections[0].file]) await assert.rejects(service.article(file));
  await assert.rejects(service.article("focus/missing.html"));
  assert.equal((await createStyleFinderEditorial({ root: path.join(root, "missing") }).index()).ready, false);
});
