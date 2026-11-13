import path from "node:path";
import { createHash } from "node:crypto";
import { lstatSync } from "node:fs";
import { link, mkdir, mkdtemp, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { createStyleFinderCatalog, styleFinderRasterFormat } from "../server/stylefinder-catalog.js";
import { compactStyleFinderBlob, curatedStyleFinderPath, openCompactStyleFinder } from "../server/stylefinder-compact.js";
import { readStyleFinderOverrides } from "../server/stylefinder-overrides.js";

export async function packStyleFinder(checkout, output, { expectedCount, previousFolder, refresh = false, progress = () => {} } = {}) {
  const dataDirectory = path.join(checkout, "server", "data");
  const index = JSON.parse(await readFile(path.join(dataDirectory, "stylefinder-audition.json"), "utf8"));
  const { sourceDirectory, snapshot } = index;
  if (index.version !== 1 || !path.isAbsolute(sourceDirectory) || !snapshot?.ready || !Array.isArray(snapshot.styles)) {
    throw Error("Invalid catalog mirror index");
  }
  const mirror = await realpath(sourceDirectory);
  const parent = await realpath(path.dirname(output));
  output = path.join(parent, path.basename(output));
  const relative = path.relative(mirror, output);
  if (!relative || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) {
    throw Error("Choose an output folder outside the original mirror");
  }
  if (lstatSync(output, { throwIfNoEntry: false })) throw Error("The destination already exists");
  let previous;
  if (previousFolder) {
    previousFolder = await realpath(previousFolder);
    previous = JSON.parse(await readFile(path.join(previousFolder, "catalog.json"), "utf8"));
    openCompactStyleFinder(previousFolder, previous);
  }
  const { styles: overrides } = await readStyleFinderOverrides(dataDirectory);
  const catalog = createStyleFinderCatalog({
    root: mirror, cacheMs: Infinity, initialSnapshot: refresh ? undefined : snapshot,
    imageEndpoint: "/api/style-library/stylefinder-image", overrides,
  });
  if (refresh) progress("Scanning the updated catalog mirror");
  const first = await catalog.search({ limit: 96 });
  if (!first.ready || !first.total) throw Error("The catalog mirror contains no indexed looks");
  if (expectedCount !== undefined && first.total !== expectedCount) {
    throw Error(`Expected ${expectedCount} styles, found ${first.total}`);
  }
  const manifest = { version: 1, categories: first.categories, styles: [], details: {}, assets: {} };
  const imageKeys = new Set();
  function collectImages(style) {
    for (const image of style.examples) {
      if (image.localUrl && curatedStyleFinderPath.test(image.localUrl)) {
        imageKeys.add(image.localUrl);
      } else if (image.url?.startsWith("/api/style-library/stylefinder-image?file=")) {
        imageKeys.add(new URL(image.url, "http://localhost").searchParams.get("file"));
      } else {
        throw Error(`Invalid image reference for ${style.id}`);
      }
    }
  }
  for (let offset = 0; offset < first.total; offset += first.limit) {
    const page = offset ? await catalog.search({ offset, limit: first.limit }) : first;
    const details = await Promise.all(page.styles.map(style => catalog.detail(style.id, { includeRelated: false })));
    for (const [index, listed] of page.styles.entries()) {
      const detail = details[index].style;
      manifest.styles.push(listed);
      collectImages(listed);
      if (!isDeepStrictEqual(detail, listed)) {
        manifest.details[listed.id] = detail;
        collectImages(detail);
      }
    }
    if (!offset || offset % (first.limit * 10) === 0) progress(`Resolved list and detail for ${manifest.styles.length}/${first.total} styles`);
  }
  if (manifest.styles.length !== first.total) throw Error("Incomplete catalog export");
  const nextIds = new Set(manifest.styles.map(style => style.id));
  const previousStyles = new Map((previous?.styles || []).map(style => [style.id, style]));
  const missing = [...previousStyles.keys()].filter(id => !nextIds.has(id));
  if (missing.length) {
    throw Error(`The refreshed mirror is missing ${missing.length} existing styles. First missing IDs: ${missing.slice(0, 8).join(", ")}`);
  }
  const previousBlobs = new Set(Object.values(previous?.assets || {}));

  const staged = await mkdtemp(path.join(parent, `.${path.basename(output)}-building-`));
  const assets = [...imageKeys];
  const writes = new Map();
  const buckets = new Map();
  const uploads = Object.keys(overrides).length ? await realpath(path.join(checkout, "uploads", "stylefinder-overrides")) : null;
  let imageBytes = 0;
  let reusedImageFiles = 0;
  async function writeBlob(target, blob, bytes) {
    if (previousBlobs.has(blob)) {
      const existing = compactStyleFinderBlob(previousFolder, blob);
      try {
        // A stale or edited previous package must never substitute for the resolved source bytes.
        if (await realpath(existing) === existing && bytes.equals(await readFile(existing))) {
          await link(existing, target);
          reusedImageFiles++;
          return;
        }
      } catch { /* Across filesystems or with a missing blob, write the source bytes. */ }
    }
    await writeFile(target, bytes, { flag: "wx" });
  }
  for (let start = 0; start < assets.length; start += 64) {
    const batch = assets.slice(start, start + 64);
    const blobs = await Promise.all(batch.map(async key => {
      let filename;
      if (curatedStyleFinderPath.test(key)) {
        filename = await realpath(path.join(checkout, key.slice(1)));
        const relative = path.relative(uploads, filename);
        if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
          throw Error(`Curated image escaped its managed directory: ${key}`);
        }
      } else {
        ({ filename } = await catalog.asset(key));
      }
      const bytes = await readFile(filename);
      const format = styleFinderRasterFormat(bytes);
      if (!format) throw Error(`Invalid raster image: ${key}`);
      const hash = createHash("sha256").update(bytes).digest("hex");
      const blob = hash + format.extension;
      if (!writes.has(blob)) {
        const target = compactStyleFinderBlob(staged, blob);
        const bucket = path.dirname(target);
        if (!buckets.has(bucket)) buckets.set(bucket, mkdir(bucket, { recursive: true }));
        writes.set(blob, buckets.get(bucket).then(() => writeBlob(target, blob, bytes)));
        imageBytes += bytes.length;
      }
      await writes.get(blob);
      return blob;
    }));
    batch.forEach((key, index) => { manifest.assets[key] = blobs[index]; });
    if (start % 4096 === 0) progress(`Packed ${start + batch.length}/${assets.length} image paths`);
  }
  openCompactStyleFinder(staged, manifest);
  const json = JSON.stringify(manifest);
  await writeFile(path.join(staged, "catalog.json"), json, { flag: "wx" });
  await rename(staged, output);
  // Earlier packages stored the mirror page URL alongside its stable style ID.
  const withoutSourceUrl = ({ sourceUrl, ...style }) => style;
  const updatedStyles = manifest.styles.filter(style => {
    const old = previousStyles.get(style.id);
    if (!old) return false;
    const detail = Object.hasOwn(manifest.details, style.id) ? manifest.details[style.id] : style;
    const oldDetail = Object.hasOwn(previous.details, style.id) ? previous.details[style.id] : old;
    return !isDeepStrictEqual(style, withoutSourceUrl(old)) || !isDeepStrictEqual(detail, withoutSourceUrl(oldDetail)) ||
      [...style.examples, ...detail.examples].some(image => {
        const key = image.localUrl || new URL(image.url, "http://localhost").searchParams.get("file");
        return manifest.assets[key] !== previous.assets[key];
      });
  }).length;
  return {
    output, styles: manifest.styles.length, curated: manifest.styles.filter(style => style.sourceProvider === "Newt").length,
    distinctDetails: Object.keys(manifest.details).length, imagePaths: assets.length, imageFiles: writes.size,
    imageBytes, indexBytes: Buffer.byteLength(json), addedStyles: nextIds.size - previousStyles.size, updatedStyles, reusedImageFiles,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { positionals, values } = parseArgs({
    allowPositionals: true, options: { refresh: { type: "boolean" }, reuse: { type: "string" } },
  });
  const [checkout, destination, count] = positionals;
  if (!checkout || !destination || positionals.length > 3 || (count && !/^[1-9]\d*$/.test(count))) {
    throw Error("Usage: node scripts/packStyleFinder.mjs <source checkout> <new catalog folder> [expected style count] [--refresh] [--reuse <current compact folder>]");
  }
  const result = await packStyleFinder(path.resolve(checkout), path.resolve(destination), {
    expectedCount: count ? Number(count) : undefined,
    previousFolder: values.reuse, refresh: values.refresh,
    progress: message => console.error(message),
  });
  console.log(JSON.stringify(result));
}
