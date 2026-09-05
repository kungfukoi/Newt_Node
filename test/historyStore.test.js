import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHistoryStore } from "../server/history-store.js";
import { writeJsonAtomic } from "../server/json-store.js";

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "newt-history-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, filePath: path.join(directory, "history.json") };
}

for (const code of ["EACCES", "EPERM", "EBUSY"]) {
  test(`history preserves records after ${code} instead of resetting`, async (t) => {
    const { filePath } = await fixture(t);
    const original = '[{"id":"existing"}]';
    await writeFile(filePath, original);
    const store = createHistoryStore({ filePath, readFile: async () => { throw Object.assign(new Error("locked"), { code }); } });
    await assert.rejects(store.read(), { code: "HISTORY_UNAVAILABLE" });
    await assert.rejects(store.append({ id: "new" }), { code: "HISTORY_UNAVAILABLE" });
    assert.equal(await readFile(filePath, "utf8"), original);
  });
}

test("corrupt history without a valid backup is preserved and blocks writes", async (t) => {
  const { filePath } = await fixture(t);
  await writeFile(filePath, "{unfinished");
  const store = createHistoryStore({ filePath });
  await assert.rejects(store.append({ id: "new" }), { code: "HISTORY_UNAVAILABLE" });
  assert.equal(await readFile(filePath, "utf8"), "{unfinished");
});

test("missing primary history restores a valid backup and reports recovery once", async (t) => {
  const { filePath } = await fixture(t);
  const notices = [];
  await writeJsonAtomic(`${filePath}.bak`, [{ id: "preserved" }]);
  const store = createHistoryStore({ filePath, onRecovery: (message) => notices.push(message) });
  assert.deepEqual(await store.read(), [{ id: "preserved" }]);
  assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), [{ id: "preserved" }]);
  await store.read();
  assert.equal(notices.length, 1);
});

test("corrupt history recovers a validated backup and quarantines damaged data", async (t) => {
  const { filePath, directory } = await fixture(t);
  const notices = [];
  const store = createHistoryStore({ filePath, onRecovery: (notice) => notices.push(notice) });
  await store.append({ id: "first" });
  await store.append({ id: "second" });
  await writeFile(filePath, "{unfinished");
  assert.deepEqual(await store.read(), [{ id: "first" }]);
  assert.equal(notices.length, 1);
  const quarantined = (await readdir(directory)).find((name) => name.includes(".corrupt-"));
  assert.equal(await readFile(path.join(directory, quarantined), "utf8"), "{unfinished");
  await store.append({ id: "third" });
  assert.deepEqual((await store.read()).map((item) => item.id), ["third", "first"]);
});

test("concurrent history append and delete operations share one queue", async (t) => {
  const { filePath } = await fixture(t);
  const store = createHistoryStore({ filePath });
  await store.append({ id: "delete-me" });
  await Promise.all([
    ...Array.from({ length: 12 }, (_, id) => store.append({ id: String(id) })),
    store.remove("delete-me")
  ]);
  assert.equal((await store.read()).length, 12);
  assert.equal((await store.read()).some((item) => item.id === "delete-me"), false);
});

test("history deduplicates durable runs without treating absent run ids as duplicates", async (t) => {
  const { filePath } = await fixture(t);
  const store = createHistoryStore({ filePath });
  await store.append({ id: "plain" }, { deduplicate: true });
  await store.append({ id: "plain-2" }, { deduplicate: true });
  await store.append({ id: "run", generationRunId: "run-id" }, { deduplicate: true });
  await store.append({ id: "duplicate", generationRunId: "run-id" }, { deduplicate: true });
  assert.equal((await store.read()).length, 3);
});

test("atomic JSON rename failure leaves the original file intact", async (t) => {
  const { filePath, directory } = await fixture(t);
  await writeJsonAtomic(filePath, { version: 1 });
  await assert.rejects(writeJsonAtomic(filePath, { version: 2 }, {
    renameFile: async () => { throw Object.assign(new Error("locked"), { code: "EPERM" }); }
  }), { code: "EPERM" });
  assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), { version: 1 });
  assert.deepEqual(await readdir(directory), ["history.json"]);
  await writeJsonAtomic(filePath, { version: 3 });
  assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), { version: 3 });
});

test("concurrent JSON writes use unique temporaries and leave valid output", async (t) => {
  const { filePath, directory } = await fixture(t);
  await Promise.all(Array.from({ length: 12 }, (_, version) => writeJsonAtomic(filePath, { version })));
  assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), { version: 11 });
  assert.deepEqual(await readdir(directory), ["history.json"]);
});
