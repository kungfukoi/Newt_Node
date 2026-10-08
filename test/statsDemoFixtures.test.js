import test from "node:test";
import assert from "node:assert/strict";
import { createStatsDemoApi } from "../src/statsDemoFixtures.js";
import { buildAnalytics, defaultFilters } from "../src/statsAnalytics.js";
test("demo remains in memory, uses relative dates, exercises missing/zero/duplicate costs and simulated outages", async () => {
  const fixed = new Date("2026-10-08T12:00:00Z");
  const api = createStatsDemoApi({ now: () => new Date(fixed), delayMs: 0 });
  const data = await api.local(); const result = buildAnalytics(data.history, defaultFilters(), fixed);
  assert.equal(result.rows.length, 7); assert.equal(result.unpricedCount, 2); assert.equal(result.duplicates, 1);
  assert.equal(result.rows.filter(row => row.cost.amountUsd === 0).length, 1); assert.match(data.coverage.note, /SYNTHETIC DEMO/);
  api.setOffline(true); await assert.rejects(api.local(), /Synthetic demo outage/); api.setOffline(false);
  const global = await api.accounts({ start: "2026-10-01", end: "2026-10-09", provider: "atlas", key: "unknown", atlasScope: "self" });
  assert.equal(global.providers[0].spend.amount, 0); assert.equal(global.providers[0].balance.amount, 80);
  await assert.rejects(api.export(), /disabled/); await assert.rejects(api.previewImport(), /disabled/);
});
