import { generationQuoteKey, priceState, QUOTE_TTL_MS } from "./pricingTrust.js";

let catalog = { version: 1, revision: "bundled", entries: {} };
let reader = () => catalog;
const listeners = new Set();
const generationQuotes = new Map();
let quoteRevision = 0;

export function setPricingCatalog(value) {
  if (value?.version !== 1 || !value.entries || typeof value.entries !== "object") return;
  if (catalog.revision === value.revision && catalog.accountRevision === value.accountRevision) return;
  catalog = value;
  generationQuotes.clear();
  for (const listener of listeners) listener();
}

export function configurePricingReader(read) { reader = read; }
export function getPricingCatalog() { return reader(); }
export function subscribePricing(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function pricingRevision() { return `${catalog.revision}:${quoteRevision}`; }

export function setGenerationQuote(options, quote) {
  const checked = Date.parse(quote?.checkedAt);
  if (!quote || quote.accountRevision !== catalog.accountRevision || !Number.isFinite(checked)
    || checked > Date.now() + 60000 || Date.now() - checked >= QUOTE_TTL_MS
    || quote.amountUsd !== null && (!Number.isFinite(quote.amountUsd) || quote.amountUsd < 0)) return false;
  if (generationQuotes.size >= 200) generationQuotes.delete(generationQuotes.keys().next().value);
  generationQuotes.set(generationQuoteKey(options), quote);
  quoteRevision++;
  for (const listener of listeners) listener();
  return true;
}

export function getGenerationQuote(options) {
  const quote = generationQuotes.get(generationQuoteKey(options));
  return quote && Date.now() - Date.parse(quote.checkedAt) < QUOTE_TTL_MS ? quote : null;
}

export function recordedCostAmount(cost) {
  // Historical spend must not be reconstructed with today's price catalog.
  if (!cost || cost.amountUsd === null || cost.amountUsd === undefined || cost.amountUsd === "") return null;
  const amount = Number(cost.amountUsd);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function pricingQuote(provider, endpoint, dimensions = {}, quantity = 1, snapshot = reader()) {
  const entry = snapshot?.entries?.[`${provider}:${endpoint}`];
  if (!entry || entry.currency !== "USD" || !Array.isArray(entry.points)) return null;
  const state = priceState(entry, snapshot.capturedAt ? Date.parse(snapshot.capturedAt) : Date.now());
  if (entry.invalidatedAt || (snapshot.policyVersion >= 2 && !["current", "stale"].includes(state))) return null;
  // Exact dimensions only: never infer a new billing tier or interpolate provider prices.
  const matches = entry.points.filter((point) => Object.keys(point.dimensions).length === Object.keys(dimensions).length
    && Object.entries(point.dimensions).every(([key, value]) => dimensions[key] === value));
  if (matches.length !== 1 || !Number.isFinite(matches[0].amount) || matches[0].amount < 0 || !Number.isFinite(quantity) || quantity < 0) return null;
  return {
    amountUsd: Math.round(matches[0].amount * quantity * 1e6) / 1e6,
    currency: "USD", estimated: true,
    pricingSource: entry.source, pricingCheckedAt: entry.checkedAt, pricingVersion: snapshot.revision,
    pricingStatus: state === "stale" ? "stale" : "estimated"
  };
}

export function applyPricingQuote(cost, provider, endpoint, dimensions = {}, quantity = 1) {
  const quote = pricingQuote(provider, endpoint, dimensions, quantity);
  if (quote) return { ...cost, ...quote, unitRateUsd: cost.units > 0 ? quote.amountUsd / cost.units : quote.amountUsd,
    pricingBasis: `${provider === "krea" ? "Krea" : "Fal"} published API estimate for the selected billing settings` };
  const entry = reader()?.entries?.[`${provider}:${endpoint}`];
  // A rejected/expired live contract must not silently resurrect a hard-coded rate.
  return entry ? { ...cost, amountUsd: null, unitRateUsd: null, pricingStatus: "unavailable",
    pricingBasis: "No current verified price for these billing settings." }
    : { ...cost, estimated: true, pricingStatus: "bundled" };
}

export function currentOpenAiRates(bundled, snapshot = reader()) {
  return Object.fromEntries(Object.entries(bundled).map(([model, base]) => {
    const rate = { ...base };
    for (const context of ["short", "long"]) {
      const resolved = Object.fromEntries(["input", "cached", "writes", "output"].map((metric) =>
        [metric, pricingQuote("openai", model, { context, metric }, 1, snapshot)?.amountUsd]));
      if (Object.values(resolved).every(Number.isFinite)) {
        if (context === "short") Object.assign(rate, resolved);
        else rate.long = resolved;
      }
    }
    return [model, rate];
  }));
}

export function catalogTokenCost(provider, model, usage) {
  const normalized = String(provider || "").toLowerCase().replace(" cloud", "");
  if (!["openai", "atlas"].includes(normalized) || !model || !usage) return null;
  const input = usage.input_tokens ?? usage.prompt_tokens, output = usage.output_tokens ?? usage.completion_tokens;
  if (![input,output].every(value=>typeof value === "number" && Number.isFinite(value) && value >= 0)) return null;
  const endpoint = (normalized === "atlas" ? "openai/" : "") + String(model).replace(/^openai\//, "");
  const context = input > 272000 ? "long" : "short";
  const rates = Object.fromEntries(["input","cached","writes","output"].map(metric=>[metric,pricingQuote(normalized,endpoint,{context,metric})]));
  if (Object.values(rates).some(rate=>!rate)) return null;
  const details = usage.input_tokens_details || usage.prompt_tokens_details || {};
  const cached = Math.min(input, Math.max(0, Number(details.cached_tokens)||0));
  const writes = Math.min(input-cached,Math.max(0,Number(details.cache_write_tokens ?? usage.cache_write_tokens)||0));
  const amountUsd = ((input-cached-writes)*rates.input.amountUsd+cached*rates.cached.amountUsd+writes*rates.writes.amountUsd+output*rates.output.amountUsd)/1e6;
  return {...rates.input,amountUsd,unit:"request",units:1,pricingBasis:"Recorded token usage at the captured verified rate; not a settled charge."};
}
