import assert from "node:assert/strict";
import test from "node:test";
import { createStatsProviders, globalQuery, parseCostPage } from "../server/stats-providers.js";
const query = { start: "2026-10-01", end: "2026-10-09", provider: "atlas", atlasScope: "account", model: "", key: "" };
const atlasPage = (more = false, page = null, value = "0.240001") => ({ scope: "account", data: [{ start_at: "2026-10-08T00:00:00Z", covered_until: "2026-10-08T11:00:00Z", partial: true, results: [{ model: { id: "provider/model" }, api_key: { id: "ak_public" }, amount: { value, currency: "usd" } }] }], has_more: more, next_page: page });
const balance = { scope: "account", available: { value: "125.500000", currency: "usd" } };
test("Atlas queries exact account scope, model/key filters, paginates and keeps balances separate", async () => {
  const calls = [];
  const service = createStatsProviders({ getKey: () => "fixture-secret", fetchImpl: async (raw, init) => {
    const url = new URL(raw); calls.push({ url, init });
    if (url.pathname.endsWith("/balance")) return Response.json(balance);
    if (url.searchParams.has("page")) return Response.json({ ...atlasPage(), data: [] });
    return Response.json(atlasPage(true, "opaque-page"));
  } });
  const result = await service.load({ ...query, model: "provider/model", key: "ak_public" });
  assert.equal(result.providers[0].spend.amount, 0.240001); assert.equal(result.providers[0].balance.amount, 125.5);
  assert.equal(result.providers[0].spend.scope, "provider key (public ID filter)"); assert.equal(result.providers[0].balance.scope, "account");
  assert.equal(result.providers[0].spend.partial, true); assert.equal(result.providers[0].spend.rows[0].key, "ak_public");
  const costs = calls.filter(call => call.url.pathname.endsWith("model-costs")); assert.equal(costs.length, 2);
  assert.deepEqual(costs[0].url.searchParams.getAll("group_by[]"), ["model", "api_key"]); assert.equal(costs[0].url.searchParams.get("api_key_ids[]"), "ak_public");
  assert.equal(costs[1].url.searchParams.get("page"), "opaque-page"); assert.equal(calls[0].init.method, "GET"); assert.equal(calls[0].init.redirect, "error");
  assert.ok(!JSON.stringify(result).includes("fixture-secret"));
});
test("Fal returns final discounted usage and account balance; never adds subtotal or summary", async () => {
  const calls = [];
  const service = createStatsProviders({ getKey: () => "fixture-admin", fetchImpl: async raw => {
    const url = new URL(raw); calls.push(url);
    return Response.json(url.pathname.endsWith("billing") ? { credits: { current_balance: 12.5, currency: "USD" } } : {
      time_series: [{ bucket: "2026-10-08T00:00:00Z", results: [{ endpoint_id: "fal-ai/model", cost_total: 0.32, cost_subtotal: 0.4, cost_discount: 0.08, currency: "USD", auth_method_structured: { api_key_id: "public-id" } }] }],
      summary: [{ cost_total: 100 }], has_more: false, next_cursor: null
    });
  } });
  const result = await service.load({ ...query, provider: "fal", key: "public-id" }); const provider = result.providers[0];
  assert.equal(provider.spend.amount, .32); assert.equal(provider.balance.amount, 12.5); assert.equal(provider.spend.rows[0].key, "public-id");
  const url = calls.find(url => url.pathname.endsWith("usage")); assert.equal(url.searchParams.get("bound_to_timeframe"), "false"); assert.equal(url.searchParams.get("timezone"), "UTC"); assert.equal(url.searchParams.get("api_key_id"), "public-id");
});
test("permissions, rate limits and rejected credentials remain unavailable, without leaked provider errors", async () => {
  for (const [code, status] of [[401, "credential-rejected"], [403, "permission-required"], [429, "rate-limited"], [500, "unavailable"]]) {
    const service = createStatsProviders({ getKey: () => "fixture-secret", fetchImpl: async () => Response.json({ error: "fixture-secret" }, { status: code }) });
    const result = await service.load(query); assert.equal(result.providers[0].spend.status, status); assert.equal(result.providers[0].spend.amount, null); assert.ok(!JSON.stringify(result).includes("fixture-secret"));
  }
});
test("Krea and Google never request private/guessed endpoints; ElevenLabs allowance is not USD spend", async () => {
  const calls = []; const service = createStatsProviders({ getKey: () => "fixture", fetchImpl: async url => { calls.push(String(url)); return Response.json({ character_count: 1000, character_limit: 10000 }); } });
  const krea = await service.load({ ...query, provider: "krea" }); const google = await service.load({ ...query, provider: "google" });
  assert.equal(krea.providers[0].balance.status, "unsupported"); assert.equal(google.providers[0].spend.amount, null); assert.equal(calls.length, 0);
  const eleven = await service.load({ ...query, provider: "elevenlabs" }); assert.equal(eleven.providers[0].balance.amount, 9000); assert.equal(eleven.providers[0].balance.unit, "characters"); assert.equal(eleven.providers[0].spend.amount, null);
});
test("malformed/mixed currency, wrong scope and outside date buckets cannot produce totals", () => {
  assert.throws(() => parseCostPage("atlas", { ...atlasPage(), scope: "self" }, query));
  assert.throws(() => parseCostPage("atlas", atlasPage(false, null, "bad"), query));
  const eur = atlasPage(); eur.data[0].results[0].amount.currency = "eur"; assert.throws(() => parseCostPage("atlas", eur, query));
  const outside = atlasPage(); outside.data[0].start_at = "2020-01-01T00:00:00Z"; assert.throws(() => parseCostPage("atlas", outside, query));
});
test("partial pagination never fabricates complete account total", async () => {
  let count = 0;
  const service = createStatsProviders({ getKey: () => "fixture", fetchImpl: async raw => String(raw).includes("balance") ? Response.json(balance) : Response.json(atlasPage(true, `page-${++count}`, String(count))) });
  const result = await service.load(query); assert.equal(result.providers[0].spend.status, "partial"); assert.equal(result.providers[0].spend.amount, null); assert.equal(count, 20);
});
test("overlapping provider pages withhold ambiguous totals", async () => {
  let count = 0;
  const service = createStatsProviders({ getKey: () => "fixture", fetchImpl: async raw => Response.json(String(raw).includes("balance") ? balance : atlasPage(++count === 1, "next")) });
  const result = await service.load(query);
  assert.equal(result.providers[0].spend.status, "unavailable");
  assert.equal(result.providers[0].spend.amount, null);
  assert.deepEqual(result.providers[0].spend.rows, []);
});
test("cache coalesces same query, expires, and invalidates on credential change", async () => {
  let key = "fixture-1", clock = 0, calls = 0;
  const service = createStatsProviders({ getKey: () => key, now: () => clock, fetchImpl: async raw => { calls++; return Response.json(String(raw).includes("balance") ? balance : atlasPage()); } });
  await Promise.all([service.load(query), service.load(query)]); assert.equal(calls, 2);
  await service.load(query); assert.equal(calls, 2); key = "fixture-2"; await service.load(query); assert.equal(calls, 4);
  clock = 61000; await service.load(query); assert.equal(calls, 6);
});
test("Global validates real UTC dates and IDs before provider calls; no key secrets in query", () => {
  for (const raw of [{ ...query, start: "2026-02-30" }, { ...query, end: "2026-01-01" }, { ...query, start: "2025-01-01" }, { ...query, key: "apikey-THIS_IS_SECRET" }, { ...query, provider: "krea", key: "id" }, { ...query, provider: "openai", model: "model" }]) assert.throws(() => globalQuery(raw));
  assert.equal(globalQuery({ ...query, atlasScope: "self" }).atlasScope, "self");
  assert.throws(() => globalQuery({ ...query, provider: "fal", key: `${"a".repeat(32)}:${"b".repeat(32)}` }));
});
test("OpenAI costs require separate admin credential and use organization scope, not remaining balance", async () => {
  const service = createStatsProviders({ getKey: () => "fixture-admin", fetchImpl: async () => Response.json({ data: [{ start_time: Date.parse("2026-10-08T00:00:00Z") / 1000, results: [{ amount: { value: "0.15", currency: "usd" }, api_key_id: "public-id", line_item: "model/input" }] }], has_more: false, next_page: null }) });
  const result = await service.load({ ...query, provider: "openai" }); assert.equal(result.providers[0].spend.amount, .15); assert.equal(result.providers[0].spend.scope, "organization"); assert.equal(result.providers[0].balance.status, "unsupported");
});
