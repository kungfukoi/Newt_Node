import { createHash } from "node:crypto";
import { safeLabel } from "../src/statsAnalytics.js";

export const statsCapabilities = [
  { provider: "atlas", spend: true, balance: true, scope: "account / self", note: "Account billing requires billing-read permission. Self covers the authenticated user's keys, across machines. UTC daily buckets, at most 180 days.", docs: "https://www.atlascloud.ai/docs/public-api" },
  { provider: "fal", spend: true, balance: true, scope: "workspace", note: "Usage and balance require an Admin-scope key. Key IDs are public provider IDs, never secret tokens.", docs: "https://fal.ai/docs/platform-apis/v1/models/usage" },
  { provider: "krea", spend: false, balance: false, scope: "workspace API", note: "No public API balance endpoint. View API spend/balance in Krea; workspace compute-unit usage excludes direct API jobs.", docs: "https://www.krea.ai/docs/developers/api-keys-and-billing" },
  { provider: "openai", spend: true, balance: false, scope: "organization", note: "Costs require an OpenAI Admin API key (OPENAI_ADMIN_KEY). No supported credit-balance endpoint integrated. Organization cost rows may have unattributed key IDs.", docs: "https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs" },
  { provider: "google", spend: false, balance: false, scope: "Cloud billing account", note: "A Gemini API key cannot retrieve billing totals. Billing export to BigQuery and billing permissions require separate setup; nothing is provisioned here.", docs: "https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery" },
  { provider: "elevenlabs", spend: false, balance: true, scope: "current subscription", note: "Subscription allowance is characters, not a USD balance or spend total. Requires user-read permission; billing period is independent of the date filter.", docs: "https://elevenlabs.io/docs/api-reference/user/subscription/get" }
];
const money = (value, currency) => {
  if (String(currency || "").toUpperCase() !== "USD") throw new Error("Unsupported currency");
  if (!(typeof value === "number" || typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) || !Number.isFinite(Number(value))) throw new Error("Invalid amount");
  return Number(value);
};
const publicId = value => /^[a-zA-Z0-9_.:/-]{1,180}$/.test(String(value || "")) && !/^(?:sk-|apikey-|Bearer)/i.test(value) ? String(value) : "";
export function globalQuery(raw = {}) {
  const start = String(raw.start || ""), end = String(raw.end || "");
  const a = Date.parse(`${start}T00:00:00Z`), b = Date.parse(`${end}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(a) || !Number.isFinite(b)
    || new Date(a).toISOString().slice(0, 10) !== start || new Date(b).toISOString().slice(0, 10) !== end || b <= a || b - a > 180 * 864e5) throw Object.assign(new Error("Global range must contain 1–180 UTC days."), { status: 400 });
  if (raw.provider && !statsCapabilities.some(row => row.provider === raw.provider)) throw Object.assign(new Error("Unknown provider."), { status: 400 });
  for (const field of ["model", "key"]) if (raw[field] && (!publicId(raw[field]) || field === "key" && !/^[a-zA-Z0-9_.-]+$/.test(raw[field]))) throw Object.assign(new Error("Use a public model/key ID, never an API secret."), { status: 400 });
  if ((raw.model || raw.key) && !["atlas", "fal", "openai"].includes(raw.provider)) throw Object.assign(new Error("Select a supported provider before filtering model/key IDs."), { status: 400 });
  if (raw.provider === "openai" && raw.model) throw Object.assign(new Error("OpenAI cost model filtering is not supported here."), { status: 400 });
  return { start, end, provider: raw.provider || "", model: raw.model || "", key: raw.key || "", atlasScope: raw.atlasScope === "self" ? "self" : "account" };
}

async function request(fetchImpl, url, key, provider) {
  const headers = provider === "elevenlabs" ? { "xi-api-key": key } : { Authorization: `${provider === "fal" ? "Key" : "Bearer"} ${key}` };
  const response = await fetchImpl(url, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw Object.assign(new Error("Provider request failed"), { status: response.status });
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > 4e6) throw new Error("Response too large"); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
const failure = error => ({ status: error.status === 401 ? "credential-rejected" : error.status === 403 ? "permission-required" : error.status === 429 ? "rate-limited" : "unavailable",
  message: error.status === 403 ? "Billing read access is required; credential permissions were not changed." : error.status === 401 ? "Provider rejected this credential. Check local Settings." : error.status === 429 ? "Provider rate limit reached. Retry later." : "Provider data unavailable or response contract changed. Retry later; no estimate substituted." });

export function parseCostPage(provider, data, query) {
  const buckets = provider === "fal" ? data.time_series : data.data;
  if (!Array.isArray(buckets) || typeof data.has_more !== "boolean") throw new Error("Invalid costs response");
  if (provider === "atlas" && data.scope !== query.atlasScope) throw new Error("Unexpected billing scope");
  const rows = [];
  for (const bucket of buckets) {
    const date = new Date(provider === "fal" ? bucket.bucket : provider === "atlas" ? bucket.start_at : bucket.start_time * 1000);
    if (!Number.isFinite(date.getTime()) || !Array.isArray(bucket.results)) throw new Error("Invalid cost bucket");
    // Never accept data outside the requested interval or summary rows alongside buckets.
    if (date < new Date(`${query.start}T00:00:00Z`) || date >= new Date(`${query.end}T00:00:00Z`)) throw new Error("Unexpected date coverage");
    for (const row of bucket.results) {
      const amount = provider === "fal" ? money(row.cost_total, row.currency) : provider === "atlas" ? money(row.amount?.value, row.amount?.currency) : money(row.amount?.value, row.amount?.currency);
      const model = publicId(provider === "fal" ? row.endpoint_id : provider === "atlas" ? row.model?.id || row.model_id : row.line_item);
      const key = publicId(provider === "fal" ? row.auth_method_structured?.api_key_id : provider === "atlas" ? row.api_key?.id || row.api_key_id : row.api_key_id);
      rows.push({ date: date.toISOString().slice(0, 10), amount, currency: "USD", model: safeLabel(model || "Unattributed model"), key: safeLabel(key || "Unattributed key"), partial: bucket.partial === true,
        coveredUntil: Number.isFinite(Date.parse(bucket.covered_until)) ? new Date(bucket.covered_until).toISOString() : null });
    }
  }
  const cursor = provider === "fal" ? data.next_cursor : data.next_page;
  if (data.has_more && (typeof cursor !== "string" || !cursor || cursor.length > 1000)) throw new Error("Invalid pagination");
  return { rows, more: data.has_more, cursor };
}

export function createStatsProviders({ getKey, fetchImpl = fetch, now = Date.now }) {
  const cache = new Map(), pending = new Map();
  async function costs(provider, key, query) {
    const url = new URL(provider === "atlas" ? "https://api.atlascloud.ai/public/v1/model-costs" : provider === "fal" ? "https://api.fal.ai/v1/models/usage" : "https://api.openai.com/v1/organization/costs");
    if (provider === "atlas") {
      url.searchParams.set("start_date", query.start); url.searchParams.set("end_date", query.end); url.searchParams.set("scope", query.atlasScope);
      url.searchParams.append("group_by[]", "model"); url.searchParams.append("group_by[]", "api_key");
      if (query.model) url.searchParams.append("model_ids[]", query.model);
      if (query.key) url.searchParams.append("api_key_ids[]", query.key);
    } else if (provider === "fal") {
      url.searchParams.set("start", `${query.start}T00:00:00Z`); url.searchParams.set("end", `${query.end}T00:00:00Z`);
      url.searchParams.set("timezone", "UTC"); url.searchParams.set("timeframe", "day"); url.searchParams.set("bound_to_timeframe", "false");
      url.searchParams.append("expand", "time_series"); url.searchParams.append("expand", "auth_method_structured");
      if (query.model) url.searchParams.set("endpoint_id", query.model);
      if (query.key) url.searchParams.set("api_key_id", query.key);
    } else {
      url.searchParams.set("start_time", String(Date.parse(`${query.start}T00:00:00Z`) / 1000));
      url.searchParams.set("end_time", String(Date.parse(`${query.end}T00:00:00Z`) / 1000));
      url.searchParams.append("group_by", "api_key_id"); url.searchParams.append("group_by", "line_item");
      if (query.key) url.searchParams.append("api_key_ids", query.key);
    }
    url.searchParams.set("limit", provider === "openai" ? "180" : "1000");
    const rows = [], cursors = new Set(), previousRows = new Set();
    // Bounded pagination. Incomplete sources never contribute an apparent total.
    for (let page = 0; page < 20; page++) {
      const result = parseCostPage(provider, await request(fetchImpl, url, key, provider), query);
      // Overlapping pages are ambiguous; withhold totals instead of double-counting.
      if (result.rows.some(row => previousRows.has(JSON.stringify(row)))) throw new Error("Overlapping cost pages");
      result.rows.forEach(row => previousRows.add(JSON.stringify(row))); rows.push(...result.rows);
      if (!result.more) return { status: "ready", amount: rows.reduce((sum, row) => sum + row.amount, 0), rows,
        scope: query.key ? "provider key (public ID filter)" : provider === "atlas" ? query.atlasScope === "self" ? "authenticated user's keys" : "account" : provider === "fal" ? "workspace" : "organization",
        partial: rows.some(row => row.partial), message: "Provider-reported cost buckets; may change before final invoicing. Includes other machines/apps within this scope." };
      if (cursors.has(result.cursor)) throw new Error("Repeated cursor"); cursors.add(result.cursor);
      url.searchParams.set(provider === "fal" ? "cursor" : "page", result.cursor);
    }
    return { status: "partial", amount: null, rows: [], message: "Pagination limit reached; account total withheld. Narrow the date range." };
  }
  async function balance(provider, key) {
    const url = provider === "atlas" ? "https://api.atlascloud.ai/public/v1/balance" : provider === "fal" ? "https://api.fal.ai/v1/account/billing?expand=credits" : "https://api.elevenlabs.io/v1/user/subscription";
    const data = await request(fetchImpl, url, key, provider);
    if (provider === "elevenlabs") {
      if (!Number.isInteger(data.character_limit) || !Number.isInteger(data.character_count) || data.character_limit < 0 || data.character_count < 0) throw new Error("Invalid allowance");
      return { status: "ready", amount: Math.max(0, data.character_limit - data.character_count), unit: "characters", scope: "current subscription period", message: "Remaining included character allowance; excludes possible paid overage. Not a dollar balance." };
    }
    if (provider === "atlas" && data.scope !== "account") throw new Error("Unexpected balance scope");
    const amount = provider === "atlas" ? money(data.available?.value, data.available?.currency) : money(data.credits?.current_balance, data.credits?.currency);
    return { status: "ready", amount, unit: "USD", scope: provider === "atlas" ? "account" : "workspace", message: "Current provider balance, independent of date/model/key filters. Not a per-key allocation." };
  }
  async function loadProvider(capability, query, key) {
    const base = { ...capability, fetchedAt: new Date(now()).toISOString(), spend: { status: "unsupported", amount: null, rows: [], message: capability.note }, balance: { status: "unsupported", amount: null, message: capability.note } };
    if (!capability.spend && !capability.balance) return base;
    if (!key) return { ...base, spend: capability.spend ? { ...base.spend, status: "not-configured", message: "No billing credential configured locally. See provider requirements." } : base.spend,
      balance: capability.balance ? { ...base.balance, status: "not-configured", message: "No credential configured locally." } : base.balance };
    const [spend, remaining] = await Promise.all([
      capability.spend ? costs(capability.provider, key, query).catch(error => ({ ...failure(error), amount: null, rows: [] })) : base.spend,
      capability.balance ? balance(capability.provider, key).catch(error => ({ ...failure(error), amount: null })) : base.balance
    ]);
    return { ...base, spend, balance: remaining };
  }
  return { capabilities: statsCapabilities, async load(raw) {
    const query = globalQuery(raw);
    const selected = statsCapabilities.filter(row => !query.provider || row.provider === query.provider);
    // Cache is bound to exact credential identity. Account changes cannot reuse old totals.
    const keys = Object.fromEntries(selected.map(row => [row.provider, getKey(row.provider) || ""]));
    const id = createHash("sha256").update(JSON.stringify([query, keys])).digest("hex");
    const cached = cache.get(id); if (cached && now() - cached.at < 60000) return cached.result;
    if (pending.has(id)) return pending.get(id);
    if (pending.size >= 3) throw Object.assign(new Error("Billing queries busy; retry shortly."), { status: 429 });
    const work = Promise.all(selected.map(row => loadProvider(row, query, keys[row.provider]))).then(providers => {
      const result = { query, providers, fetchedAt: new Date(now()).toISOString() };
      if (cache.size >= 30) cache.delete(cache.keys().next().value); cache.set(id, { at: now(), result }); return result;
    }).finally(() => pending.delete(id)); pending.set(id, work); return work;
  } };
}
