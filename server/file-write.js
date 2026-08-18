import { copyFile, readFile, rename, stat, writeFile } from "node:fs/promises";

const transientWindowsFileCodes = new Set(["EACCES", "EBUSY", "EPERM", "ETXTBSY"]);

export function isTransientFileWriteError(error) {
  return transientWindowsFileCodes.has(String(error?.code || "").toUpperCase());
}

export async function retryTransientFileOperation(operation, options = {}) {
  const attempts = Math.max(1, Number(options.attempts) || 12);
  const initialDelayMs = Math.max(0, Number(options.initialDelayMs) || 100);
  const maximumDelayMs = Math.max(initialDelayMs, Number(options.maximumDelayMs) || 1000);
  const delayFn = options.delayFn || delay;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientFileWriteError(error) || attempt === attempts) throw error;
      const waitMs = Math.min(maximumDelayMs, initialDelayMs * (2 ** (attempt - 1)));
      await delayFn(waitMs);
    }
  }
}

export function writeFileWithRetry(filePath, data, fileOptions, retryOptions) {
  return retryTransientFileOperation(() => writeFile(filePath, data, fileOptions), retryOptions);
}

export function copyFileWithRetry(sourcePath, targetPath, retryOptions) {
  return retryTransientFileOperation(() => copyFile(sourcePath, targetPath), retryOptions);
}

export function readFileWithRetry(filePath, fileOptions, retryOptions) {
  return retryTransientFileOperation(() => readFile(filePath, fileOptions), retryOptions);
}

export function renameFileWithRetry(sourcePath, targetPath, retryOptions) {
  return retryTransientFileOperation(() => rename(sourcePath, targetPath), retryOptions);
}

export function statFileWithRetry(filePath, retryOptions) {
  return retryTransientFileOperation(() => stat(filePath), retryOptions);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
