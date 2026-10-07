import sharp from "sharp";
import { validateBoxObject } from "../src/imageEditBoxModels.js";

export async function objectPixels(mask, width, height) {
  mask = validateBoxObject(mask);
  const pixels = Buffer.alloc(mask.width * mask.height);
  for (let i = 0; i < mask.runs.length; i += 2) pixels.fill(255, mask.runs[i], mask.runs[i] + mask.runs[i + 1]);
  return sharp(pixels, { raw: { width: mask.width, height: mask.height, channels: 1 } })
    .resize(width, height, { fit: "fill", kernel: "nearest" }).greyscale().raw().toBuffer();
}

// Follow the subject silhouette, expanding into its surroundings with a broad
// feather. Work at bounded resolution; preserve the exact full-resolution core
// so the final composite cannot restore pieces of a removed/moved subject.
export async function contextMask(core, width, height, rect, padding = .35) {
  const scale = Math.min(1, 1024 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const margin = Math.min(rect.w * width, rect.h * height) * padding;
  const feather = Math.max(3, Math.min(width, height) * .015, margin * .35);
  const small = await sharp(core, { raw: { width, height, channels: 1 } }).resize(w, h, { fit: "fill" }).greyscale().raw().toBuffer();
  const expanded = await sharp(small, { raw: { width: w, height: h, channels: 1 } })
    .blur(Math.max(.3, margin * scale / 3)).threshold(1).greyscale().raw().toBuffer();
  const alpha = await sharp(expanded, { raw: { width: w, height: h, channels: 1 } })
    .blur(Math.max(.3, feather * scale)).resize(width, height, { fit: "fill" }).greyscale().raw().toBuffer();
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let p = 0; p < core.length; p++) rgba[p * 4 + 3] = Math.max(core[p], alpha[p]);
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
