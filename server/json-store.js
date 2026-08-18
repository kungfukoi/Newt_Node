import path from "node:path";
import { mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  copyFileWithRetry,
  readFileWithRetry,
  renameFileWithRetry,
  statFileWithRetry,
  writeFileWithRetry
} from "./file-write.js";

export async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFileWithRetry(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const json = JSON.stringify(value, null, 2);
  JSON.parse(json);
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);

  try {
    await writeFileWithRetry(tempPath, json);
    try {
      await renameFileWithRetry(tempPath, filePath, { attempts: 3, initialDelayMs: 50, maximumDelayMs: 100 });
    } catch (error) {
      if (!["EPERM", "EACCES", "EEXIST"].includes(error?.code)) throw error;
      await copyFileWithRetry(tempPath, filePath);
      await rm(tempPath, { force: true }).catch(() => {});
    }
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
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
