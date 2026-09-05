import { randomUUID } from "node:crypto";
import { readFileWithRetry, writeFileWithRetry } from "./file-write.js";
import { writeJsonAtomic } from "./json-store.js";

export function createHistoryStore({ filePath, limit = 500, onWrite = async () => {}, onAppend = async () => {}, onRecovery = console.warn, readFile = readFileWithRetry }) {
  let writes = Promise.resolve();
  const backupPath = `${filePath}.bak`;

  function parseHistory(text) {
    const value = JSON.parse(text);
    if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
      throw new SyntaxError("Invalid history document");
    }
    return value;
  }

  async function readSnapshot() {
    let text;
    try {
      text = await readFile(filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        let backup;
        try {
          backup = parseHistory(await readFile(backupPath, "utf8"));
        }
        catch (backupError) { if (backupError.code === "ENOENT") return []; throw unavailable(backupError); }
        await writeJsonAtomic(filePath, backup);
        onRecovery("Missing history restored from the last known-good backup.");
        return backup;
      }
      throw unavailable(error);
    }
    try { return parseHistory(text); }
    catch (error) {
      let backup;
      try { backup = parseHistory(await readFile(backupPath, "utf8")); }
      catch { throw unavailable(error); }
      const quarantinePath = `${filePath}.corrupt-${Date.now()}-${randomUUID()}`;
      await writeFileWithRetry(quarantinePath, text, "utf8");
      await writeJsonAtomic(filePath, backup);
      onRecovery("History recovered from the last known-good backup. The damaged document was preserved for recovery.");
      return backup;
    }
  }

  function enqueue(operation) {
    const next = writes.then(operation);
    writes = next.catch(() => {});
    return next;
  }

  async function mutate(update) {
    return enqueue(async () => {
      const previous = await readSnapshot();
      const next = await update(previous);
      if (next === previous) return previous;
      await writeJsonAtomic(backupPath, previous);
      await writeJsonAtomic(filePath, next);
      await onWrite(next);
      return next;
    });
  }

  return {
    read: () => enqueue(readSnapshot),
    append: (item, { deduplicate = false } = {}) => mutate(async (items) => {
      await onAppend(item, items);
      if (deduplicate && item.generationRunId && items.some((entry) => entry.generationRunId === item.generationRunId)) return items;
      return [item, ...items].slice(0, limit);
    }),
    remove: (id) => mutate((items) => {
      const next = items.filter((item) => item.id !== id);
      if (next.length === items.length) throw Object.assign(new Error("History item not found."), { statusCode: 404 });
      return next;
    })
  };
}

function unavailable(cause) {
  return Object.assign(new Error("History could not be read. Existing records have been preserved; retry or restore the history backup.", { cause }), {
    code: "HISTORY_UNAVAILABLE", statusCode: 503
  });
}
