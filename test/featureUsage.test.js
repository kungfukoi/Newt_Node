import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { createFeatureUsageStore, validUsageEvent } from "../server/feature-usage.js";
import { usageRows, nodeUsageEvents } from "../src/featureUsage.js";

test("usage persists concurrent windows, deduplicates retries and keeps days and actions separate", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-usage-test-"));
  try {
    const file = path.join(directory, "usage.json");
    let now = new Date(2026, 9, 29, 12);
    const store = createFeatureUsageStore(file, () => now);
    const event = { id: randomUUID(), type: "imageModel", action: "run", prompt: "excluded" };
    await Promise.all([store.record(event), store.record(event), ...Array.from({ length: 19 }, () => store.record({ ...event, id: randomUUID() }))]);
    await store.record({ id: randomUUID(), type: "preview", action: "add" });
    now = new Date(2026, 9, 30, 12);
    await store.record({ ...event, id: randomUUID() });
    const data = await createFeatureUsageStore(file).snapshot();
    assert.equal(data.days.length, 3);
    assert.deepEqual(nodeUsageEvents(data.days).map(row => row.count), [20, 1]);
    assert.equal(JSON.stringify(data).includes("excluded"), false);
    assert.equal(JSON.stringify(data).includes(event.id), false);
    assert.equal(validUsageEvent({ ...event, type: "invented" }), false);
    assert.equal(validUsageEvent({ ...event, action: "delete" }), false);
    await writeFile(file, "broken");
    await assert.rejects(store.record({ ...event, id: randomUUID() }));
    assert.equal(await readFile(file, "utf8"), "broken");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("usage weights period counts while preserving lifetime last use and zero-use catalog", () => {
  const now = new Date(2026, 9, 29, 12);
  const events = [{ id: "popular", at: now.toISOString(), count: 99 }, { id: "rare", at: now.toISOString() },
    { id: "old", at: new Date(2026, 0, 1).toISOString() }, { id: "future", at: new Date(2027, 0, 1).toISOString() }];
  const catalog = ["popular", "rare", "old", "never"].map(id => ({ id, name: id }));
  const rows = usageRows(events, catalog, { now, range: "30" });
  assert.equal(rows[0].share, .99);
  assert.equal(rows.find(row => row.id === "rare").signal, "Niche");
  assert.equal(rows.find(row => row.id === "old").signal, "Inactive in period");
  assert.equal(rows.find(row => row.id === "never").signal, "No recorded use");
  assert.equal(rows.length, 4);
  assert.equal(usageRows(events, catalog, { now, range: "all" }).find(row => row.id === "old").count, 1);
});

test("usage period includes the entire first local calendar day", () => {
  const now = new Date(2026, 9, 29, 12);
  const rows = usageRows([{ id: "a", at: new Date(2026, 8, 30, 0).toISOString() },
    { id: "a", at: new Date(2026, 8, 29, 23, 59).toISOString() }], [], { now, range: "30" });
  assert.equal(rows[0].count, 1);
  assert.equal(rows[0].lifetime, 2);
});
