import { createHash } from "node:crypto";
import path from "node:path";
import { stat } from "node:fs/promises";
import { readJsonFile, writeJsonAtomic } from "./json-store.js";

const version = 1;
export const objectSourceHash = buffer => createHash("sha256").update(buffer).digest("hex");
export const objectQueryKey = options => JSON.stringify(options);

function validEntry(entry) {
  if (!entry?.options || entry.key !== objectQueryKey(entry.options) || !Array.isArray(entry.data?.masks) || entry.data.masks.length > 128) return false;
  let total = 0;
  return entry.data.masks.every(mask => {
    if (!mask || typeof mask.id !== "string" || !Number.isInteger(mask.width) || !Number.isInteger(mask.height) || mask.width < 1 || mask.height < 1 || mask.width > 1024 || mask.height > 1024 || !Array.isArray(mask.runs) || mask.runs.length % 2) return false;
    total += mask.runs.length;
    if (total > 2000000) return false;
    let end = 0, area = 0;
    for (let i = 0; i < mask.runs.length; i += 2) {
      const start = mask.runs[i], length = mask.runs[i + 1];
      if (!Number.isInteger(start) || !Number.isInteger(length) || start < end || length <= 0 || start + length > mask.width * mask.height) return false;
      end = start + length; area += length;
    }
    return mask.area === area;
  });
}

// Files contain only compact masks and settings, never image URLs or credentials.
export function createObjectSelectionCache(directory) {
  const pending = new Map();
  const file = hash => {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid object scan identity.");
    return path.join(directory, `${hash}.json`);
  };
  async function get(hash) {
    const target = file(hash);
    if ((await stat(target).catch(() => null))?.size > 64 * 1024 * 1024) return [];
    const record = await readJsonFile(target, null);
    if (record?.version !== version || !Array.isArray(record.entries) || record.entries.length > 12) return [];
    return record.entries.filter(validEntry);
  }
  function update(hash, change) {
    const operation = (pending.get(hash) || Promise.resolve()).catch(() => {}).then(async () => {
      let entries = change(await get(hash)).slice(-12);
      const runs = () => entries.reduce((sum, entry) => sum + entry.data.masks.reduce((n, mask) => n + mask.runs.length, 0), 0);
      while (entries.length > 1 && runs() > 2000000) entries.shift();
      await writeJsonAtomic(file(hash), { version, entries });
      return entries;
    });
    pending.set(hash, operation);
    operation.finally(() => { if (pending.get(hash) === operation) pending.delete(hash); }).catch(() => {});
    return operation;
  }
  return {
    get,
    put: (hash, options, data) => update(hash, entries => {
      const key = objectQueryKey(options);
      return [...entries.filter(entry => entry.key !== key), { key, options, data, scannedAt: new Date().toISOString() }];
    }),
    inherit: (hash, entries) => update(hash, current => {
      const keys = new Set(current.map(entry => entry.key));
      // An existing scan of the target always wins over an inherited map.
      return [...entries.filter(entry => !keys.has(entry.key)).map(entry => ({ ...entry, data: { ...entry.data, inherited: true } })), ...current];
    })
  };
}
