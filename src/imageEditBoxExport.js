import { boxCorners, editBoxTags, editBoxesPrompt, validateEditBoxes } from "./imageEditBoxes.js";
import { validateBoxObject } from "./imageEditBoxModels.js";

export function boxSelectionDocument(boxes, size, base, prompt = "") {
  const clean = validateEditBoxes(boxes), tags = editBoxTags(clean);
  return { format: "newtnode-box-selections", version: 1, source: { width: size.width, height: size.height, name: base.fileName || base.label || "Image" }, prompt,
    boxes: clean.map((box, i) => ({ ...box, tag: tags[i], selectionDerived: Boolean(boxes[i].selectionDerived), ...(boxes[i].sourceMask ? { sourceMask: validateBoxObject(boxes[i].sourceMask) } : {}) })) };
}

export function importBoxSelections(document, size) {
  if (document?.format !== "newtnode-box-selections" || document.version !== 1) throw new Error("Choose a Newt Node box selections file.");
  if (document.source?.width !== size.width || document.source?.height !== size.height) throw new Error("Open the original image at the saved dimensions before loading these selections.");
  if (typeof document.prompt !== "string") throw new Error("Invalid saved box prompt.");
  const boxes = validateEditBoxes(document.boxes).map((box, i) => ({ ...box, layer: "boxes", tool: "box", selectionDerived: Boolean(document.boxes[i].selectionDerived), ...(document.boxes[i].sourceMask ? { sourceMask: validateBoxObject(document.boxes[i].sourceMask) } : {}) }));
  return { boxes, prompt: document.prompt };
}

function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportBoxSelections({ kind, boxes, size, base, prompt }) {
  const saved = boxSelectionDocument(boxes, size, base, prompt), tags = saved.boxes.map(box => box.tag);
  if (kind === "selections") {
    download(new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" }), "box-selections.json"); return;
  }
  if (kind === "prompt") {
    const references = Object.fromEntries([...new Set(boxes.filter(box => box.mode === "reference").map(box => box.referenceUrl))].map((url, i) => [url, i + 3]));
    const text = `Attach the original as Image 1 and the tagged guide as Image 2. Attach reference images in the order listed below. Tags refer to regions, not separate model image inputs.\n${Object.entries(references).map(([url, i]) => `Image ${i}: ${url}`).join("\n")}\n\n${prompt || ""}\n\n${editBoxesPrompt(saved.boxes, 2, references)}`;
    download(new Blob([text], { type: "text/plain;charset=utf-8" }), "box-instructions.txt"); return;
  }
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Could not load the source for export.")); image.src = base.url; });
  const canvas = document.createElement("canvas");
  const columns = Math.min(4, Math.ceil(Math.sqrt(boxes.length))), cell = 320, row = 360;
  canvas.width = kind === "sheet" ? columns * cell : size.width;
  canvas.height = kind === "sheet" ? Math.ceil(boxes.length / columns) * row : size.height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#202020"; context.fillRect(0, 0, canvas.width, canvas.height);
  if (kind !== "sheet") context.drawImage(image, 0, 0, size.width, size.height);
  const font = kind === "sheet" ? 16 : Math.max(12, Math.min(size.width, size.height) / 65);
  context.font = `${font}px sans-serif`; context.lineWidth = Math.max(2, font / 8);
  boxes.forEach((box, i) => {
    if (kind === "sheet") {
      const x = i % columns * cell, y = Math.floor(i / columns) * row, r = box.source;
      const sw = r.w * size.width, sh = r.h * size.height, scale = Math.min((cell - 16) / sw, (cell - 16) / sh);
      context.drawImage(image, (r.x - r.w / 2) * size.width, (r.y - r.h / 2) * size.height, sw, sh, x + (cell - sw * scale) / 2, y + (cell - sh * scale) / 2, sw * scale, sh * scale);
      context.fillStyle = "white"; context.fillText(tags[i], x + 8, y + cell + 20, cell - 16); return;
    }
    const draw = (rect, color, dashed) => {
      const corners = boxCorners(rect, size.width, size.height);
      context.strokeStyle = color; context.setLineDash(dashed ? [font / 2, font / 3] : []);
      context.beginPath(); corners.forEach((p, j) => j ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)); context.closePath(); context.stroke();
      return corners[0];
    };
    if (box.mode === "move") draw(box.source, "#ff3344", true);
    const p = draw(["keep", "remove"].includes(box.mode) ? box.source : box.target, box.mode === "keep" ? "#ffee22" : box.mode === "remove" ? "#ff3344" : "#00eeee", false);
    const x = Math.max(0, Math.min(p.x, size.width - context.measureText(tags[i]).width)), y = Math.max(font, Math.min(size.height - 2, p.y - 4));
    context.setLineDash([]); context.strokeStyle = "black"; context.fillStyle = "white";
    context.strokeText(tags[i], x, y); context.fillText(tags[i], x, y);
  });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not export box image.");
  download(blob, kind === "sheet" ? "box-selection-sheet.png" : "box-tagged-guide.png");
}
