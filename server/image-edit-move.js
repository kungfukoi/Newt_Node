import sharp from "sharp";
import { boxCorners } from "../src/imageEditBoxes.js";
import { boxNeedsCutout, validateBoxObject } from "../src/imageEditBoxModels.js";

export async function prepareMoveCutouts({ original, boxes, model, objects = {}, width, height }) {
  const moves = boxes.filter(box => boxNeedsCutout(box, model) || (box.mode === "move" && objects[box.id]));
  if (!moves.length) return { base: original, ids: [], editMask: null, protectedMask: null };
  const pixels = width * height;
  const source = await sharp(original).ensureAlpha().raw().toBuffer(), result = Buffer.from(source);
  const vacated = Buffer.alloc(pixels), destination = Buffer.alloc(pixels);
  const prepared = moves.map(box => {
    if (!objects[box.id]) throw new Error(`Select the object for Move box "${box.label}" before generating.`);
    const mask = validateBoxObject(objects[box.id]), bitmap = Buffer.alloc(mask.width * mask.height);
    for (let i = 0; i < mask.runs.length; i += 2) bitmap.fill(255, mask.runs[i], mask.runs[i] + mask.runs[i + 1]);
    const bounds = { left: Math.max(0, Math.floor((box.source.x - box.source.w / 2) * width)), right: Math.min(width, Math.ceil((box.source.x + box.source.w / 2) * width)), top: Math.max(0, Math.floor((box.source.y - box.source.h / 2) * height)), bottom: Math.min(height, Math.ceil((box.source.y + box.source.h / 2) * height)) };
    const selected = (x, y) => x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom && bitmap[Math.floor(y * mask.height / height) * mask.width + Math.floor(x * mask.width / width)];
    let area = 0;
    for (let y = bounds.top; y < bounds.bottom; y++) for (let x = bounds.left; x < bounds.right; x++) if (selected(x, y)) {
      const p = y * width + x; if (!source[p * 4 + 3]) continue;
      vacated[p] = 255; result.set([128, 128, 128, 255], p * 4); area++;
    }
    if (!area) throw new Error(`The selection for "${box.label}" is empty inside its source box. Select it again.`);
    return { box, selected };
  });
  // Sample every cutout from the clean original, then paste in box order. Removing
  // all sources first keeps overlapping moves from erasing a previously pasted object.
  for (const { box, selected } of prepared) {
    const corners = boxCorners(box.target, width, height), angle = box.target.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const left = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x)))), right = Math.min(width, Math.ceil(Math.max(...corners.map(p => p.x))));
    const top = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y)))), bottom = Math.min(height, Math.ceil(Math.max(...corners.map(p => p.y))));
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
      destination[p] = source[q + 3]; visible++;
    }
    if (!visible) throw new Error(`The destination of "${box.label}" is outside the image. Move it inside the canvas.`);
  }
  const halo = Math.max(1, Math.min(6, Math.min(width, height) / 200));
  const combined = Buffer.from(vacated.map((value, p) => Math.max(value, destination[p])));
  const dilated = await sharp(combined, { raw: { width, height, channels: 1 } }).blur(halo).threshold(1).greyscale().raw().toBuffer();
  const interior = await sharp(destination, { raw: { width, height, channels: 1 } }).blur(halo).threshold(254).greyscale().raw().toBuffer();
  const edit = Buffer.alloc(pixels * 4, 255), protect = Buffer.alloc(pixels * 4, 255);
  for (let p = 0; p < pixels; p++) { edit[p * 4 + 3] = dilated[p]; protect[p * 4 + 3] = interior[p]; }
  // Protected Keep regions must be restored in the staged baseline as well as
  // excluded from the generation mask, including overlaps with pasted cutouts.
  for (const box of boxes.filter(box => box.mode === "keep")) {
    for (let y = Math.max(0, Math.floor((box.source.y - box.source.h / 2) * height)); y < Math.min(height, Math.ceil((box.source.y + box.source.h / 2) * height)); y++)
      for (let x = Math.max(0, Math.floor((box.source.x - box.source.w / 2) * width)); x < Math.min(width, Math.ceil((box.source.x + box.source.w / 2) * width)); x++) source.copy(result, (y * width + x) * 4, (y * width + x) * 4, (y * width + x) * 4 + 4);
  }
  const png = buffer => sharp(buffer, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { base: await png(result), ids: moves.map(box => box.id), editMask: await png(edit), protectedMask: await png(protect) };
}
