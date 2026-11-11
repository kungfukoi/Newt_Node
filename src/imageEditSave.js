import { exportBoxSelections } from "./imageEditBoxExport.js";
import { compositeImageEditDrawing } from "./imageEdit.js";
import { hasLayerTransparency, preserveLayerAlpha } from "./layerAlpha.js";

export async function imageEditDownload({ base, result, size, marks, prompt, blank, lockAlpha = false }) {
  const selected = result || base;
  const boxes = marks.filter(mark => mark.layer === "boxes");
  if (result || (!blank && !boxes.length && !marks.some(mark => mark.layer === "drawing"))) {
    const response = await fetch(selected.url);
    if (!response.ok) throw new Error("Could not read the image to save.");
    return { blob: await response.blob(), fileName: selected.fileName || selected.url.split("/").at(-1)?.split("?")[0] || "image.png" };
  }
  if (boxes.length) return { blob: await exportBoxSelections({ boxes, size, base, prompt, drawingMarks: marks }), fileName: "image-selection.png" };
  const canvas = document.createElement("canvas"); canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext("2d");
  let original;
  if (!blank || lockAlpha) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Could not load the image to save.")); image.src = base.url; });
    context.drawImage(image, 0, 0, size.width, size.height);
    if (lockAlpha) original = context.getImageData(0, 0, size.width, size.height).data;
  }
  if (blank) { context.fillStyle = "white"; context.fillRect(0, 0, size.width, size.height); }
  compositeImageEditDrawing(context, marks, size.width, size.height);
  if (original && hasLayerTransparency(original)) {
    const edited = context.getImageData(0, 0, size.width, size.height);
    preserveLayerAlpha(original, edited.data);
    context.putImageData(edited, 0, 0);
  }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not prepare the image to save.");
  return { blob, fileName: "image-edit.png" };
}

export function downloadImageEdit({ blob, fileName }) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
