import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { indexFilmStills } from "../scripts/indexFilmStills.mjs";
import { createCompactStyleFinderReader } from "../server/stylefinder-compact.js";
import { normalizeLibraryStyle } from "../src/styleLibrary.js";

const swatches = Array.from({ length: 13 }, (_, i) => [20 + i * 15, 190 - i * 10, 40 + i * 12]);
export async function filmSheet({ palette = true, textured = false } = {}) {
  const w = 1000, h = 1000, pixels = Buffer.alloc(w * h * 3, 255);
  const paint = (x, y, color) => { const at = (y * w + x) * 3; pixels[at] = color[0]; pixels[at + 1] = color[1]; pixels[at + 2] = color[2]; };
  for (let y = 8; y < (palette ? 558 : 992); y++) for (let x = 8; x < 992; x++) paint(x, y, swatches[Math.min(12, Math.floor(x / 77))]);
  if (palette) for (let i = 0; i < 13; i++) for (let y = 568; y < 992; y++) for (let x = 8 + i * 76; x < 80 + i * 76; x++) paint(x, y, textured && y < 750 ? [20, 30, 40] : swatches[i]);
  return sharp(pixels, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

test("Film Stills indexing crops palette sheets, keeps legacy assets and searches original filenames", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "newt-film-parser-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "FilmColorStills");
  await mkdir(source);
  const sheet = await filmSheet();
  const filename = path.join(source, "UnderTheSkin 2.png");
  await writeFile(filename, sheet);
  await writeFile(path.join(source, "Plain.png"), await filmSheet({ palette: false }));
  await writeFile(path.join(source, "Textured.png"), await filmSheet({ textured: true }));
  const legacyKey = "img/original.png", legacyBlob = "0".repeat(64) + ".png";
  await writeFile(path.join(root, "catalog.json"), JSON.stringify({
    version: 1, styles: [{ id: "legacy", name: "Legacy", category: "Film Stills", tags: [], examples: [] }],
    details: {}, categories: ["Film Stills"], assets: { [legacyKey]: legacyBlob },
  }));

  assert.deepEqual(await indexFilmStills(root), { looks: 1, skipped: 2 });
  assert.deepEqual(await readFile(filename), sheet);
  const manifest = JSON.parse(await readFile(path.join(root, "catalog.json"), "utf8"));
  assert.equal(manifest.assets[legacyKey], legacyBlob);
  const catalog = await createCompactStyleFinderReader({ shared: true })(root);
  const [look] = catalog.search({ q: "UnderTheSkin 2" }).styles;
  assert.match(look.name, /^Under The Skin - /);
  assert.equal(look.colours.length, 10);
  const [example] = look.examples;
  assert.deepEqual(look.colours.map(color => color.hex), example.filmStillPalette.colors);
  const saved = normalizeLibraryStyle({ ...look, examples: [{ ...example, localUrl: "/uploads/still.png" }] });
  assert.deepEqual(saved.examples[0].filmStillPalette, example.filmStillPalette);
  const supplied = swatches.map(rgb => "#" + Buffer.from(rgb).toString("hex").toUpperCase());
  assert.ok(example.filmStillPalette.colors.every(color => supplied.includes(color)));
  const params = new URL(example.url, "http://localhost").searchParams;
  const image = await catalog.asset(params.get("file"), params.get("v"));
  const { width, height } = await sharp(image.filename).metadata();
  assert.deepEqual({ width, height }, { width: 980, height: 546 });
  assert.deepEqual(await indexFilmStills(root), { looks: 1, skipped: 2 });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "catalog.json"), "utf8")), manifest);
});
