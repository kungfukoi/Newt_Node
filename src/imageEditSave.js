import { exportBoxSelections } from "./imageEditBoxExport.js";
import { compositeImageEditDrawing } from "./imageEdit.js";

export async function imageEditDownload({ base, result, size, marks, prompt, blank }) {
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
  if (blank) { context.fillStyle = "white"; context.fillRect(0, 0, size.width, size.height); }
  else {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Could not load the image to save.")); image.src = base.url; });
    context.drawImage(image, 0, 0, size.width, size.height);
  }
  compositeImageEditDrawing(context, marks, size.width, size.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not prepare the image to save.");
  return { blob, fileName: "image-edit.png" };
}

export function downloadImageEdit({ blob, fileName }) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
