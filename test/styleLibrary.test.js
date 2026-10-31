import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStyleLibraryStore } from "../server/style-library.js";
import { midlibrarySearchUrl, libraryStyleSnapshot, libraryPrompt, collectionExamples, libraryStylesMatching, normalizeLibraryStyle } from "../src/styleLibrary.js";

test("Legacy My styles displays as My Looks while retaining collection identity and custom names", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-collection-name-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const original = { version: 1, revision: 4, collections: [{ id: "default", name: "My styles", styles: [] }, { id: "custom", name: "Cinema", styles: [] }] };
  await writeFile(path.join(directory, "style-library.json"), JSON.stringify(original));
  const store = createStyleLibraryStore({ directory }), read = await store.read();
  assert.equal(read.collections[0].name, "My Looks"); assert.equal(read.collections[0].id, "default"); assert.equal(read.collections[1].name, "Cinema"); assert.equal(read.revision, 4);
  await store.save(read); assert.equal((await store.read()).collections[0].name, "My Looks");
});

test("Midlibrary links encode search text and repeated filters without inventing an API", () => {
  const url = new URL(midlibrarySearchUrl({ query: "ink & paper", terms: ["dark", "vivid-colors"], colours: ["black", "vivid-red"] }));
  assert.equal(url.origin, "https://midlibrary.io"); assert.equal(url.pathname, "/library");
  assert.equal(url.searchParams.get("q"), "ink & paper");
  assert.deepEqual(url.searchParams.getAll("term"), ["dark", "vivid-colors"]);
  assert.deepEqual(url.searchParams.getAll("colour"), ["black", "vivid-red"]);
});
test("Style snapshots keep source identity and independent model-neutral directions", () => {
  const original = { id: "ink", name: "Ink", prompt: "Graphic ink --sref 123 --v 7", sourceUrl: "https://midlibrary.io/library/ink", examples: [] };
  const snapshot = libraryStyleSnapshot(original); original.prompt = "changed";
  assert.equal(libraryPrompt({ libraryStyle: snapshot }), "Graphic ink");
  assert.equal(snapshot.sourceUrl, "https://midlibrary.io/library/ink");
  assert.equal(libraryPrompt({ libraryStyle: { prompt: "--sref 123 --v 7" } }), "");
  assert.equal(normalizeLibraryStyle({ sourceUrl: "javascript:alert(1)" }).sourceUrl, "");
  assert.equal(normalizeLibraryStyle({ examples: [{ localUrl: "https://example.com/remote.png" }, { localUrl: "/uploads/../private" }] }).examples.length, 0);
});
test("Saved search includes descriptions and tags, and boards deduplicate images", () => {
  const styles = [{ name: "Ink", prompt: "dark paper", tags: ["red"], examples: [{ localUrl: "/uploads/a.png" }] }, { name: "Other", examples: [{ localUrl: "/uploads/a.png" }, { localUrl: "/uploads/b.png" }] }];
  assert.equal(libraryStylesMatching(styles, "dark red").length, 1);
  assert.equal(collectionExamples(styles).length, 2);
});
test("Library store persists collections, rejects stale windows and leaves valid data intact", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-style-library-test-"));
  try {
    const store = createStyleLibraryStore({ directory });
    assert.deepEqual((await store.read()).collections, []);
    const body = { revision: 0, collections: [{ id: "test", name: "Project styles", styles: [{ id: "ink", name: "Ink", prompt: "Bold ink", examples: [{ id: "image", localUrl: "/uploads/example.png" }] }] }] };
    const first = await store.save(body); assert.equal(first.revision, 1);
    assert.equal((await createStyleLibraryStore({ directory }).read()).collections[0].styles[0].prompt, "Bold ink");
    await assert.rejects(store.save(body), error => error.status === 409);
    await assert.rejects(store.save({ revision: 1, collections: [{ ...body.collections[0], styles: [{ id: "remote", name: "Remote", examples: [{ localUrl: "https://example.com/image.png" }] }] }] }), /managed local/);
    assert.deepEqual(await store.read(), first);
    const race = await Promise.allSettled([store.save({ ...body, revision: 1 }), store.save({ ...body, revision: 1 })]);
    assert.equal(race.filter(item => item.status === "fulfilled").length, 1);
    assert.equal((await store.read()).revision, 2);
    await writeFile(path.join(directory, "style-library.json"), "broken");
    await assert.rejects(store.read(), SyntaxError);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
