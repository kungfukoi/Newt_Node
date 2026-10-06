import { imageEditUsesSelectionGuide } from "../src/imageEdit.js";
import sharp from "sharp";
import { isIdeogram45Model } from "../src/ideogram45.js";
import { buildImageEditPrompt, imageEditMaxPixels, imageEditSize } from "../src/imageEdit.js";

const decode = (buffer) => sharp(buffer, { limitInputPixels: imageEditMaxPixels, animated: false, failOn: "error" });

export async function prepareImageEdit({ source, drawing, selection, prompt, mode, blank = false, model }) {
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
  if (blank && selection) throw new Error("Blank sketches cannot use a selection mask.");
  const submittedPrompt = buildImageEditPrompt({ prompt, mode, blank, hasDrawing: Boolean(drawing), hasSelection: Boolean(selection), model });
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
  return { original, width, height, size, selection, mask, annotationMask, submittedPrompt,
    images: blank ? [guide] : [original, guide].filter(Boolean) };
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
