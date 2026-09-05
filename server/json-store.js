import path from "node:path";
import { mkdir, open, readdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  readFileWithRetry,
  renameFileWithRetry,
  retryTransientFileOperation,
  statFileWithRetry
} from "./file-write.js";

const pendingWrites = new Map();

export async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFileWithRetry(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJsonAtomic(filePath, value, { renameFile = renameFileWithRetry } = {}) {
  const key = path.resolve(filePath);
  const json = JSON.stringify(value, null, 2);
  JSON.parse(json);
  const operation = (pendingWrites.get(key) || Promise.resolve()).catch(() => {}).then(() => replaceJson(filePath, json, renameFile));
  pendingWrites.set(key, operation);
  operation.finally(() => {
    if (pendingWrites.get(key) === operation) pendingWrites.delete(key);
  }).catch(() => {});
  return operation;
}

async function replaceJson(filePath, json, renameFile) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);

  try {
    await retryTransientFileOperation(async () => {
      const handle = await open(tempPath, "w");
      try {
        await handle.writeFile(json, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
    });
    // Never copy over a live document: readers must see the old or new JSON in full.
    await renameFile(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

export async function fileMetadata(filePath) {
  try {
    const metadata = await statFileWithRetry(filePath);
    return {
      exists: true,
      size: metadata.size,
      mtimeMs: Math.round(metadata.mtimeMs),
      updatedAt: metadata.mtime.toISOString()
    };
  } catch {
    return {
      exists: false,
      size: 0,
      mtimeMs: 0,
      updatedAt: ""
    };
  }
}

export async function directoryStats(directoryPath) {
  const result = {
    path: directoryPath,
    exists: existsSync(directoryPath),
    files: 0,
    bytes: 0
  };
  if (!result.exists) return result;

  const entries = await readdir(directoryPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      const child = await directoryStats(entryPath);
      result.files += child.files;
      result.bytes += child.bytes;
    } else if (entry.isFile()) {
      const metadata = await fileMetadata(entryPath);
      result.files += 1;
      result.bytes += metadata.size;
    }
  }

  return result;
}
