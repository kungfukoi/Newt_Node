import { atlasSeedream55LayersEndpoint } from "../src/atlasPricing.js";
import { statsEventId } from "./stats-ledger.js";
import { canonicalProvider, recordedAmount } from "../src/statsAnalytics.js";

const retryDelays = [15_000, 60_000, 300_000, 1_800_000, 7_200_000, 86_400_000];

export function preparePostRunBilling(item, now = Date.now()) {
  const billing = { ...item.billing, requestId: item.billing?.requestId || item.requestId,
    resolution: item.billing?.resolution || item.cost?.resolution || item.settings?.resolution };
  item = { ...item, billing };
  if (!billing?.requestId || !item.keyIdentity?.fingerprint || billing.nextCheckAt || billing.attempts != null) return item;
  const amount = recordedAmount(item.cost);
  const provider = canonicalProvider(item.provider);
  const fal = provider === "fal" && item.mediaType !== "text" && !(item.cost?.units > 1 && item.cost.unit === "request")
    && (amount === null || item.cost?.estimated !== false);
  const atlas = provider === "atlas" && item.endpoint === atlasSeedream55LayersEndpoint && billing.outputCount > 0 && Boolean(billing.resolution) && amount === null;
  if (!fal && !atlas) return item;
  return { ...item, billing: { ...billing, attempts: 0, nextCheckAt: new Date(now + retryDelays[0]).toISOString() } };
}

export function createPostRunPricing({ ledger, store, lookup, now = Date.now, onError = () => {} }) {
  let running;
  async function checkDue() {
    const due = await ledger.dueBilling(new Date(now()).toISOString(), 8);
    for (const row of due) {
      const cost = await Promise.resolve().then(() => lookup(row)).catch(() => null);
      const found = recordedAmount(cost) !== null;
      const attempts = row.billing.attempts + 1;
      const delay = retryDelays[attempts];
      const billing = { ...row.billing, attempts, nextCheckAt: found || !delay ? "" : new Date(now() + delay).toISOString() };
      const updated = await ledger.updateBilling(row, billing, found ? { ...row.cost, ...cost } : null);
      if (updated && found) {
        await store.updateCosts(new Map([[statsEventId(row), updated.cost]]), statsEventId).catch(onError);
      }
    }
  }
  return () => running ||= checkDue().finally(() => { running = null; });
}
