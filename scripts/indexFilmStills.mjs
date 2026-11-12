import path from "node:path";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { extractFilmStill } from "../server/film-still-parser.js";
import { filmStillDisplayName } from "../server/film-still-names.js";
import { writeJsonAtomic } from "../server/json-store.js";
import { compactStyleFinderBlob, openCompactStyleFinder } from "../server/stylefinder-compact.js";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const imageEndpoint = "/api/style-library/stylefinder-image";
const naturalOrder = new Intl.Collator("en", { numeric: true });

export async function indexFilmStills(directory) {
  const root = await realpath(directory);
  const nested = path.join(root, "FilmColorStills");
  const entries = await readdir(root, { withFileTypes: true });
  const source = entries.some(entry => entry.name === "FilmColorStills" && entry.isDirectory()) ? nested : root;
  const files = (source === root ? entries : await readdir(source, { withFileTypes: true }))
    .filter(entry => entry.isFile() && /\.(jpe?g|png|webp)$/i.test(entry.name))
    .sort((a, b) => naturalOrder.compare(a.name, b.name));
  if (files.length > 5000) throw Error("Film Stills supports up to 5,000 source images.");

  const manifestPath = path.join(root, "catalog.json");
  const previous = await readFile(manifestPath, "utf8").then(JSON.parse).catch(error => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (previous) {
    openCompactStyleFinder(root, previous);
    if (!previous.styles.every(style => style.category === "Film Stills")) {
      throw Error("Choose a dedicated Film Stills catalog folder.");
    }
  }
  const manifest = { version: 1, categories: ["Film Stills"], styles: [], details: {}, assets: { ...previous?.assets } };
  const ids = new Set();
  let skipped = 0;
  for (const file of files) {
    const filename = path.join(source, file.name);
    if (path.relative(filename, await realpath(filename)) !== "") throw Error(`Unexpected link: ${file.name}`);
    const extracted = (await stat(filename)).size <= 32 * 1024 * 1024
      ? await extractFilmStill(await readFile(filename)).catch(() => null) : null;
    if (!extracted) {
      skipped++;
      continue;
    }
    const id = hash(file.name.toLowerCase()).slice(0, 24);
    if (ids.has(id)) throw Error(`Duplicate Film Stills name: ${file.name}`);
    ids.add(id);
    const { bytes, palette, crop } = extracted;
    const digest = hash(bytes);
    const blob = `${digest}.png`;
    // Keep legacy asset keys intact for old catalog image URLs.
    const key = `img/${id}-still-${blob}`;
    const url = `${imageEndpoint}?file=${encodeURIComponent(key)}`;
    const target = compactStyleFinderBlob(root, blob);
    await mkdir(path.dirname(target), { recursive: true });
    if (path.relative(path.dirname(target), await realpath(path.dirname(target))) !== "") {
      throw Error("The catalog image bucket points outside its expected path.");
    }
    await writeFile(target, bytes, { flag: "wx" }).catch(error => {
      if (error.code !== "EEXIST") throw error;
    });
    if (path.relative(target, await realpath(target)) !== "" || hash(await readFile(target)) !== digest) {
      throw Error(`Invalid catalog blob: ${blob}`);
    }
    manifest.assets[key] = blob;
    const name = filmStillDisplayName(file.name, palette);
    manifest.styles.push({
      id, name, searchName: path.parse(file.name).name, category: "Film Stills", tags: ["Film Stills"],
      sourceProvider: "Film Stills", previewUrl: url,
      colours: palette.colors.map(hex => ({ hex, name: hex })),
      examples: [{ id: "example-0", url, fileName: `${path.parse(file.name).name}-still.png`, mimeType: "image/png",
        width: crop.width, height: crop.height, filmStillPalette: palette }],
    });
  }

  openCompactStyleFinder(root, manifest);
  await writeJsonAtomic(manifestPath, manifest, { mode: 0o644 });
  return { looks: manifest.styles.length, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw Error("Usage: node scripts/indexFilmStills.mjs <Film Stills folder>");
  console.log(await indexFilmStills(path.resolve(process.argv[2])));
}
