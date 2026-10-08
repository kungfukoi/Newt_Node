// Shared analytics contract: recorded amounts only, never today's model prices.
export const providerLabels = { atlas: "Atlas Cloud", fal: "Fal", krea: "Krea", openai: "OpenAI", google: "Google", elevenlabs: "ElevenLabs", local: "Local", unknown: "Unknown provider" };
export const defaultFilters = () => ({ range: "30", start: "", end: "", provider: "", workflow: "", model: "", key: "", status: "", search: "" });

export function canonicalProvider(value) {
  const route = String(value || "").toLowerCase();
  for (const provider of ["fal", "local", "google", "openai", "atlas", "krea"]) if (route.startsWith(`${provider}-`)) return provider;
  const text = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  return ({ atlascloud: "atlas", cloudatlas: "atlas", falai: "fal", openai: "openai", googleai: "google", elevenlabs: "elevenlabs", comfyui: "local" })[text] || (Object.hasOwn(providerLabels, text) ? text : "unknown");
}

// Exports and browser responses are allowlists. Nested settings/provider payloads
// and prompts are deliberately excluded, even when supplied by an import.
export function safeLabel(value, fallback = "") {
  return String(value ?? fallback).slice(0, 300).replace(/(?:Bearer\s+\S+|(?:sk-|apikey-|key-)[a-zA-Z0-9_-]{8,}|AIza[a-zA-Z0-9_-]{20,}|[a-f0-9-]{32,36}:[a-f0-9-]{32,36})/gi, "[redacted]");
}
export function recordedAmount(cost) {
  const value = cost?.amountUsd;
  if (cost?.currency && String(cost.currency).toUpperCase() !== "USD") return null;
  if (!(typeof value === "number" || typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value))) return null;
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
}
export function normalizeStatsRecord(item = {}) {
  const provider = canonicalProvider(item.provider);
  const fingerprint = String(item.keyIdentity?.fingerprint || "");
  const keyId = /^[a-f0-9]{64}$/.test(fingerprint) ? `${provider}:${fingerprint}` : "unknown";
  const amountUsd = recordedAmount(item.cost);
  const createdAt = Number.isFinite(Date.parse(item.createdAt)) ? new Date(item.createdAt).toISOString() : "";
  const workflowId = safeLabel(item.project?.id || item.workflow?.id || "unknown");
  return {
    id: safeLabel(item.id), generationRunId: safeLabel(item.generationRunId), createdAt,
    provider, modelName: safeLabel(item.modelName || "Unknown model"),
    mediaType: ["image", "video", "text", "audio", "model3d"].includes(item.mediaType) ? item.mediaType : "other",
    project: { id: workflowId, name: safeLabel(item.project?.name || item.workflow?.name || "Unassigned workflow"), fileName: safeLabel(String(item.project?.fileName || item.workflow?.fileName || "").split(/[\\/]/).at(-1)) },
    keyIdentity: keyId === "unknown" ? null : { fingerprint }, keyId,
    keyLabel: keyId === "unknown" ? "Unknown key (legacy / unattributed)" : `${providerLabels[provider]} key ${fingerprint.slice(0, 10)}`,
    status: safeLabel(item.status || "completed"), endpoint: safeLabel(item.endpoint),
    cost: { amountUsd, currency: "USD", estimated: amountUsd === null ? null : item.cost?.estimated !== false,
      pricingBasis: safeLabel(item.cost?.pricingBasis), pricingSource: safeLabel(item.cost?.pricingSource), pricingCheckedAt: safeLabel(item.cost?.pricingCheckedAt) }
  };
}

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return dateKey(date) === value ? date : null;
}
export function resolveDateRange(filters, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = filters.range === "custom" ? parseDay(filters.start) : new Date(today);
  const endDay = filters.range === "custom" ? parseDay(filters.end) : today;
  if (!start || !endDay || endDay < start) return { error: "Choose a valid start and end date; end must follow start." };
  if (filters.range !== "custom") start.setDate(start.getDate() - (filters.range === "5" ? 4 : 29));
  const end = new Date(endDay); end.setDate(end.getDate() + 1);
  const days = [];
  for (let date = new Date(start); date < end && days.length <= 366; date.setDate(date.getDate() + 1)) days.push({ key: dateKey(date), date: new Date(date), count: 0, cost: 0, pricedCount: 0 });
  if (days.length > 366) return { error: "Choose a range of at most 366 days." };
  return { start, end, days, label: `${dateKey(start)} to ${dateKey(endDay)}` };
}

export function uniqueRecords(history = []) {
  const map = new Map(); let duplicates = 0;
  for (const [index, raw] of history.entries()) {
    const row = normalizeStatsRecord(raw);
    const key = `${row.provider}:${row.generationRunId || row.id || `unidentified-${index}`}`;
    const previous = map.get(key);
    if (previous) { duplicates++; if (previous.cost.amountUsd !== null && !(previous.cost.estimated && row.cost.estimated === false && row.cost.amountUsd !== null)) continue; }
    map.set(key, row);
  }
  return { rows: [...map.values()], duplicates };
}
export function aggregateRecords(rows, dimension) {
  const map = new Map();
  for (const row of rows) {
    const [id, name] = dimension === "workflow" ? [row.project.id, `${row.project.name}${row.project.fileName ? ` · ${row.project.fileName}` : ""}`]
      : dimension === "provider" ? [row.provider, providerLabels[row.provider]] : dimension === "key" ? [row.keyId, row.keyLabel] : [row.modelName, row.modelName];
    const group = map.get(id) || { id, name, count: 0, pricedCount: 0, unpricedCount: 0, cost: 0, actual: 0, estimated: 0 };
    group.count++;
    if (row.cost.amountUsd === null) group.unpricedCount++;
    else { group.pricedCount++; group.cost += row.cost.amountUsd; group[row.cost.estimated ? "estimated" : "actual"] += row.cost.amountUsd; }
    map.set(id, group);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));
}
export function buildAnalytics(history, filters = defaultFilters(), now = new Date()) {
  const range = resolveDateRange(filters, now);
  const unique = uniqueRecords(history);
  const invalidDates = unique.rows.filter(row => !row.createdAt).length;
  const rows = range.error ? [] : unique.rows.filter(row => {
    const date = new Date(row.createdAt);
    return row.createdAt && date >= range.start && date < range.end && date <= now
      && (!filters.provider || row.provider === filters.provider) && (!filters.workflow || row.project.id === filters.workflow)
      && (!filters.model || row.modelName === filters.model) && (!filters.key || row.keyId === filters.key)
      && (!filters.status || (filters.status === "unpriced" ? row.cost.amountUsd === null : row.status === filters.status))
      && (!filters.search || [row.id, row.generationRunId, row.modelName, row.project.name, row.project.fileName].join(" ").toLowerCase().includes(filters.search.toLowerCase()));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const days = range.days || [];
  const dayMap = new Map(days.map(day => [day.key, day]));
  let total = 0, actual = 0, estimated = 0, pricedCount = 0;
  for (const row of rows) {
    const day = dayMap.get(dateKey(new Date(row.createdAt))); day.count++;
    if (row.cost.amountUsd !== null) { pricedCount++; total += row.cost.amountUsd; day.cost += row.cost.amountUsd; day.pricedCount++; if (row.cost.estimated) estimated += row.cost.amountUsd; else actual += row.cost.amountUsd; }
  }
  const options = Object.fromEntries(["provider", "workflow", "model", "key"].map(dimension => [dimension, aggregateRecords(unique.rows, dimension)]));
  return { range, rows, days, total: pricedCount ? total : null, actual, estimated, pricedCount, unpricedCount: rows.length - pricedCount,
    average: pricedCount ? total / pricedCount : null, options, duplicates: unique.duplicates, invalidDates,
    breakdowns: Object.fromEntries(["provider", "workflow", "model", "key"].map(dimension => [dimension, aggregateRecords(rows, dimension)])) };
}
export function formatMoney(value, currency = "USD") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Unavailable";
  const amount = Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: Math.abs(amount) > 0 && Math.abs(amount) < 0.01 ? 6 : 2 }).format(amount);
}
