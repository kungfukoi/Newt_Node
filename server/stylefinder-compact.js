import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import { selectStyleFinderPage } from "./stylefinder-catalog.js";

export const compactStyleFinderSetting = "stylefinder-compact-source.json";
export const curatedStyleFinderPath = /^\/uploads\/stylefinder-overrides\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.(?:jpe?g|png|webp)$/i;
const mirrorImagePath = /^img\/.+\.(?:jpe?g|png|webp|html)$/i;
const mimeTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const fail = (message, status = 503) => { throw Object.assign(new Error(message), { status }); };

export function compactStyleFinderBlob(directory, blob) {
  return path.join(directory, "images", blob.slice(0, 2), blob);
}

export function openCompactStyleFinder(directory, manifest) {
  const { version, styles, details, categories, assets } = manifest;
  if (version !== 1 || !Array.isArray(styles) || !styles.length || styles.length > 50000 ||
      !Array.isArray(categories) || !categories.every(value => typeof value === "string") ||
      !details || !assets || Array.isArray(details) || Array.isArray(assets)) throw Error("Invalid compact catalog");
  const byId = new Map(styles.map(style => [style.id, style]));
  if (byId.size !== styles.length) throw Error("Duplicate compact look ID");
  for (const [id, style] of Object.entries(details)) {
    if (!byId.has(id) || style.id !== id) throw Error("Invalid compact look detail");
  }
  for (const style of [...styles, ...Object.values(details)]) {
    if (!/^[a-z0-9-]{1,100}$/.test(style.id) || typeof style.name !== "string" ||
        !Array.isArray(style.tags) || !Array.isArray(style.examples)) throw Error("Invalid compact look");
  }
  for (const [key, blob] of Object.entries(assets)) {
    if ((!mirrorImagePath.test(key) && !curatedStyleFinderPath.test(key)) ||
        key.includes("..") || /[\\:\x00]/.test(key) ||
        !/^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(blob)) throw Error("Invalid compact image entry");
  }

  async function findAsset(key) {
    if (!Object.hasOwn(assets, key)) return null;
    const blob = assets[key];
    const filename = await realpath(compactStyleFinderBlob(directory, blob));
    const relative = path.relative(directory, filename);
    if (relative !== path.join("images", blob.slice(0, 2), blob) || !(await stat(filename)).isFile()) {
      fail("Invalid compact StyleFinder image.", 404);
    }
    return { filename, mimeType: mimeTypes[path.extname(blob).slice(1)] };
  }

  return {
    search(query) {
      return { ...selectStyleFinderPage(styles, query), ready: true, populating: false, categories };
    },
    detail(id) {
      const style = Object.hasOwn(details, id) ? details[id] : byId.get(id);
      if (!style) fail("This style is not in the local catalog.", 404);
      return { style };
    },
    async asset(file) {
      if (typeof file !== "string" || !mirrorImagePath.test(file) || file.includes("..") || /[\\:\x00]/.test(file)) {
        fail("Invalid catalog image.", 400);
      }
      return await findAsset(file) || fail("This image is not in the compact catalog.", 404);
    },
    curatedAsset: findAsset,
  };
}

export function createCompactStyleFinderSource(dataDirectory) {
  let cached;
  return async function readCompact() {
    let settings;
    try {
      settings = await readFile(path.join(dataDirectory, compactStyleFinderSetting), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return null;
      fail("Could not read the compact StyleFinder folder setting.");
    }
    try {
      const { directory } = JSON.parse(settings);
      if (typeof directory !== "string" || !path.isAbsolute(directory)) throw Error("Invalid compact catalog path");
      const root = await realpath(directory);
      const filename = path.join(root, "catalog.json");
      const info = await stat(filename);
      if (!info.isFile() || info.size > 64 * 1024 * 1024) throw Error("Invalid compact catalog file");
      const key = JSON.stringify([root, info.mtimeMs, info.size]);
      if (cached?.key !== key) {
        cached = { key, catalog: readFile(filename, "utf8").then(value => openCompactStyleFinder(root, JSON.parse(value))) };
      }
      return await cached.catalog;
    } catch {
      fail("The compact StyleFinder catalog is unavailable. Check the folder in stylefinder-compact-source.json.");
    }
  };
}
