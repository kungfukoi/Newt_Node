import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, readdir, readFile, rename } from "node:fs/promises";
import { createProjectOutputStore } from "../server/project-output-store.js";
import { createProjectOutputLoader } from "../src/projectOutputLoader.js";
import { buildProjectOutputItems } from "../src/projectOutputs.js";
import { readPackageOutputItems, writePackageOutputRecord } from "../server/project-output-package.js";

const record = (n, project = "one") => ({ id: `generation-${n}`, project: { id: project, name: "Project" }, createdAt: new Date(1700000000000 + n * 1000).toISOString(), localVideo: `/outputs/${project}/${n}.mp4`, prompt: "DO NOT ARCHIVE PROMPTS", apiKey: "DO NOT ARCHIVE KEYS" });

test("project catalog preserves 1000 outputs, isolates projects and paginates across restart and new generations", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-catalog-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const history = Array.from({ length: 1000 }, (_, n) => record(n));
  const store = createProjectOutputStore({ directory });
  const first = await store.list({ projectId: "one" }, history);
  assert.equal(first.items.length, 100);
  assert.equal(first.total, 1000);
  await store.append(record(1001));
  await store.append(record(600, "two"));
  const restarted = createProjectOutputStore({ directory });
  const urls = first.items.map((item) => item.url);
  let cursor = first.nextCursor;
  while (cursor) {
    const page = await restarted.list({ projectId: "one", cursor });
    urls.push(...page.items.map((item) => item.url));
    cursor = page.nextCursor;
  }
  assert.equal(new Set(urls).size, 1000);
  assert.equal((await restarted.list({ projectId: "one" })).total, 1001);
  assert.equal((await restarted.list({ projectId: "two" })).total, 1);
  await assert.rejects(restarted.list({ projectId: "two", cursor: first.nextCursor }), /Invalid/);
  assert.equal(buildProjectOutputItems({ history, projectId: "one" }).length, 1000);
  for (const folder of await readdir(directory)) {
    const file = (await readdir(path.join(directory, folder)))[0];
    const text = await readFile(path.join(directory, folder, file), "utf8");
    assert.doesNotMatch(text, /DO NOT ARCHIVE|apiKey|prompt/);
  }
});

test("Save As catalog is independent and restart cannot overwrite remapped assets with stale history", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-catalog-clone-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createProjectOutputStore({ directory });
  const history = [record(1), record(2)];
  const original = await store.all("one", history);
  await store.ingest({ id: "clone", name: "Clone" }, original.map((item) => ({ ...item, url: item.url.replace("/one/", "/clone/") })));
  await store.remap("one", new Map(original.map((item) => [item.url, item.url.replace("/outputs/one/", "/workflow-assets/one/outputs/")])));
  const restarted = createProjectOutputStore({ directory });
  const restored = await restarted.all("one", history);
  assert.equal(restored.length, 2);
  assert.ok(restored.every((item) => item.url.startsWith("/workflow-assets/one/")));
  assert.ok((await restarted.all("clone")).every((item) => item.url.startsWith("/outputs/clone/")));
  assert.equal(buildProjectOutputItems({ nodes: [], catalog: restored, projectId: "one" }).length, 2);
});

test("package output records survive relocation and import into a fresh catalog without a graph", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-package-catalog-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const original = path.join(directory, "original");
  const relocated = path.join(directory, "relocated");
  await writePackageOutputRecord(original, { ...record(1), localVideo: "/workflow-assets/one/outputs/clip.mp4" });
  await rename(original, relocated);
  const items = await readPackageOutputItems(relocated);
  const store = createProjectOutputStore({ directory: path.join(directory, "fresh-catalog") });
  await store.ingest({ id: "one", name: "Project" }, items);
  assert.equal((await store.all("one"))[0].url, "/workflow-assets/one/outputs/clip.mp4");
});

test("rail loader merges refresh with old pages, catches up missed pages, and retains items on failure", async () => {
  let state;
  let calls = [];
  let failing = false;
  let newest = false;
  const item = (id) => ({ id, url: `/outputs/${id}.png` });
  const loader = createProjectOutputLoader({ onChange: (value) => { state = value; }, list: async ({ cursor }) => {
    calls.push(cursor);
    if (failing) throw new Error("Unavailable");
    if (newest && !cursor) return { items: [item("new")], nextCursor: "gap", total: 4 };
    if (cursor === "gap") return { items: [item("middle"), item("first")], nextCursor: "older", total: 4 };
    if (cursor === "older") return { items: [item("last")], nextCursor: "", total: 2 };
    return { items: [item("first")], nextCursor: "older", total: 2 };
  } });
  await loader.refresh();
  await loader.loadMore();
  newest = true;
  await loader.refresh();
  assert.deepEqual(calls, ["", "older", "", "gap"]);
  assert.equal(state.items.length, 4);
  assert.equal(state.nextCursor, "");
  failing = true;
  await loader.refresh();
  assert.equal(state.items.length, 4);
  assert.equal(state.error, "Unavailable");
  loader.dispose();
  const count = calls.length;
  await loader.refresh();
  assert.equal(calls.length, count);
});
