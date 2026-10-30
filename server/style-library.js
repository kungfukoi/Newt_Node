import path from "node:path";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { normalizeLibraryStyle } from "../src/styleLibrary.js";

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function createStyleLibraryStore({ directory }) {
  const target = path.join(directory, "style-library.json");
  let queue = Promise.resolve();
  async function read() {
    try { return JSON.parse(await readFile(target, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return { version: 1, revision: 0, collections: [] }; throw error; }
  }
  function save(body) {
    const pending = queue.then(async () => {
      const previous = await read();
      if (body?.revision !== previous.revision) fail("Library changed in another window. Reload the library before saving again.", 409);
      if (!Array.isArray(body.collections) || body.collections.length > 100) fail("Use at most 100 collections.");
      if (JSON.stringify(body).length > 4 * 1024 * 1024) fail("This library is too large.");
      const ids = new Set();
      const collections = body.collections.map(collection => {
        if (!/^[a-z0-9-]{1,80}$/i.test(collection?.id || "") || ids.has(collection.id)) fail("Invalid collection identity.");
        ids.add(collection.id);
        if (typeof collection.name !== "string" || !collection.name.trim() || collection.name.length > 120) fail("Name each collection using 1–120 characters.");
        if (!Array.isArray(collection.styles) || collection.styles.length > 500) fail("Use at most 500 styles per collection.");
        const styleIds = new Set();
        const styles = collection.styles.map(source => {
          const style = normalizeLibraryStyle(source);
          if (!/^[a-z0-9-]{1,80}$/i.test(style.id) || styleIds.has(style.id) || !style.name) fail("Name each style and give it a unique identity.");
          if (style.examples.length !== (source.examples || []).length) fail("Examples must be managed local image assets (up to eight per style).");
          styleIds.add(style.id); return style;
        });
        return { id: collection.id, name: collection.name.trim(), styles };
      });
      const result = { version: 1, revision: previous.revision + 1, collections };
      await mkdir(directory, { recursive: true });
      await writeFile(`${target}.tmp`, JSON.stringify(result), { mode: 0o600 });
      await rename(`${target}.tmp`, target);
      return result;
    });
    queue = pending.catch(() => {}); return pending;
  }
  return { read, save };
}
export function registerStyleLibraryRoutes(app, options) {
  const store = createStyleLibraryStore(options);
  app.get("/api/style-library", async (_req, res) => { try { res.json(await store.read()); } catch { res.status(500).json({ error: "Could not read the style library." }); } });
  app.put("/api/style-library", async (req, res) => { try { res.json(await store.save(req.body)); } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : "Could not save the style library." }); } });
}
