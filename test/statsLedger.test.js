import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStatsLedger, mergeStatsRecords } from "../server/stats-ledger.js";
const record = (id, amountUsd = 1, estimated = true) => ({ id, provider: "Fal", createdAt: "2026-10-08T12:00:00Z", cost: { amountUsd, estimated, currency: "USD" } });
test("ledger survives recent history eviction, restart, concurrent append and removal", async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "newt-stats-test-")); t.after(() => rm(folder, { recursive: true, force: true }));
  const filePath = path.join(folder, "ledger.json"); const ledger = createStatsLedger({ filePath });
  await ledger.snapshot([record("old")]); await Promise.all(Array.from({ length: 15 }, (_, index) => ledger.append(record(`new-${index}`))));
  await ledger.snapshot([record("new-1")]); const restarted = createStatsLedger({ filePath });
  const snapshot = await restarted.snapshot([]); assert.equal(snapshot.records.length, 16); assert.ok(snapshot.trackingStartedAt);
  const before = await readFile(filePath, "utf8"); const preview = await restarted.preview([record("old"), record("other-machine")]);
  assert.equal(preview.duplicates, 1); assert.equal(preview.records.length, 17); assert.equal(await readFile(filePath, "utf8"), before);
});
test("overlap does not double count; reconciliation fills missing and prefers actual over estimates", () => {
  const merged = mergeStatsRecords([record("a", null), record("b", 1), record("c", 2, false)], [record("a", 3), record("b", 4, false), record("c", 5)]);
  assert.equal(merged.records.length, 3); assert.equal(merged.duplicates, 3);
  assert.deepEqual(merged.records.map(row => row.cost.amountUsd), [3, 4, 2]);
});
test("corruption refuses unsafe writes and does not erase data", async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "newt-stats-corrupt-")); t.after(() => rm(folder, { recursive: true, force: true }));
  const filePath = path.join(folder, "ledger.json"); await writeFile(filePath, "broken");
  await assert.rejects(createStatsLedger({ filePath }).append(record("a")), /preserved/); assert.equal(await readFile(filePath, "utf8"), "broken");
});
test("identical anonymous occurrences remain distinct across snapshots and restart", async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "newt-stats-anonymous-")); t.after(() => rm(folder, { recursive: true, force: true }));
  const filePath = path.join(folder, "ledger.json"); const ledger = createStatsLedger({ filePath });
  const anonymous = record("");
  assert.equal((await ledger.snapshot([anonymous, anonymous])).records.length, 2);
  assert.equal((await ledger.snapshot([anonymous, anonymous])).records.length, 2);
  assert.equal((await createStatsLedger({ filePath }).snapshot([anonymous])).records.length, 2);
  const preview = await ledger.preview([anonymous, anonymous]);
  assert.equal(preview.records.length, 2); assert.equal(preview.anonymousCount, 2);
  await ledger.append(anonymous); await ledger.append(anonymous);
  assert.equal((await ledger.snapshot([])).records.length, 4);
});
test("anonymous cost reconciliation and display renames do not create another accounting event", () => {
  const original = { ...record("", null), project: { id: "workflow", name: "Old", fileName: "Old.json" } };
  const changed = { ...record("", 2, false), project: { id: "workflow", name: "Renamed", fileName: "Renamed.json" } };
  const merged = mergeStatsRecords([original], [changed]);
  assert.equal(merged.records.length, 1); assert.equal(merged.records[0].cost.amountUsd, 2);
  assert.equal(mergeStatsRecords(merged.records, [{ ...changed, cost: { amountUsd: 10 } }]).records[0].cost.amountUsd, 2);
});
