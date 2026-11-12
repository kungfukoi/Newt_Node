import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { recordedCostAmount, catalogTokenCost, getPricingCatalog, pricingQuote } from "../src/pricingCatalog.js";
import { atlasSeedream55LayersEndpoint, estimateAtlasVideoCost, estimateAtlasImageCost, estimateAtlasSeedance25Run, isAtlasSeedance25PricingEndpoint } from "../src/atlasPricing.js";
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

const isAtlasLayerDecomposition = item => canonicalProvider(item.provider) === "atlas"
  && item.mediaType === "image" && item.endpoint === atlasSeedream55LayersEndpoint;

const kreaNanoBananaProEndpoint = "/generate/image/google/nano-banana-pro";
const isKreaNanoBananaPro = item => canonicalProvider(item.provider) === "krea"
  && item.mediaType === "image" && item.endpoint === kreaNanoBananaProEndpoint;

// Exact native Gemini 3 Pro Image sizes, normalized for portrait and landscape.
const nanoBananaProSizes = new Map([
  ["1024x1024", "1K"], ["848x1264", "1K"], ["896x1200", "1K"],
  ["928x1152", "1K"], ["768x1376", "1K"], ["672x1584", "1K"],
  ["2048x2048", "2K"], ["1696x2528", "2K"], ["1792x2400", "2K"],
  ["1856x2304", "2K"], ["1536x2752", "2K"], ["1344x3168", "2K"],
  ["4096x4096", "4K"], ["3392x5056", "4K"], ["3584x4800", "4K"],
  ["3712x4608", "4K"], ["3072x5504", "4K"], ["2688x6336", "4K"]
]);

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
  } else if (canonicalProvider(item.provider) === "krea" && item.mediaType === "image") {
    const resolution = item.cost?.resolution ?? settings.resolution;
    if (isKreaNanoBananaPro(item) && ["1K", "2K", "4K"].includes(resolution)) {
      cost = pricingQuote("krea", item.endpoint, { resolution }, 1, snapshot);
    }
    if (item.endpoint === "/generate/image/bytedance/seedream-5-pro" && ["1.5K", "2K"].includes(item.cost?.resolution)
      && Number.isInteger(settings.imagePromptCount) && settings.imagePromptCount >= 0) {
      cost = pricingQuote("krea", item.endpoint, {
        resolutionTier: item.cost.resolution.toLowerCase(), referenceImageCount: Math.min(settings.imagePromptCount, 10)
      }, 1, snapshot);
    }
    if (cost) cost = { ...cost, unit: "image", units: 1, pricingBasis: "Krea published API estimate for the recorded billing settings." };
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

export function createHistoryPricing({ store, ledger, snapshot, atlasJobsDirectory, quoteAtlas = async () => null, readArchivedImageDimensions = async () => null }) {
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
    const layerQuotes = new Map();
    const ledgerOnly = before.records.filter(row => row.cost.amountUsd === null && !retained.has(statsEventId(row))
      && (isKreaNanoBananaPro(row) || isAtlasVideo(row) && isAtlasSeedance25PricingEndpoint(row.endpoint) || row.provider === "atlas" && row.atlasUsage?.length));
    for (const item of [...history, ...ledgerOnly]) {
      const identity = statsEventId(item);
      if (!(item.generationRunId || item.id) || recordedCostAmount(item.cost) !== null || updates.has(identity)) continue;
      const ledgerCost = ledgerCosts.get(identity);
      if (ledgerCost) {
        updates.set(identity, ledgerCost);
        continue;
      }
      let cost = completeGenerationCost(item, prices);
      if (recordedCostAmount(cost) === null && isKreaNanoBananaPro(item)
        && !item.cost?.resolution && !item.settings?.resolution && item.project?.id && item.project.id !== "unknown") {
        const dimensions = await readArchivedImageDimensions(item).catch(() => null);
        if (dimensions) {
          const { width, height } = dimensions;
          const resolution = nanoBananaProSizes.get([Math.min(width, height), Math.max(width, height)].join("x"));
          const quote = resolution && pricingQuote("krea", item.endpoint, { resolution }, 1, prices);
          if (quote) cost = { ...cost, ...quote, resolution, unit: "image", units: 1,
            pricingBasis: `Krea published ${resolution} API rate, inferred from the original archived image dimensions.` };
        }
      }
      let run = null;
      if (recordedCostAmount(cost) === null && isAtlasVideo(item) && atlasJobsDirectory) {
        run = await readAtlasPricingRun(atlasJobsDirectory, item).catch(() => null);
        if (run?.state && isAtlasSeedance25PricingEndpoint(item.endpoint)) {
          cost = estimateSavedAtlasRun(item, run, prices) ?? cost;
        }
      }
      // Serialized lookups avoid a burst of provider requests. Only original,
      // saved inputs may be quoted; never synthesize reference media.
      if (recordedCostAmount(cost) === null && isAtlasLayerDecomposition(item)) {
        const { resolution, outputImageCount, num_images: requestedCount } = item.settings ?? {};
        const num_images = outputImageCount ?? requestedCount;
        const fingerprint = item.keyIdentity?.fingerprint;
        if (fingerprint && ["auto", "1k", "1.5k", "2k"].includes(resolution)
          && Number.isInteger(num_images) && num_images > 0 && num_images <= 100) {
          const cacheKey = JSON.stringify([fingerprint, resolution, num_images]);
          if (!layerQuotes.has(cacheKey) && Date.now() < quoteDeadline) {
            const input = { model: item.endpoint, resolution, num_images };
            layerQuotes.set(cacheKey, await quoteAtlas(item, { credentialFingerprint: fingerprint, input }).catch(() => null));
          }
          const quote = layerQuotes.get(cacheKey);
          if (recordedCostAmount(quote) !== null) cost = { ...cost, ...quote,
            pricingBasis: outputImageCount == null
              ? "Atlas quote for the original requested output count."
              : "Atlas quote for the recorded provider output count." };
        }
      }
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
