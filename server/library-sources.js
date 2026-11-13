import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createCompactStyleFinderReader, openCompactStyleFinder } from "./stylefinder-compact.js";

const baseRoute = "/api/style-library/sources";
const sourceIdPattern = /^[a-f0-9]{32}$/;
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = (message, status = 503) => { throw Object.assign(new Error(message), { status }); };

function manifestUrl(location) {
  const url = new URL(location);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    fail("Enter an HTTP or HTTPS compact catalog URL without embedded credentials.", 400);
  }
  if (!url.pathname.toLowerCase().endsWith(".json")) url.pathname = `${url.pathname.replace(/\/$/, "")}/catalog.json`;
  return url;
}

async function download(url, maximum) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok || Number(response.headers.get("content-length")) > maximum) {
    await response.body?.cancel();
    throw new Error("Catalog file is unavailable or too large.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body || []) {
    size += chunk.length;
    if (size > maximum) throw new Error("Catalog file is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createLibrarySources() {
  const readers = new Map();

  function open(source, refresh = false) {
    const { id, name, location } = source;
    const key = JSON.stringify([name, location]);
    let reader = readers.get(id);
    if (reader?.key !== key) {
      const options = {
        shared: true,
        imageEndpoint: `${baseRoute}/${id}/image`,
        source: { name, lookId: originalId => `custom-${id}-${hash(originalId).slice(0,32)}` }
      };
      if (path.isAbsolute(location)) {
        const local = createCompactStyleFinderReader(options);
        const directory = path.basename(location).toLowerCase() === "catalog.json" ? path.dirname(location) : location;
        reader = { key, read: () => local(directory) };
      } else {
        const url = manifestUrl(location);
        const readBlob = async blob => {
          const bytes = await download(new URL(`images/${blob.slice(0,2)}/${blob}`, url), 32 * 1024 * 1024);
          if (hash(bytes) !== blob.split(".")[0]) throw new Error("Catalog image failed verification.");
          return bytes;
        };
        let pending, cached, expires = 0;
        reader = { key, read(force) {
          if (!force && Date.now() < expires) return cached;
          pending ??= download(url, 64 * 1024 * 1024).then(bytes => {
            cached = openCompactStyleFinder(null, JSON.parse(bytes.toString("utf8")), { ...options, readBlob });
            expires = Date.now() + 60000;
            return cached;
          }).finally(() => { pending = null; });
          return pending;
        } };
      }
      readers.set(id, reader);
    }
    return reader.read(refresh);
  }

  async function configure(input, previous) {
    if (!Array.isArray(input)) fail("Enter a list of library sources.", 400);
    const before = new Map(previous.map(source => [source.id, source]));
    const sources = [], ids = new Set();
    for (const entry of input) {
      const name = typeof entry?.name === "string" ? entry.name.trim() : "";
      const location = typeof entry?.location === "string" ? entry.location.trim() : "";
      const id = entry?.id ? String(entry.id).replaceAll("-", "") : randomUUID().replaceAll("-", "");
      if (!sourceIdPattern.test(id) || ids.has(id)) fail("Each library source needs a unique ID.", 400);
      if (!name || name.length > 80 || !location || location.length > 4096 || /[\0\r\n]/.test(location)) {
        fail("Enter a name and a valid path or URL for every library source.", 400);
      }
      const source = { id, name, location };
      if (location !== before.get(id)?.location) {
        try { await open(source, true); }
        catch { readers.delete(id); fail(`Could not open ${name}. Choose a compact catalog folder or a URL serving a valid catalog.json.`); }
      }
      ids.add(id);
      sources.push(source);
    }
    return sources;
  }

  function prune(sources) {
    const ids = new Set(sources.map(source => source.id));
    for (const id of readers.keys()) if (!ids.has(id)) readers.delete(id);
  }

  return { configure, open, prune };
}

export function registerLibrarySourceRoutes(app, readSource) {
  const route = action => async (req, res) => {
    try {
      const catalog = await readSource(req.params.source, req.query.refresh === "1");
      await action(catalog, req, res);
    } catch (error) {
      res.status(error.status || 503).json({ error: error.status ? error.message : "Could not read this library source. Check its path or URL, then refresh." });
    }
  };
  app.get(`${baseRoute}/:source`, route((catalog, req, res) => res.json(catalog.search(req.query))));
  app.get(`${baseRoute}/:source/looks/:id`, route((catalog, req, res) => res.json(catalog.detail(req.params.id))));
  app.get(`${baseRoute}/:source/image`, route(async (catalog, req, res) => {
    const { filename, buffer, mimeType } = await catalog.asset(req.query.file, req.query.v);
    res.set({ "Content-Type": mimeType, "Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff" });
    if (filename) res.sendFile(filename);
    else res.send(buffer);
  }));
}
