import { boxCorners, editBoxTags, validateEditBoxes } from "./imageEditBoxes.js";
import { validateBoxObject } from "./imageEditBoxModels.js";
import { compositeImageEditDrawing } from "./imageEdit.js";

export const selectionMetadataKeyword = "NewtNodeSelections";
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const encoder = new TextEncoder(), decoder = new TextDecoder("utf-8", { fatal: true });

export function boxSelectionDocument(boxes, size, base, prompt = "") {
  const clean = validateEditBoxes(boxes), tags = editBoxTags(clean);
  return { format: "newtnode-box-selections", version: 1,
    source: { width: size.width, height: size.height, name: base.fileName || base.label || "Image" },
    coordinates: "Normalized to the image frame: x/y are rectangle centers; w/h are dimensions; rotation is clockwise degrees.",
    annotations: "Visible boxes and tags identify objects; they are guides, not scene content. Red dashed outlines locate Move sources, cyan outlines locate destinations, yellow outlines protect Keep regions, and red outlines locate Remove regions.",
    prompt, boxes: clean.map((box, i) => ({ ...box, tag: tags[i], selectionDerived: Boolean(boxes[i].selectionDerived), ...(boxes[i].sourceMask ? { sourceMask: validateBoxObject(boxes[i].sourceMask) } : {}) })) };
}

export function selectionReferencePrompt(metadata, imageIndex) {
  const document = boxSelectionDocument(metadata.boxes, metadata.source, {}, metadata.prompt || "");
  return [`Image ${imageIndex} contains selection guides. Its @tags refer to the following objects and regions, not node references. Use these tags to resolve the user's instructions. Visible boxes, tags and selection outlines are annotations only; remove them from finished scene output. Preserve unrelated content. ${document.coordinates}`,
    ...document.boxes.map(({ sourceMask: _mask, selectionDerived: _derived, ...box }) => JSON.stringify(box))].join("\n");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunks(bytes) {
  if (bytes.length < 20 || !signature.every((byte, i) => bytes[i] === byte)) throw new Error("Invalid selection PNG.");
  const chunks = [], view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset), end = offset + length + 12;
    if (end > bytes.length) throw new Error("Truncated selection PNG.");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    chunks.push({ offset, end, length, type });
    if (type === "IEND") return chunks;
    offset = end;
  }
  throw new Error("Incomplete selection PNG.");
}

// Uncompressed UTF-8 iTXt is standard PNG metadata, preserved in the downloaded file.
export function embedSelectionMetadata(png, metadata) {
  const bytes = new Uint8Array(png), chunks = pngChunks(bytes), end = chunks.at(-1).offset;
  const data = encoder.encode(`${selectionMetadataKeyword}\0\0\0\0\0${JSON.stringify(metadata)}`);
  const chunk = new Uint8Array(data.length + 12), view = new DataView(chunk.buffer);
  view.setUint32(0, data.length); chunk.set(encoder.encode("iTXt"), 4); chunk.set(data, 8);
  view.setUint32(chunk.length - 4, crc32(chunk.subarray(4, chunk.length - 4)));
  const output = new Uint8Array(bytes.length + chunk.length);
  output.set(bytes.subarray(0, end)); output.set(chunk, end); output.set(bytes.subarray(end), end + chunk.length);
  return output;
}

// Parser for downstream integrations; this does not add an editor load action.
export function readSelectionMetadata(png) {
  const bytes = new Uint8Array(png);
  for (const chunk of pngChunks(bytes)) {
    if (chunk.type !== "iTXt") continue;
    const data = bytes.subarray(chunk.offset + 8, chunk.end - 4), separator = data.indexOf(0);
    if (separator < 0 || decoder.decode(data.subarray(0, separator)) !== selectionMetadataKeyword) continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(chunk.end - 4) !== crc32(bytes.subarray(chunk.offset + 4, chunk.end - 4))) throw new Error("Damaged selection metadata.");
    if (data[separator + 1] !== 0 || data[separator + 2] !== 0 || data[separator + 3] !== 0 || data[separator + 4] !== 0) throw new Error("Unsupported selection metadata encoding.");
    return JSON.parse(decoder.decode(data.subarray(separator + 5)));
  }
  return null;
}

export async function exportBoxSelections({ boxes, size, base, prompt, drawingMarks = [] }) {
  const saved = boxSelectionDocument(boxes, size, base, prompt);
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Could not load the source for export.")); image.src = base.url; });
  const canvas = document.createElement("canvas");
  canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, size.width, size.height);
  compositeImageEditDrawing(context, drawingMarks, size.width, size.height);
  const font = Math.max(12, Math.min(size.width, size.height) / 65);
  context.font = `${font}px sans-serif`; context.lineWidth = Math.max(2, font / 8);
  saved.boxes.forEach((box, index) => {
    const name = `${index + 1}. ${box.tag}`;
    const draw = (rect, color, dashed) => {
      const corners = boxCorners(rect, size.width, size.height);
      context.strokeStyle = color; context.setLineDash(dashed ? [font / 2, font / 3] : []);
      context.beginPath(); corners.forEach((p, j) => j ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)); context.closePath(); context.stroke();
      return corners[0];
    };
    if (box.mode === "move") {
      const source = draw(box.source, "#ff3344", true);
      label(name, source);
    }
    const p = draw(["keep", "remove"].includes(box.mode) ? box.source : box.target, box.mode === "keep" ? "#ffee22" : box.mode === "remove" ? "#ff3344" : "#00eeee", false);
    label(name, p);
  });
  function label(text, point) {
    const x = Math.max(0, Math.min(point.x, size.width - context.measureText(text).width)), y = Math.max(font, Math.min(size.height - 2, point.y - 4));
    context.setLineDash([]); context.strokeStyle = "black"; context.fillStyle = "white";
    context.strokeText(text, x, y, size.width); context.fillText(text, x, y, size.width);
  }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not export selection image.");
  const png = embedSelectionMetadata(await blob.arrayBuffer(), saved);
  return new Blob([png], { type: "image/png" });
}
