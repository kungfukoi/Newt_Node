import path from "node:path";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { readFileWithRetry } from "./file-write.js";
import { writeJsonAtomic } from "./json-store.js";
import { buildProjectOutputItems } from "../src/projectOutputs.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const keyFor = (project = {}) => String(project.id || (project.name && !["Untitled", "Untitled node project", "Node workspace"].includes(project.name) ? `name:${project.name}` : ""));
const order = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || a.id.localeCompare(b.id);

export function projectOutputRecord(item) {
  const project = { id: String(item.project?.id || ""), name: String(item.project?.name || "") };
  const items = buildProjectOutputItems({ history: [item], projectId: project.id, projectName: project.name });
  const id = String(item.generationRunId || item.id || hash(JSON.stringify(items)));
  return { id, project, items };
}

// Immutable generation records are independent of the bounded recent-history cache.
export function createProjectOutputStore({ directory }) {
  const projects = new Map();
  let queue = Promise.resolve();
  let bootstrapped = false;
  const enqueue = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  async function load(key) {
    if (projects.has(key)) return projects.get(key);
    const folder = path.join(directory, hash(key));
    let files;
    try { files = await readdir(folder); }
    catch (error) { if (error.code !== "ENOENT") throw error; files = []; }
    const records = new Map();
    for (const file of files.filter((name) => /^[a-f0-9]{64}\.json$/.test(name))) {
      const record = JSON.parse(await readFileWithRetry(path.join(folder, file), "utf8"));
      if (!record.id || !Array.isArray(record.items)) throw new Error("Project output catalog needs recovery; existing records were preserved.");
      records.set(record.id, record);
    }
    projects.set(key, records);
    return records;
  }
  async function add(item, { onlyMissing = false } = {}) {
    const record = projectOutputRecord(item);
    const { project, items, id } = record;
    const key = keyFor(project);
    if (!key) return;
    if (!items.length) return;
    const records = await load(key);
    // Recent history may still contain pre-relocation URLs. Never undo the
    // catalog's authoritative package remapping when bootstrapping after restart.
    if (onlyMissing && records.has(id)) return;
    if (JSON.stringify(records.get(id)) === JSON.stringify(record)) return;
    const folder = path.join(directory, hash(key));
    await writeJsonAtomic(path.join(folder, `${hash(id)}.json`), record);
    records.set(id, record);
  }
  async function bootstrap(history) {
    if (bootstrapped) return;
    for (const item of history) await add(item, { onlyMissing: true });
    bootstrapped = true;
  }
  async function withBootstrap(history, operation) {
    // Resolve the recent-history seed before taking the catalog queue: appends
    // already hold the history queue and must never wait on an inverse lock.
    const seed = bootstrapped ? [] : typeof history === "function" ? await history() : history;
    return enqueue(async () => { await bootstrap(seed); return operation(); });
  }
  return {
    all: (projectId, history = []) => withBootstrap(history, async () => {
      const records = await load(keyFor({ id: projectId }));
      return [...new Map([...records.values()].flatMap((record) => record.items).map((item) => [item.url, item])).values()].sort(order);
    }),
    ingest: (project, items = []) => enqueue(async () => {
      for (const item of items) await add({
        id: `catalog:${hash(String(item.url))}`, project, createdAt: item.createdAt, mediaType: item.type,
        localImages: item.type === "image" ? [item.url] : [],
        localVideos: item.type === "video" ? [item.url] : [],
        localAudios: item.type === "audio" ? [item.url] : [],
        localModels: item.type === "model3d" ? [item.url] : [],
        localThumbnail: item.thumbnailUrl, outputLabels: [item.label], outputFileNames: [item.fileName]
      });
    }),
    remap: (projectId, urlMap) => enqueue(async () => {
      const key = keyFor({ id: projectId });
      const records = await load(key);
      for (const [id, record] of records) {
        const items = record.items.map((item) => ({ ...item, url: urlMap.get(item.url) ?? item.url, thumbnailUrl: urlMap.get(item.thumbnailUrl) ?? item.thumbnailUrl }));
        if (JSON.stringify(items) === JSON.stringify(record.items)) continue;
        const next = { ...record, items: items.filter((item) => item.url) };
        await writeJsonAtomic(path.join(directory, hash(key), `${hash(id)}.json`), next);
        records.set(id, next);
      }
    }),
    append: (item, history = []) => enqueue(async () => { await bootstrap(history); await add(item); }),
    list: ({ projectId = "", projectName = "", cursor = "", limit = 100 } = {}, history = []) => withBootstrap(history, async () => {
      const key = keyFor({ id: projectId, name: projectName });
      if (!key) return { items: [], nextCursor: "", total: 0 };
      const records = await load(key);
      const unique = new Map();
      for (const record of records.values()) for (const item of record.items) unique.set(item.url, item);
      const items = [...unique.values()].sort(order);
      let after;
      try { after = cursor ? JSON.parse(Buffer.from(cursor, "base64url").toString()) : null; }
      catch { throw Object.assign(new Error("Invalid project output cursor."), { statusCode: 400 }); }
      if (after && (after.key !== key || typeof after.id !== "string" || typeof after.createdAt !== "string")) {
        throw Object.assign(new Error("Invalid project output cursor."), { statusCode: 400 });
      }
      const remaining = after ? items.filter((item) => order(item, after) > 0) : items;
      const page = remaining.slice(0, Math.min(200, Math.max(1, Number(limit) || 100)));
      const last = page.at(-1);
      return { items: page, total: items.length, nextCursor: remaining.length > page.length ? Buffer.from(JSON.stringify({ key, id: last.id, createdAt: last.createdAt })).toString("base64url") : "" };
    })
  };
}
