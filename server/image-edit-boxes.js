import sharp from "sharp";
import { boxCorners, editBoxesPrompt, validateEditBoxes } from "../src/imageEditBoxes.js";

export async function prepareEditBoxes({ boxes: input, original, width, height, selection, guideIndex, referenceIndices, staged = { ids: [] } }) {
  const boxes = validateEditBoxes(input);
  if (!boxes.length) return { boxes, selection, guide: null, prompt: "" };
  const polygon = (rect, attributes = "") => `<polygon points="${boxCorners(rect, width, height).map(p => `${p.x},${p.y}`).join(" ")}" ${attributes}/>`;
  const svg = body => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);
  const stroke = Math.max(2, Math.min(width, height) / 180);
  const changed = boxes.flatMap(box => staged.ids.includes(box.id) ? [] : box.mode === "keep" ? [] : box.mode === "remove" ? [box.source] : box.mode === "move" ? [box.source, box.target] : [box.target]);
  const keep = boxes.filter(box => box.mode === "keep").map(box => box.source);
  const overlay = boxes.map((box, i) => {
    let shapes = "";
    if (["move", "remove", "keep"].includes(box.mode)) shapes += polygon(box.source, `fill="none" stroke="${box.mode === "keep" ? "#ffee22" : "#ff3344"}" stroke-width="${stroke}" stroke-dasharray="${stroke * 3} ${stroke * 2}"`);
    if (!["keep", "remove"].includes(box.mode)) shapes += polygon(box.target, `fill="none" stroke="#00eeee" stroke-width="${stroke}"`);
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
  if (changed.length) layers.push({ input: svg(changed.map(r => polygon(r, `fill="white" stroke="white" stroke-width="${stroke * 4}" stroke-linejoin="round"`)).join("")) });
  if (staged.editMask) layers.push({ input: staged.editMask });
  let mask = await canvas.composite(layers).png().toBuffer();
  mask = await sharp(mask).blur(1.5).png().toBuffer();
  if (keep.length) mask = await sharp(mask).composite([{ input: svg(keep.map(r => polygon(r, 'fill="white"')).join("")), blend: "dest-out" }]).png().toBuffer();
  if (staged.protectedMask) mask = await sharp(mask).composite([{ input: staged.protectedMask, blend: "dest-out" }]).png().toBuffer();
  const alpha = await sharp(mask).extractChannel(3).raw().toBuffer();
  if (!alpha.some(value => value > 0)) throw new Error("Keep boxes protect the entire edit area. Leave an editable region before generating.");
  return { boxes, selection: mask, guide, prompt: editBoxesPrompt(boxes, guideIndex, referenceIndices, staged.ids) };
}
