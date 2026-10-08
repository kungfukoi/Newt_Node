import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalytics, defaultFilters, normalizeStatsRecord, resolveDateRange, formatMoney, recordedAmount } from "../src/statsAnalytics.js";
import { workflowRequestContextForState } from "../src/workflowSession.js";
import { workflowContextPayload } from "../src/workflowContext.js";
const now = new Date(2026, 9, 8, 12);
const date = (day, hour = 12) => new Date(2026, 9, day, hour).toISOString();
const fingerprint = "a".repeat(64);
const record = (id, day, cost = 1, extra = {}) => ({ id, createdAt: date(day), provider: "Atlas Cloud", modelName: "Model A", mediaType: "image", project: { id: "workflow-a", name: "Same name", fileName: "one.json" }, keyIdentity: { fingerprint }, cost: { amountUsd: cost, currency: "USD", estimated: true }, ...extra });
test("composable filters intersect date, workflow, provider, model, key, job search and state", () => {
  const records = [record("a", 8), record("b", 7, 3, { provider: "fal.ai" }), record("c", 2), record("d", 8, 4, { project: { id: "workflow-b", name: "Same name", fileName: "two.json" } })];
  const filters = { ...defaultFilters(), range: "5", provider: "atlas", workflow: "workflow-a", model: "Model A", key: `atlas:${fingerprint}`, search: "one.json", status: "completed" };
  const result = buildAnalytics(records, filters, now);
  assert.deepEqual(result.rows.map(row => row.id), ["a"]); assert.equal(result.total, 1); assert.equal(result.days.length, 5);
  assert.equal(result.options.workflow.length, 2); assert.equal(buildAnalytics(records, defaultFilters(), now).rows.length, 4);
});
test("custom ranges include both calendar dates, exclude future records, reject invalid dates", () => {
  const rows = [record("start", 4, 1, { createdAt: date(4, 0) }), record("end", 8, 2, { createdAt: date(8, 11) }), record("future", 8, 3, { createdAt: date(8, 13) }), record("outside", 3), record("bad", 8, 1, { createdAt: "bad" })];
  const filters = { ...defaultFilters(), range: "custom", start: "2026-10-04", end: "2026-10-08" };
  const result = buildAnalytics(rows, filters, now); assert.equal(result.total, 3); assert.equal(result.invalidDates, 1); assert.equal(result.rows.length, 2);
  assert.ok(resolveDateRange({ ...filters, start: "2026-02-30" }, now).error);
  assert.ok(resolveDateRange({ ...filters, end: "2026-10-01" }, now).error);
  assert.ok(resolveDateRange({ ...filters, start: "2024-01-01" }, now).error);
});
test("date presets have exact boundaries and calendar arithmetic survives DST", () => {
  const previous = process.env.TZ; process.env.TZ = "America/New_York";
  try {
    const date = new Date(2026, 10, 3, 12);
    const result = resolveDateRange({ ...defaultFilters(), range: "5" }, date);
    assert.equal(result.days.length, 5); assert.equal(result.days[0].key, "2026-10-30"); assert.equal(result.days.at(-1).key, "2026-11-03");
    assert.equal(resolveDateRange(defaultFilters(), date).days.length, 30);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test("missing, malformed, negative and non-USD costs remain unpriced; zero is known", () => {
  const values = [null, undefined, "", "garbage", -1, Infinity, true, [], "0x10", "  "];
  for (const amountUsd of values) assert.equal(recordedAmount({ amountUsd, currency: "USD" }), null);
  assert.equal(recordedAmount({ amountUsd: 2, currency: "EUR" }), null);
  assert.equal(recordedAmount({ amountUsd: "0", currency: "USD" }), 0);
  const result = buildAnalytics([record("zero", 8, 0), record("unknown", 8, null), record("small", 8, 0.000005), record("currency", 8, 1, { cost: { amountUsd: 1, currency: "EUR" } })], defaultFilters(), now);
  assert.equal(result.total, 0.000005); assert.equal(result.pricedCount, 2); assert.equal(result.unpricedCount, 2); assert.equal(result.average, 0.0000025);
  assert.equal(formatMoney(0.000005), "$0.000005"); assert.equal(formatMoney(null), "Unavailable");
  assert.equal(buildAnalytics([record("unknown", 8, null)], defaultFilters(), now).total, null);
});
test("aggregations preserve provider route, workflow ID and full key identity without per-add rounding", () => {
  const rows = Array.from({ length: 100 }, (_, index) => record(`small-${index}`, 8, 0.000001));
  const result = buildAnalytics(rows, defaultFilters(), now);
  assert.ok(Math.abs(result.total - 0.0001) < 1e-12); assert.ok(Math.abs(result.breakdowns.provider[0].cost - 0.0001) < 1e-12);
  const mixed = buildAnalytics([record("a", 8, 3, { cost: { amountUsd: 3, estimated: false } }), record("b", 8, 2), record("c", 8, null)], defaultFilters(), now);
  assert.equal(mixed.actual, 3); assert.equal(mixed.estimated, 2); assert.equal(mixed.breakdowns.key[0].unpricedCount, 1);
});
test("duplicates excluded while absent IDs preserve distinct records and invalid dates do not become today", () => {
  const rows = [record("a", 8, 2), record("a", 8, 2), record("b", 8, null), record("b", 8, 3), record("a", 8, 4, { provider: "Krea" }), record("", 8), record("", 8)];
  const result = buildAnalytics(rows, defaultFilters(), now); assert.equal(result.duplicates, 2); assert.equal(result.rows.length, 5); assert.equal(result.total, 11);
  assert.equal(normalizeStatsRecord({ id: "legacy" }).createdAt, "");
});
test("allowlist excludes credentials, payloads and prompts; only validated fingerprints identify keys", () => {
  const input = record("a", 8, 1, { apiKey: "SECRET_VALUE", credentials: { key: "SECRET_VALUE" }, settings: { apiKey: "SECRET_VALUE" }, prompt: "SECRET_VALUE", keyIdentity: { fingerprint: "SECRET_VALUE", label: "SECRET_VALUE" }, modelName: "sk-abcdefghijklmnopqrstuvwxyz" });
  const output = normalizeStatsRecord(input);
  assert.ok(!JSON.stringify(output).includes("SECRET_VALUE")); assert.ok(!JSON.stringify(output).includes("sk-abcdefghijklmnopqrstuvwxyz")); assert.equal(output.keyId, "unknown");
  assert.deepEqual(normalizeStatsRecord(normalizeStatsRecord(record("a", 8))), normalizeStatsRecord(record("a", 8)));
});
test("workflow filename is basename only, renames preserve ID and duplicate IDs stay distinct", () => {
  const context = workflowRequestContextForState({ projectId: "stable", projectName: "Renamed", workflowFilePath: "C:\\workflows\\renamed.json" });
  assert.equal(context.projectId, "stable"); assert.equal(context.workflowFileName, "renamed.json");
  assert.equal(workflowContextPayload({ workflowFileName: "/shared/folder/file.json" }).workflowFileName, "file.json");
});
test("UUID-shaped secret pairs and Google-style tokens are redacted from permitted labels", () => {
  const secret = "00000000-0000-0000-0000-000000000000:11111111-1111-1111-1111-111111111111";
  const result = normalizeStatsRecord({ id: secret, modelName: secret, project: { name: `AIza${"x".repeat(30)}` } });
  assert.ok(!JSON.stringify(result).includes(secret)); assert.ok(!JSON.stringify(result).includes("AIza"));
});
