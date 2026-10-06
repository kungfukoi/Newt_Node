import { recordedCostAmount, catalogTokenCost, getPricingCatalog } from "../src/pricingCatalog.js";
import { estimateAtlasVideoCost, estimateAtlasImageCost } from "../src/atlasPricing.js";

// Never replace recorded money with today's rates. Historical estimates are an
// explicit reconciliation operation, distinct from ordinary history reads.
export function completeGenerationCost(item, snapshot = getPricingCatalog()) {
  if (recordedCostAmount(item.cost) !== null) return item.cost;
  const settings = item.settings || {};
  let cost = null;
  if (item.provider === "local" && item.modelName === "NewtNode Director" && !item.usage) {
    cost = { amountUsd: 0, currency: "USD", estimated: false, pricingStatus: "local",
      pricingBasis: "Local Director planning; no paid provider request.", pricingSource: "local" };
  } else if (item.mediaType === "text") {
    const usage = item.usage;
    const requests = usage?.request !== undefined ? [usage.request, ...(usage.helpers || [])].filter(Boolean)
      : Array.isArray(usage) ? usage : usage ? [usage] : [];
    const costs = requests.map(request => catalogTokenCost(item.provider, item.modelName, request, snapshot));
    if (costs.length && costs.every(Boolean)) cost = { ...costs[0], amountUsd: costs.reduce((sum, row) => sum + row.amountUsd, 0), units: costs.length };
  } else if (item.provider === "Atlas Cloud") {
    // The recorded endpoint is authoritative, including legacy display names.
    if (item.mediaType === "video" && settings.referenceVideoCount != null) cost = estimateAtlasVideoCost({
      model: item.endpoint, duration: settings.duration, resolution: settings.resolution,
      referenceImageCount: settings.referenceImageCount, startFrameCount: settings.startFrameCount,
      hasVideoReference: settings.referenceVideoCount > 0, snapshot
    });
    if (item.mediaType === "image") cost = estimateAtlasImageCost({ model: item.endpoint,
      resolution: settings.resolution, referenceCount: item.cost?.referenceCount ?? settings.referenceImageCount, snapshot });
  }
  return recordedCostAmount(cost) !== null ? { ...item.cost, ...cost } : { ...item.cost,
    amountUsd: null, currency: "USD", pricingStatus: "unavailable",
    pricingBasis: cost?.pricingBasis || item.cost?.pricingBasis || "Provider charge or sufficient billing settings were not returned." };
}

export function createHistoryPricing({ store, snapshot, quoteAtlas = async () => null }) {
  let pending;
  async function reconcile() {
    const history = await store.read();
    const prices = snapshot();
    const updates = new Map();
    const checkedAt = new Date().toISOString();
    for (const item of history) {
      if (recordedCostAmount(item.cost) !== null) continue;
      let cost = completeGenerationCost(item, prices);
      // Serialized lookups avoid a burst of provider requests. Only original,
      // saved inputs may be quoted; never synthesize reference media.
      if (item.provider === "Atlas Cloud" && item.mediaType === "video") {
        const quote = await quoteAtlas(item).catch(() => null);
        if (recordedCostAmount(quote) !== null) cost = { ...cost, ...quote };
      }
      if (recordedCostAmount(cost) === null) continue;
      updates.set(item.id, { ...cost, reconciledAt: checkedAt, previousCost: item.cost ?? null,
        ...(cost.pricingStatus === "local" ? {} : { estimated: true, pricingStatus: "estimated",
          pricingBasis: "Historical estimate using the recorded price source and current account rates where quoted; not the original billed charge. " + cost.pricingBasis }) });
    }
    const saved = await store.updateCosts(updates);
    return { updated: saved.filter(item => updates.has(item.id) && item.cost?.reconciledAt === checkedAt).length,
      unpriced: saved.filter(item => recordedCostAmount(item.cost) === null).length, total: saved.length };
  }
  return { reconcile: () => pending ||= reconcile().finally(() => { pending = null; }) };
}
