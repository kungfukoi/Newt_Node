import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { writeJsonAtomic } from "./json-store.js";
import { normalizeStatsRecord } from "../src/statsAnalytics.js";

export function statsEventId(item) {
  const row = normalizeStatsRecord(item);
  const anonymousIdentity = [row.createdAt, row.project.id, row.modelName, row.endpoint, row.mediaType];
  // Price, display name, filename and key enrichment must not create a second event.
  return createHash("sha256").update(JSON.stringify([row.provider, row.generationRunId || row.id || anonymousIdentity])).digest("hex");
}
export function mergeStatsRecords(existing, incoming) {
  const indexed = rows => {
    const occurrences = new Map();
    return rows.map(raw => {
      const row = normalizeStatsRecord(raw), signature = statsEventId(row);
      if (row.id || row.generationRunId) return [signature, row];
      const occurrence = occurrences.get(signature) || 0; occurrences.set(signature, occurrence + 1);
      return [`${signature}:anonymous:${occurrence}`, row];
    });
  };
  const records = new Map(indexed(existing));
  let duplicates = 0;
  for (const [id, row] of indexed(incoming)) {
    const prior = records.get(id);
    if (prior) {
      duplicates++;
      // Reconciliation may fill unknown costs; never replace a known charge with an estimate.
      const keepPrior = prior.cost.amountUsd !== null && !(prior.cost.estimated && row.cost.estimated === false && row.cost.amountUsd !== null);
      const atlasUsage = row.atlasUsage ?? prior.atlasUsage;
      const billing = (prior.billing?.attempts ?? -1) >= (row.billing?.attempts ?? -1) ? prior.billing ?? row.billing : row.billing;
      records.set(id, {
        ...(keepPrior ? prior : row),
        ...(atlasUsage ? { atlasUsage } : {}),
        ...(billing ? { billing } : {}),
        videoDurationSeconds: prior.videoDurationSeconds ?? row.videoDurationSeconds,
        fastMode: prior.fastMode || row.fastMode
      });
      continue;
    }
    records.set(id, row);
  }
  return { records: [...records.values()], duplicates, anonymousCount: incoming.filter(row => !row.id && !row.generationRunId).length };
}
export function createStatsLedger({ filePath, now = () => new Date().toISOString() }) {
  let queue = Promise.resolve();
  const enqueue = fn => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
  async function read() {
    try {
      const document = JSON.parse(await readFile(filePath, "utf8"));
      if (document.version !== 1 || !Array.isArray(document.records) || document.records.some(row => !row || typeof row !== "object")) throw new Error("Invalid ledger");
      return { ...document, records: document.records.map(normalizeStatsRecord) };
    } catch (error) {
      if (error.code === "ENOENT") return { version: 1, trackingStartedAt: now(), records: [] };
      throw Object.assign(new Error("Accounting ledger unavailable; existing records preserved."), { status: 503 });
    }
  }
  async function save(document, records) {
    const next = { ...document, records };
    if (JSON.stringify(next) !== JSON.stringify(document) || !document.savedAt) {
      if (document.savedAt) await writeJsonAtomic(`${filePath}.bak`, document);
      next.savedAt = now(); await writeJsonAtomic(filePath, next);
    }
    return next;
  }
  async function ingest(rows) {
    const document = await read();
    return save(document, mergeStatsRecords(document.records, rows).records);
  }
  return {
    append: item => enqueue(() => ingest([item.id || item.generationRunId ? item : { ...item, id: `ledger-anonymous-${randomUUID()}` }])),
    snapshot: history => enqueue(() => ingest(history)),
    dueBilling: (now, limit) => enqueue(async () => {
      const document = await read();
      return document.records.filter(row => row.billing?.requestId && row.keyIdentity && row.billing.nextCheckAt && row.billing.nextCheckAt <= now
        && (row.cost.amountUsd === null || row.cost.estimated))
        .sort((a, b) => a.billing.nextCheckAt.localeCompare(b.billing.nextCheckAt)).slice(0, limit);
    }),
    updateBilling: (expected, billing, cost) => enqueue(async () => {
      const document = await read();
      const identity = statsEventId(expected);
      const index = document.records.findIndex(row => statsEventId(row) === identity);
      if (index < 0) return null;
      const row = document.records[index];
      if (row.billing?.requestId !== expected.billing.requestId || row.billing?.nextCheckAt !== expected.billing.nextCheckAt
        || (row.cost.amountUsd !== null && !row.cost.estimated)) return null;
      const updated = normalizeStatsRecord({ ...row, billing, cost: cost ?? row.cost });
      await save(document, document.records.with(index, updated));
      return updated;
    }),
    recordCharge: (identity, cost) => enqueue(async () => {
      const document = await read();
      const index = document.records.findIndex(row => (row.generationRunId || row.id) && statsEventId(row) === identity);
      if (index < 0) throw Object.assign(new Error("Run not found. Refresh Stats and try again."), { status: 404 });
      const row = document.records[index];
      if (row.cost.amountUsd !== null) {
        if (row.cost.pricingSource === cost.pricingSource && row.cost.amountUsd === cost.amountUsd) return row.cost;
        throw Object.assign(new Error("This run already has a recorded price. Refresh Stats to see it."), { status: 409 });
      }
      const updated = normalizeStatsRecord({ ...row, cost });
      await save(document, document.records.with(index, updated));
      return updated.cost;
    }),
    // Preview is intentionally read-only. No imports are silently added to Local scope.
    preview: rows => enqueue(async () => mergeStatsRecords((await read()).records, rows))
  };
}
