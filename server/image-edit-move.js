import sharp from "sharp";
import { contextMask } from "./image-edit-context.js";
import { boxNeedsCutout, validateBoxObject } from "../src/imageEditBoxModels.js";

export async function prepareMoveCutouts({ original, boxes, model, objects = {}, width, height }) {
  const moves = boxes.filter(box => boxNeedsCutout(box, model) || (box.mode === "move" && objects[box.id]));
  if (!moves.length) return { base: original, ids: [], editMask: null, protectedMask: null };
  const pixels = width * height;
  const source = await sharp(original).ensureAlpha().raw().toBuffer(), result = Buffer.from(source);
  const prepared = [], layers = [];
  for (const box of moves) {
    if (!objects[box.id]) throw new Error(`Select the object for Move box "${box.label}" before generating.`);
    const mask = validateBoxObject(objects[box.id]), bitmap = Buffer.alloc(mask.width * mask.height);
    let minX = mask.width, minY = mask.height, maxX = 0, maxY = 0;
    for (let i = 0; i < mask.runs.length; i += 2) {
      const start = mask.runs[i], end = start + mask.runs[i + 1]; bitmap.fill(255, start, end);
      for (let p = start; p < end;) {
        const x = p % mask.width, y = Math.floor(p / mask.width), length = Math.min(end - p, mask.width - x);
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + length); maxY = Math.max(maxY, y + 1); p += length;
      }
    }
    const bounds = { left: Math.floor(minX * width / mask.width), right: Math.ceil(maxX * width / mask.width), top: Math.floor(minY * height / mask.height), bottom: Math.ceil(maxY * height / mask.height) };
    const selected = (x, y) => x >= 0 && x < width && y >= 0 && y < height && bitmap[Math.floor(y * mask.height / height) * mask.width + Math.floor(x * mask.width / width)];
    const sourceCore = Buffer.alloc(pixels);
    let area = 0;
    for (let y = bounds.top; y < bounds.bottom; y++) for (let x = bounds.left; x < bounds.right; x++) if (selected(x, y)) {
      const p = y * width + x; if (!source[p * 4 + 3]) continue;
      sourceCore[p] = 255; area++;
    }
    if (!area) throw new Error(`The selection for "${box.label}" is empty inside its source box. Select it again.`);
    // Clear a one-pixel safety edge as well as the exact cutout. Coarse masks
    // otherwise leave antialiased subject fragments for the model to regrow.
    // Only erasure expands: destination identity pixels still use the exact mask.
    const removalCore = await sharp(sourceCore, { raw: { width, height, channels: 1 } })
      .convolve({ width: 3, height: 3, kernel: Array(9).fill(1), scale: 1 }).threshold(1).greyscale().raw().toBuffer();
    for (let p = 0; p < pixels; p++) if (removalCore[p] && source[p * 4 + 3]) result.set([128, 128, 128, 255], p * 4);
    layers.push({ input: await contextMask(removalCore, width, height, box.source, box.contextPadding) });
    prepared.push({ box, selected, bounds });
  }
  // Sample every cutout from the clean original, then paste in box order. Removing
  // all sources first keeps overlapping moves from erasing a previously pasted object.
  for (const { box, selected, bounds } of prepared) {
    const angle = box.target.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const corners = [[bounds.left, bounds.top], [bounds.right, bounds.top], [bounds.right, bounds.bottom], [bounds.left, bounds.bottom]].map(([x, y]) => {
      const dx = (x - box.source.x * width) * box.target.w / box.source.w, dy = (y - box.source.y * height) * box.target.h / box.source.h;
      return { x: box.target.x * width + dx * c - dy * s, y: box.target.y * height + dx * s + dy * c };
    });
    const left = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x)))), right = Math.min(width, Math.ceil(Math.max(...corners.map(p => p.x))));
    const top = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y)))), bottom = Math.min(height, Math.ceil(Math.max(...corners.map(p => p.y))));
    const destinationCore = Buffer.alloc(pixels);
    let visible = 0;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const dx = x + .5 - box.target.x * width, dy = y + .5 - box.target.y * height;
      const sx = Math.floor(box.source.x * width + (dx * c + dy * s) * box.source.w / box.target.w);
      const sy = Math.floor(box.source.y * height + (-dx * s + dy * c) * box.source.h / box.target.h);
      if (!selected(sx, sy)) continue;
      const p = y * width + x, q = (sy * width + sx) * 4, alpha = source[q + 3] / 255;
      if (!alpha) continue;
      for (let channel = 0; channel < 3; channel++) result[p * 4 + channel] = Math.round(source[q + channel] * alpha + result[p * 4 + channel] * (1 - alpha));
      result[p * 4 + 3] = Math.round((alpha + result[p * 4 + 3] / 255 * (1 - alpha)) * 255);
      destinationCore[p] = 255; visible++;
    }
    if (!visible) throw new Error(`The destination of "${box.label}" is outside the image. Move it inside the canvas.`);
    layers.push({ input: await contextMask(destinationCore, width, height, box.target, box.contextPadding) });
  }
  const editMask = await sharp({ create: { width, height, channels: 4, background: "#00000000" } }).composite(layers).png().toBuffer();
  // Protected Keep regions must be restored in the staged baseline as well as
  // excluded from the generation mask, including overlaps with pasted cutouts.
  for (const box of boxes.filter(box => box.mode === "keep")) {
    for (let y = Math.max(0, Math.floor((box.source.y - box.source.h / 2) * height)); y < Math.min(height, Math.ceil((box.source.y + box.source.h / 2) * height)); y++)
      for (let x = Math.max(0, Math.floor((box.source.x - box.source.w / 2) * width)); x < Math.min(width, Math.ceil((box.source.x + box.source.w / 2) * width)); x++) source.copy(result, (y * width + x) * 4, (y * width + x) * 4, (y * width + x) * 4 + 4);
  }
  const png = buffer => sharp(buffer, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { base: await png(result), ids: moves.map(box => box.id), editMask, protectedMask: null };
}
