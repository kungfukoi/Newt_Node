import { imageEditUsesSelectionGuide } from "../src/imageEdit.js";
import sharp from "sharp";
import { isFlux3Model } from "../src/flux3.js";
import { fluxBoxInstructions } from "../src/imageEditBoxModels.js";
import { prepareMoveCutouts } from "./image-edit-move.js";
import { validateEditBoxes } from "../src/imageEditBoxes.js";
import { prepareEditBoxes } from "./image-edit-boxes.js";
import { isIdeogram45Model } from "../src/ideogram45.js";
import { buildImageEditPrompt, imageEditMaxPixels, imageEditSize } from "../src/imageEdit.js";

const decode = (buffer) => sharp(buffer, { limitInputPixels: imageEditMaxPixels, animated: false, failOn: "error" });

export async function prepareImageEdit({ source, drawing, selection, prompt, mode, blank = false, model, boxes = [], references = [], boxObjects = {} }) {
  boxes = validateEditBoxes(boxes);
  const original = await decode(source).rotate().ensureAlpha().png().toBuffer();
  const { width, height } = await decode(original).metadata();
  const size = imageEditSize(width, height, model);
  async function layer(buffer) {
    if (!buffer) return null;
    const metadata = await decode(buffer).metadata();
    if (metadata.format !== "png" || !metadata.hasAlpha || metadata.width !== width || metadata.height !== height)
      throw new Error("Drawing and selection layers must be transparent PNGs matching the original image dimensions.");
    const { data } = await decode(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let visible = false;
    for (let i = 3; i < data.length; i += 4) if (data[i]) { visible = true; break; }
    return visible ? buffer : null;
  }
  drawing = await layer(drawing);
  selection = await layer(selection);
  if (boxes.length && (blank || mode !== "edit")) throw new Error("Boxes require the Edit image method and an existing image.");
  const guideIndex = drawing ? 3 : 2;
  references = await Promise.all(references.map(async reference => ({ ...reference, buffer: await decode(reference.buffer).rotate().png().toBuffer() })));
  const referenceIndices = Object.fromEntries(references.map((reference, index) => [reference.url, guideIndex + index + 1]));
  const staged = await prepareMoveCutouts({ original, boxes, model, objects: boxObjects, width, height });
  const boxEdit = await prepareEditBoxes({ boxes, original, width, height, selection, guideIndex, referenceIndices, staged });
  selection = boxEdit.selection;
  if (blank && selection) throw new Error("Blank sketches cannot use a selection mask.");
  let submittedPrompt = buildImageEditPrompt({ prompt: [prompt, boxEdit.prompt].filter(Boolean).join("\n\n"), mode, blank, hasDrawing: Boolean(drawing), hasSelection: Boolean(selection), model });
  if (staged.ids.length) submittedPrompt = "Image 1 is a prepared composite with the selected objects already moved. Neutral gray source vacancies need background reconstruction. The box guide shows the original source and destination for reference. Preserve the placed objects and clean up vacancies, seams and shadows.\n\n" + submittedPrompt.replace("Edit image 1, the clean original.", "Finish image 1, the prepared composite.");
  if (boxes.length && isFlux3Model(model)) {
    const structured = fluxBoxInstructions(boxes, width, height, referenceIndices, staged.ids);
    submittedPrompt += "\n\n" + structured.caption + "\n" + JSON.stringify(structured.rows);
  }
  const canvas = blank ? await sharp({ create: { width, height, channels: 4, background: "#ffffff" } }).png().toBuffer() : original;
  const guide = drawing ? await decode(canvas).composite([{ input: drawing }]).png().toBuffer() : null;
  // Annotation ink is an instruction, never output artwork. Restore the clean
  // source along its footprint, including antialiased edges and a small halo.
  // Render sketch deliberately turns the drawing into content and is excluded.
  let annotationMask = null;
  if (drawing && mode !== "sketch") {
    const ink = await decode(drawing).extractChannel(3).threshold(1).png().toBuffer();
    const halo = await decode(ink).blur(2).png().toBuffer();
    annotationMask = await decode(halo).threshold(1).png().toBuffer();
    if (staged.editMask) {
      // Restoring drawing ink from the staged image inside a vacated source
      // would restore the gray hole. Let cleanup repair that region instead.
      const inkPixels = await decode(annotationMask).greyscale().raw().toBuffer();
      const movingPixels = await decode(staged.editMask).extractChannel(3).raw().toBuffer();
      for (let p = 0; p < inkPixels.length; p++) if (movingPixels[p]) inkPixels[p] = 0;
      annotationMask = await sharp(inkPixels, { raw: { width, height, channels: 1 } }).png().toBuffer();
    }
  }
  let mask = null;
  if (selection) {
    const alpha = await decode(selection).extractChannel(3).negate().toBuffer();
    if (imageEditUsesSelectionGuide(model)) {
      mask = await decode(selection).extractChannel(3).png().toBuffer();
    } else if (isIdeogram45Model(model)) {
      const pixels = await decode(selection).extractChannel(3).raw().toBuffer();
      if (!pixels.some((value) => value < 128) || !pixels.some((value) => value >= 128))
        throw new Error("Ideogram requires both selected and unselected areas. Clear the selection to edit the entire image.");
      mask = await decode(selection).extractChannel(3).threshold(128).negate().png().toBuffer();
    } else mask = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).joinChannel(alpha).png().toBuffer();
  }
  return { original: staged.base, width, height, size, selection, mask, annotationMask, submittedPrompt, boxStrategy: staged.ids.length ? "cutout-cleanup" : boxes.length && isFlux3Model(model) ? "flux-structured" : "guide", boxes: boxEdit.boxes,
    images: blank ? [guide] : [staged.base, guide, boxEdit.guide, ...references.map(reference => reference.buffer)].filter(Boolean) };
}

export async function finishImageEdit(prepared, generated) {
  const { data: result, info } = await decode(generated).rotate().resize(prepared.width, prepared.height, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (prepared.selection || prepared.annotationMask) {
    const original = await decode(prepared.original).ensureAlpha().raw().toBuffer();
    const mask = prepared.selection ? await decode(prepared.selection).extractChannel(3).raw().toBuffer() : null;
    const annotations = prepared.annotationMask ? await decode(prepared.annotationMask).greyscale().raw().toBuffer() : null;
    // Composite in premultiplied alpha; unselected pixels remain byte-for-byte identical.
    for (let p = 0; p < prepared.width * prepared.height; p++) {
      const i = p * 4, m = (mask ? mask[p] / 255 : 1) * (annotations ? 1 - annotations[p] / 255 : 1);
      if (m === 0) { original.copy(result, i, i, i + 4); continue; }
      const a = result[i + 3] / 255 * m, b = original[i + 3] / 255 * (1 - m), alpha = a + b;
      for (let c = 0; c < 3; c++) result[i + c] = alpha ? Math.round((result[i + c] * a + original[i + c] * b) / alpha) : 0;
      result[i + 3] = Math.round(alpha * 255);
    }
  }
  // Resize metadata may mark input as premultiplied; our edited bytes are straight RGBA.
  return sharp(result, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
