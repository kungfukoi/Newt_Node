import sharp from "sharp";
import { contextMask, objectPixels } from "./image-edit-context.js";
import { boxCorners, editBoxesPrompt, validateEditBoxes } from "../src/imageEditBoxes.js";

export async function prepareEditBoxes({ boxes: input, original, width, height, selection, guideIndex, referenceIndices, objects = {}, staged = { ids: [] } }) {
  const boxes = validateEditBoxes(input);
  if (!boxes.length) return { boxes, selection, guide: null, prompt: "" };
  const polygon = (rect, attributes = "") => `<polygon points="${boxCorners(rect, width, height).map(p => `${p.x},${p.y}`).join(" ")}" ${attributes}/>`;
  const svg = body => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);
  const stroke = Math.max(2, Math.min(width, height) / 180);
  const changed = boxes.filter(box => !staged.ids.includes(box.id) && box.mode !== "keep");
  const keep = boxes.filter(box => box.mode === "keep").map(box => box.source);
  const overlay = boxes.map((box, i) => {
    let shapes = "";
    if (["move", "remove", "keep"].includes(box.mode)) shapes += polygon(box.source, `fill="none" stroke="${box.mode === "keep" ? "#ffee22" : "#ff3344"}" stroke-width="${stroke}" stroke-dasharray="${stroke * 3} ${stroke * 2}"`);
    if (!["keep", "remove"].includes(box.mode)) shapes += polygon(box.target, `fill="none" stroke="#00eeee" stroke-width="${stroke}"`);
    if (staged.ids.includes(box.id)) shapes += `<text x="${Math.max(0, (box.source.x - box.source.w / 2) * width)}" y="${Math.max(stroke * 6, (box.source.y - box.source.h / 2) * height - stroke * 2)}" font-size="${stroke * 5}" fill="white" stroke="black" stroke-width="${stroke / 3}" paint-order="stroke">${i + 1}: BACKGROUND ONLY</text>`;
    const r = ["keep", "remove"].includes(box.mode) ? box.source : box.target;
    return shapes + `<text x="${r.x * width}" y="${r.y * height}" font-size="${stroke * 6}" fill="white" stroke="black" stroke-width="${stroke / 3}" paint-order="stroke">${i + 1}</text>`;
  }).join("");
  // A clean-original guide would reintroduce the removed object as a visual
  // reference and encourage the model to reconstruct it in the source vacancy.
  const guide = await sharp(staged.base || original).composite([{ input: svg(overlay) }]).png().toBuffer();
  // Union old/new footprints, with a small edge halo. Keep boxes override every edit region.
  let canvas = sharp({ create: { width, height, channels: 4, background: "#00000000" } });
  const layers = [];
  if (selection) layers.push({ input: selection });
  else if (!changed.length && !staged.editMask) layers.push({ input: svg(`<rect width="100%" height="100%" fill="white"/>`) });
  for (const box of changed) {
    const regions = box.mode === "move" ? [box.source, box.target] : [box.mode === "remove" ? box.source : box.target];
    for (const rect of regions) {
      const core = box.mode === "remove" && objects[box.id] ? await objectPixels(objects[box.id], width, height) : await sharp(svg(polygon(rect, 'fill="white"'))).ensureAlpha().extractChannel(3).raw().toBuffer();
      layers.push({ input: await contextMask(core, width, height, rect, box.contextPadding) });
    }
  }
  if (staged.editMask) layers.push({ input: staged.editMask });
  let mask = await canvas.composite(layers).png().toBuffer();
  if (keep.length) mask = await sharp(mask).composite([{ input: svg(keep.map(r => polygon(r, 'fill="white"')).join("")), blend: "dest-out" }]).png().toBuffer();
  if (staged.protectedMask) mask = await sharp(mask).composite([{ input: staged.protectedMask, blend: "dest-out" }]).png().toBuffer();
  // A box is a placement instruction, not an output crop. Retain the full
  // generated scene so shadows and reconstructed surfaces cannot be cut off.
  // Keep remains an explicit pixel-preservation contract.
  let compositeSelection = await sharp({ create: { width, height, channels: 4, background: "white" } }).png().toBuffer();
  if (keep.length) compositeSelection = await sharp(compositeSelection).composite([{ input: svg(keep.map(r => polygon(r, 'fill="white"')).join("")), blend: "dest-out" }]).png().toBuffer();
  const alpha = await sharp(mask).extractChannel(3).raw().toBuffer();
  if (!alpha.some(value => value > 0)) throw new Error("Keep boxes protect the entire edit area. Leave an editable region before generating.");
  return { boxes, selection: mask, compositeSelection, guide, prompt: editBoxesPrompt(boxes, guideIndex, referenceIndices, staged.ids) };
}
