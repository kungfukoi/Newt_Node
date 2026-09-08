import { randomUUID } from "node:crypto";
import { mkdir, readdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { readJsonFile, writeJsonAtomic } from "./json-store.js";
import { buildNewtPresetGraph } from "../src/newtPresets.js";

export class NewtPresetStore {
  constructor({ directory, assetsDirectory, assetsUrl, resolveAsset, collectAssetUrls, rewriteAssetUrls }) {
    Object.assign(this, { directory, assetsDirectory, assetsUrl, resolveAsset, collectAssetUrls, rewriteAssetUrls });
    this.queue = Promise.resolve();
  }

  file(id) {
    if (!/^[a-f0-9-]{36}$/.test(String(id))) throw new Error("Invalid Newt Preset ID.");
    return path.join(this.directory, `${id}.json`);
  }

  async list() {
    await mkdir(this.directory, { recursive: true });
    const items = [];
    for (const file of await readdir(this.directory)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
      const preset = await readJsonFile(path.join(this.directory, file), null);
      if (`${preset?.id}.json` !== file || !preset.graph?.nodes?.length) continue;
      items.push({
        id: preset.id,
        name: preset.name,
        createdAt: preset.createdAt,
        nodeCount: preset.graph.nodes.length,
        slots: preset.graph.slots || []
      });
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(id) {
    const preset = await readJsonFile(this.file(id), null);
    if (!preset) throw new Error("This Newt Preset is no longer available.");
    return preset;
  }

  save(value) {
    const operation = this.queue.catch(() => {}).then(() => this.write(value));
    this.queue = operation;
    return operation;
  }

  async write({ name, graph }) {
    const label = String(name || "").trim();
    if (!label || label.length > 80) throw new Error("Name the preset using 1 to 80 characters.");
    if (JSON.stringify(graph || {}).length > 5_000_000) throw new Error("This selection is too large for a Newt Preset.");
    const clean = buildNewtPresetGraph(graph);
    if ((await this.list()).some((preset) => preset.name.toLowerCase() === label.toLowerCase())) {
      throw new Error("A Newt Preset with this name already exists. Choose another name.");
    }
    const id = randomUUID();
    const folder = path.join(this.assetsDirectory, id);
    const urls = new Map();
    try {
      for (const url of this.collectAssetUrls(clean)) {
        const source = await this.resolveAsset(url);
        const file = `${urls.size}-${path.basename(source.filePath)}`;
        await mkdir(folder, { recursive: true });
        await copyFile(source.filePath, path.join(folder, file));
        urls.set(url, `${this.assetsUrl}/${id}/${encodeURIComponent(file)}`);
      }
      const preset = {
        id,
        name: label,
        version: 2,
        createdAt: new Date().toISOString(),
        graph: this.rewriteAssetUrls(clean, urls)
      };
      await writeJsonAtomic(this.file(id), preset);
      return preset;
    } catch (error) {
      await rm(folder, { recursive: true, force: true }).catch(() => {});
      throw new Error(`Preset was not saved. ${error.message}`);
    }
  }

  async remove(id) {
    await rm(this.file(id), { force: true });
    // Existing workflows may still reference the copied media.
    return { ok: true };
  }
}
