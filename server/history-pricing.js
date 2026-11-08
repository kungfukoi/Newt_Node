import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { recordedCostAmount, catalogTokenCost, getPricingCatalog } from "../src/pricingCatalog.js";
import { estimateAtlasVideoCost, estimateAtlasImageCost, estimateAtlasSeedance25Run, isAtlasSeedance25PricingEndpoint } from "../src/atlasPricing.js";
import { statsEventId } from "./stats-ledger.js";
import { canonicalProvider, providerLabels, recordedAmount } from "../src/statsAnalytics.js";

export async function readAtlasPricingRun(directory, item) {
  if (!item.generationRunId) return null;
  const name = createHash("sha256").update(item.generationRunId).digest("hex");
  const spec = JSON.parse(await readFile(path.join(directory, name + ".spec.json"), "utf8"));
  if (spec.provider !== "atlas" || spec.input?.model !== item.endpoint) return null;
  const state = await readFile(path.join(directory, name + ".state.json"), "utf8")
    .then(JSON.parse, () => null);
  return { spec, state: state?.state === "completed" && state.runId === item.generationRunId ? state : null };
}

const isAtlasVideo = item => canonicalProvider(item.provider) === "atlas" && item.mediaType === "video";

function estimateSavedAtlasRun(item, run, snapshot) {
  const spec = run?.spec;
  const settings = { ...item.settings, ...spec?.settings };
  const video = run?.state?.result?.video ?? item.remoteVideo;
  if (spec?.input?.resolution) settings.resolution = spec.input.resolution;
  if (spec?.input?.draft === true) settings.seedanceDraft = true;
  if (settings.referenceVideoDurationSeconds == null && spec?.referenceVideoDurationSeconds > 0)
    settings.referenceVideoDurationSeconds = spec.referenceVideoDurationSeconds;
  settings.videoOutpaint = run?.state?.outpaintFinished?.details ?? item.settings?.videoOutpaint;
  return estimateAtlasSeedance25Run({ endpoint: item.endpoint, settings,
    video: video ?? { duration: item.videoDurationSeconds }, snapshot });
}

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
    const usage = item.usage ?? item.atlasUsage;
    const requests = usage?.request !== undefined ? [usage.request, ...(usage.helpers || [])].filter(Boolean)
      : Array.isArray(usage) ? usage : usage ? [usage] : [];
    const costs = requests.map(request => catalogTokenCost(item.provider, item.modelName, request, snapshot));
    if (costs.length && costs.every(Boolean)) cost = { ...costs[0], amountUsd: costs.reduce((sum, row) => sum + row.amountUsd, 0),
      units: costs[0].unit === "million tokens" ? costs.reduce((sum, row) => sum + row.units, 0) : costs.length };
  } else if (canonicalProvider(item.provider) === "atlas") {
    // The recorded endpoint is authoritative, including legacy display names.
    if (isAtlasVideo(item) && isAtlasSeedance25PricingEndpoint(item.endpoint)) cost = estimateSavedAtlasRun(item, null, snapshot);
    else if (item.mediaType === "video" && settings.referenceVideoCount != null) cost = estimateAtlasVideoCost({
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

export function createHistoryPricing({ store, ledger, snapshot, atlasJobsDirectory, quoteAtlas = async () => null }) {
  let pending;
  let operations = Promise.resolve();
  function enqueue(operation) {
    const result = operations.then(operation);
    operations = result.catch(() => {});
    return result;
  }
  async function reconcile() {
    const history = await store.read();
    const before = await ledger.snapshot(history);
    const ledgerCosts = new Map(before.records.filter(row => row.cost.amountUsd !== null).map(row => [statsEventId(row), row.cost]));
    const prices = snapshot();
    const updates = new Map();
    const estimated = new Set();
    const checkedAt = new Date().toISOString();
    const quoteDeadline = Date.now() + 20000;
    const retained = new Set(history.map(statsEventId));
    const ledgerOnly = before.records.filter(row => row.cost.amountUsd === null && !retained.has(statsEventId(row))
      && (isAtlasVideo(row) && isAtlasSeedance25PricingEndpoint(row.endpoint) || row.provider === "atlas" && row.atlasUsage?.length));
    for (const item of [...history, ...ledgerOnly]) {
      const identity = statsEventId(item);
      if (!(item.generationRunId || item.id) || recordedCostAmount(item.cost) !== null || updates.has(identity)) continue;
      const ledgerCost = ledgerCosts.get(identity);
      if (ledgerCost) {
        updates.set(identity, ledgerCost);
        continue;
      }
      let cost = completeGenerationCost(item, prices);
      let run = null;
      if (recordedCostAmount(cost) === null && isAtlasVideo(item) && atlasJobsDirectory) {
        run = await readAtlasPricingRun(atlasJobsDirectory, item).catch(() => null);
        if (run?.state && isAtlasSeedance25PricingEndpoint(item.endpoint)) {
          cost = estimateSavedAtlasRun(item, run, prices) ?? cost;
        }
      }
      // Serialized lookups avoid a burst of provider requests. Only original,
      // saved inputs may be quoted; never synthesize reference media.
      if (recordedCostAmount(cost) === null && isAtlasVideo(item) && Date.now() < quoteDeadline) {
        const quote = await quoteAtlas(item, run?.spec).catch(() => null);
        if (recordedCostAmount(quote) !== null) cost = { ...cost, ...quote };
      }
      if (recordedCostAmount(cost) === null) continue;
      estimated.add(identity);
      updates.set(identity, { ...cost, reconciledAt: checkedAt, previousCost: item.cost ?? null,
        ...(cost.pricingStatus === "local" ? {} : { estimated: true, pricingStatus: "estimated",
          pricingBasis: "Historical estimate using the recorded price source and current account rates where quoted; not the original billed charge. " + cost.pricingBasis }) });
    }
    const saved = await store.updateCosts(updates, statsEventId);
    const savedIds = new Set(saved.map(statsEventId));
    const evicted = [...history, ...ledgerOnly].flatMap(item => {
      const identity = statsEventId(item);
      const cost = updates.get(identity);
      return cost && !savedIds.has(identity) ? [{ ...item, cost }] : [];
    });
    const after = await ledger.snapshot([...saved, ...evicted]);
    return { updated: after.records.filter(row => estimated.has(statsEventId(row)) && row.cost.reconciledAt === checkedAt).length,
      unpriced: after.records.filter(row => row.cost.amountUsd === null).length, total: after.records.length };
  }

  async function recordCharge(input) {
    const { provider, runId, amountUsd } = input || {};
    if (typeof provider !== "string" || !Object.hasOwn(providerLabels, provider) || typeof runId !== "string" ||
        !runId.trim() || runId.length > 300 || typeof amountUsd !== "number" || recordedAmount({ amountUsd }) === null) {
      throw Object.assign(new Error("Choose a recorded run and enter a valid non-negative USD charge."), { status: 400 });
    }
    const identity = statsEventId({ provider, id: runId });
    const history = await store.read();
    await ledger.snapshot(history);
    const cost = await ledger.recordCharge(identity, {
      amountUsd, currency: "USD", estimated: false, pricingSource: "manual-provider-billing",
      pricingBasis: "USD charge entered from provider billing for this run.",
      pricingCheckedAt: new Date().toISOString()
    });
    // The ledger is authoritative. A retry with the same charge can repair a failed History write.
    let historySynced = true;
    try { await store.updateCosts(new Map([[identity, cost]]), statsEventId); }
    catch { historySynced = false; }
    return { cost, historySynced };
  }

  return {
    reconcile: () => pending ||= enqueue(reconcile).finally(() => { pending = null; }),
    recordCharge: input => enqueue(() => recordCharge(input))
  };
}
