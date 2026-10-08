import { isFlux3Model } from "./flux3.js";
import { boxCorners, boxFromDrag, boxContextRect, boxOutputRules } from "./imageEditBoxes.js";
export const boxNeedsObject = box => ["move", "remove"].includes(box.mode);
export const boxNeedsIdentification = (box, model) => boxNeedsObject(box) && (Boolean(box.sourceMask) || !isFlux3Model(model) || (box.mode === "move" && Math.abs(box.target.rotation) > .001));
export const boxNeedsCutout = (box, model) => box.mode === "move" && (Boolean(box.sourceMask) || !isFlux3Model(model) || Math.abs(box.target.rotation) > .001);

export function boxFromSelectionPixels({ data, width, height, id, label = "Object" }) {
  const runs = []; let start = -1, left = width, right = 0, top = height, bottom = 0;
  for (let p = 0; p <= width * height; p++) {
    const selected = p < width * height && data[p * 4 + 3] >= 128;
    if (selected) {
      if (start < 0) start = p;
      const x = p % width, y = Math.floor(p / width);
      left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
    } else if (start >= 0) { runs.push(start, p - start); start = -1; }
  }
  if (!runs.length) throw new Error("The selection is empty. Select an object before creating its box.");
  // Tiny selections still need a valid transform rectangle.
  const w = Math.max(.005, (right - left) / width), h = Math.max(.005, (bottom - top) / height);
  const x = Math.min(1 - w, Math.max(0, left / width)), y = Math.min(1 - h, Math.max(0, top / height));
  return { ...boxFromDrag({ x, y }, { x: x + w, y: y + h }, id), label: label.trim().slice(0, 200) || "Object", sourceMask: validateBoxObject({ width, height, runs }) };
}

export function validateBoxObject(mask) {
  if (!mask || !Number.isInteger(mask.width) || !Number.isInteger(mask.height) || mask.width < 1 || mask.height < 1 || mask.width > 1024 || mask.height > 1024 || !Array.isArray(mask.runs) || !mask.runs.length || mask.runs.length % 2 || mask.runs.length > 262144) throw new Error("Invalid box object mask. Select the object again.");
  let end = 0, area = 0;
  for (let i = 0; i < mask.runs.length; i += 2) {
    const start = mask.runs[i], length = mask.runs[i + 1];
    if (!Number.isInteger(start) || !Number.isInteger(length) || start < end || length <= 0 || start + length > mask.width * mask.height) throw new Error("Invalid box object mask runs.");
    end = start + length; area += length;
  }
  return { width: mask.width, height: mask.height, runs: mask.runs, area };
}

export function objectMaskForBox(masks, box) {
  let best = null, score = 0;
  for (const candidate of masks) {
    const mask = validateBoxObject(candidate); let inside = 0;
    for (let i = 0; i < mask.runs.length; i += 2) for (let p = mask.runs[i]; p < mask.runs[i] + mask.runs[i + 1]; p++) {
      const x = (p % mask.width + .5) / mask.width, y = (Math.floor(p / mask.width) + .5) / mask.height;
      if (Math.abs(x - box.source.x) <= box.source.w / 2 && Math.abs(y - box.source.y) <= box.source.h / 2) inside++;
    }
    const containment = inside / mask.area, value = containment >= .5 ? inside * containment : 0;
    if (value > score) { score = value; best = mask; }
  }
  return best;
}

export function fluxBoxInstructions(boxes, width, height, referenceIndices = {}, staged = []) {
  const grid = rect => {
    const points = boxCorners(rect, width, height);
    const q = (v, dimension) => Math.max(0, Math.min(1000, Math.round(v / dimension * 1000)));
    return [q(Math.min(...points.map(p => p.y)), height), q(Math.min(...points.map(p => p.x)), width), q(Math.max(...points.map(p => p.y)), height), q(Math.max(...points.map(p => p.x)), width)];
  };
  const captions = [], rows = boxes.map((box, i) => {
    const id = `object_${i + 1}`, placed = staged.includes(box.id);
    const dx = box.target.x - box.source.x, dy = box.target.y - box.source.y;
    const direction = [Math.abs(dx) > .01 ? dx < 0 ? "left" : "right" : "", Math.abs(dy) > .01 ? dy < 0 ? "up" : "down" : ""].filter(Boolean).join(" and ");
    const desc = box.mode === "text" ? `${box.label}; visible text ${JSON.stringify(box.text)}` : box.label;
    captions.push(placed ? `Regenerate and relight <${id}> already placed in <ref_image_0> at the same position, preserving identity and geometry. Infer scene lighting and supporting surfaces; create new contact/cast shadows, reflections and appropriate occlusion. Do not move or rotate it again.` : `${box.mode === "reference" ? "Place from reference" : box.mode.toUpperCase()} ${JSON.stringify(desc)} <${id}> ${box.mode === "move" ? `to the destination ${direction ? `(${direction})` : ""}, filling the vacated background without a duplicate, ` : ""}using the source and target rectangles below.${box.target.rotation ? ` Destination orientation is ${box.target.rotation} degrees clockwise.` : ""}`);
    return { id, from: ["new", "text"].includes(box.mode) ? null : box.mode === "reference" ? `ref_image_${referenceIndices[box.referenceUrl] - 1}` : "ref_image_0", src_bbox: ["new", "text"].includes(box.mode) ? null : box.mode === "reference" ? [0, 0, 1000, 1000] : grid(placed ? box.target : box.source), tgt_bbox: box.mode === "remove" ? null : grid(box.mode === "keep" ? box.source : box.target), desc };
  });
  boxes.forEach((box, i) => {
    if (!staged.includes(box.id)) return;
    const id = `vacancy_${i + 1}`;
    captions.push(`Remove the neutral gray source placeholder <${id}> and reconstruct only the surrounding background there. Do not regenerate ${JSON.stringify(box.label)} at its old location. Keep the already placed destination objects, including any that overlap this source region.`);
    rows.push({ id, from: "ref_image_0", src_bbox: grid(boxContextRect(box.source, width, height, box.contextPadding)), tgt_bbox: null, desc: `The neutral gray vacancy left by moving ${box.label}; remove the placeholder AND all shadows, ambient occlusion, reflections and color spill belonging to the old object. Reconstruct the surface as if it had never been present. Preserve unrelated scene objects and their effects, with no duplicate object. Preserve any destination cutouts overlapping this region.` });
  });
  return { caption: "In <ref_image_0>, follow these element instructions. Preserve unrelated scene content, excluding all editing-guide graphics.\n" + captions.join("\n") + "\n" + boxOutputRules, rows };
}
