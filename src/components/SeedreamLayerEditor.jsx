import React from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Folder, FolderPlus, Layers, Redo2, Trash2, Undo2, X } from "lucide-react";
import { nodeApi } from "../api/newtApi.js";
import { downloadImageEdit } from "../imageEditSave.js";
import { appendWorkflowContextFormFields } from "../workflowContext.js";
import { drawObjectMask } from "../objectSelection.js";

function initialLayers(items, width, height) {
  return [...items].sort((a, b) => a.layer.index - b.layer.index).map(item => {
    const { absolute, normalized } = item.layer.bbox || {};
    const bounds = absolute?.length === 4 ? absolute
      : normalized?.length === 4 ? normalized.map((value, index) => value * (index % 2 ? height : width) / 1000)
      : null;
    const [x, y, right, bottom] = bounds?.every(Number.isFinite) ? bounds : [0, 0, width, height];
    return { item, name: item.label, x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y), scale: 100, rotation: 0, opacity: 100, visible: true };
  });
}

function restoreLayers(items, width, height, draft) {
  const original = initialLayers(items, width, height);
  if (!Array.isArray(draft?.layers) || draft.layers.length !== original.length) return original;
  const byUrl = new Map(original.map(layer => [layer.item.url, layer]));
  const restored = [];
  for (const { url, ...edits } of draft.layers) {
    const layer = byUrl.get(url);
    if (!layer) return original;
    byUrl.delete(url);
    restored.push({ ...layer, ...edits, item: layer.item });
  }
  return restored;
}

function layerGeometry(layer) {
  return { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2,
    width: layer.width * layer.scale / 100, height: layer.height * layer.scale / 100,
    angle: layer.rotation * Math.PI / 180 };
}

const layerImageUrl = layer => layer.replacement?.url || layer.item.url;

function drawLayer(context, image, geometry, left = 0, top = 0, opacity = 1) {
  const { x, y, width, height, angle } = geometry;
  context.save();
  context.globalAlpha = opacity;
  context.translate(x - left, y - top);
  context.rotate(angle);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

function LayerSlider({ label, value, onChange, min, max, unit }) {
  const readout = `${Math.round(value * 100) / 100}${unit}`;
  const gesture = React.useRef(null);
  return <label className="ies-layer-slider">{label}<output>{readout}</output>
    <input aria-label={label} aria-valuetext={readout} type="range" min={min} max={max} step="1" value={value}
      onPointerDown={() => { gesture.current = {}; }} onPointerUp={() => { gesture.current = null; }}
      onPointerCancel={() => { gesture.current = null; }} onBlur={() => { gesture.current = null; }}
      onKeyDown={() => { gesture.current = null; }} onChange={event => onChange(event.target.valueAsNumber, gesture.current)} />
  </label>;
}

export function isLayerVisible(layer, folders = []) {
  return layer.visible && !folders.some(folder => folder.id === layer.folderId && folder.visible === false);
}

async function renderLayers(layers, width, height, includeLayers, folders) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the composition.");
  // Keep the PSD records in bottom-first order, matching the canvas draw order.
  const children = [];
  for (const layer of layers) {
    const visible = isLayerVisible(layer, folders) && layer.opacity > 0;
    if (!visible && !includeLayers) continue;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = layerImageUrl(layer);
    const name = layer.name.trim() || layer.item.label;
    await image.decode().catch(() => { throw new Error("Could not load " + name + "."); });
    const opacity = layer.opacity / 100;
    const geometry = layerGeometry(layer);
    if (visible) drawLayer(context, image, geometry, 0, 0, opacity);
    if (includeLayers) {
      const { x, y, width, height, angle } = geometry;
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      const halfWidth = (width * cos + height * sin) / 2;
      const halfHeight = (width * sin + height * cos) / 2;
      const left = Math.floor(x - halfWidth + 1e-8);
      const top = Math.floor(y - halfHeight + 1e-8);
      const pixels = document.createElement("canvas");
      pixels.width = Math.max(1, Math.ceil(x + halfWidth - 1e-8) - left);
      pixels.height = Math.max(1, Math.ceil(y + halfHeight - 1e-8) - top);
      const layerContext = pixels.getContext("2d");
      if (!layerContext) throw new Error("Could not render " + name + ".");
      drawLayer(layerContext, image, geometry, left, top);
      children.push({ name, left, top, opacity, hidden: !layer.visible, canvas: pixels });
    }
  }
  return { width, height, canvas, children };
}

export function compositionSize(items, sourceSize, canvasSize) {
  if (canvasSize) return canvasSize;
  const base = items.find(item => item.layer.index === 0);
  return { width: base?.width || sourceSize?.width || 1024, height: base?.height || sourceSize?.height || 1024 };
}

export async function renderLayerStack({ items, sourceSize, canvasSize }, draft, psd = false) {
  const { width, height } = compositionSize(items, sourceSize, canvasSize);
  const layers = restoreLayers(items, width, height, draft);
  const composition = await renderLayers(layers, width, height, psd, draft?.folders);
  if (psd && draft?.folders?.length) {
    const records = new Map(layers.map((layer, index) => [layer.item.url, composition.children[index]]));
    composition.children = layerBlocks(layers, draft.folders).map(block => {
      const children = block.layers.map(layer => records.get(layer.item.url));
      return block.folder ? { name: block.folder.name, opened: !block.folder.collapsed, hidden: block.folder.visible === false, children } : children[0];
    });
  }
  return composition;
}

export async function downloadLayerPsd(composition) {
  const { writePsd } = await import("ag-psd");
  const bytes = writePsd(composition, { noBackground: true });
  downloadImageEdit({ blob: new Blob([bytes], { type: "image/vnd.adobe.photoshop" }), fileName: "seedream-layers.psd" });
}

export async function layerCompositeBlob(canvas) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not render the composition.");
  return blob;
}

export async function uploadLayerComposite(blob, { width, height }, workflowContext) {
  const form = new FormData();
  appendWorkflowContextFormFields(form, workflowContext);
  form.append("nodeType", "image");
  form.append("asset", blob, "seedream-composition.png");
  const { response, data } = await nodeApi.uploadAsset(form);
  if (!response.ok || !data.asset?.localUrl) throw new Error(data.error || "Could not save the composition.");
  return { ...data.asset, url: data.asset.localUrl, width, height, label: "Layer Composition", type: "image", mimeType: "image/png" };
}

async function decodeLayerImage(url) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  return image;
}

export async function extractLayerSelection(sourceUrl, size, selection, box) {
  const canvas = document.createElement("canvas");
  const { width, height } = size;
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (selection) {
    const bitmap = await createImageBitmap(selection);
    try { context.drawImage(bitmap, 0, 0); } finally { bitmap.close(); }
  } else if (box.sourceMask) {
    drawObjectMask(context, box.sourceMask, width, height);
  } else {
    const region = box.source;
    context.fillRect((region.x - region.w / 2) * width, (region.y - region.h / 2) * height, region.w * width, region.h * height);
  }
  context.globalCompositeOperation = "source-in";
  context.drawImage(await decodeLayerImage(sourceUrl), 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (!data[(y * width + x) * 4 + 3]) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  if (right <= left || bottom <= top) throw new Error("The selection contains no visible pixels.");
  return { canvas, bounds: { left, top, right, bottom } };
}

function layerGeometryForBounds(layer, { left, top, right, bottom }, pixelWidth, pixelHeight) {
  const sx = layer.width / pixelWidth, sy = layer.height / pixelHeight;
  const width = (right - left) * sx, height = (bottom - top) * sy;
  const dx = ((left + right) / 2 - pixelWidth / 2) * sx * layer.scale / 100;
  const dy = ((top + bottom) / 2 - pixelHeight / 2) * sy * layer.scale / 100;
  const angle = layer.rotation * Math.PI / 180;
  return { width, height, x: layer.x + layer.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle) - width / 2,
    y: layer.y + layer.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) - height / 2,
    rotation: layer.rotation, scale: layer.scale };
}

export function cropLayerSelection({ canvas, bounds }, source) {
  const { left, top, right, bottom } = bounds;
  const cropped = document.createElement("canvas");
  cropped.width = right - left; cropped.height = bottom - top;
  cropped.getContext("2d").drawImage(canvas, -left, -top);
  return { canvas: cropped, geometry: layerGeometryForBounds(source, bounds, canvas.width, canvas.height) };
}

export async function pasteLayerSelection({ canvas: cutout, bounds }, source, target, targetUrl) {
  const image = await decodeLayerImage(targetUrl);
  const width = image.naturalWidth, height = image.naturalHeight;
  const matrix = (layer, width, height) => new DOMMatrix().translate(layer.x + layer.width / 2, layer.y + layer.height / 2)
    .rotate(layer.rotation).scale(layer.scale / 100).translate(-layer.width / 2, -layer.height / 2)
    .scale(layer.width / width, layer.height / height);
  const mapping = matrix(target, width, height).inverse().multiply(matrix(source, cutout.width, cutout.height));
  const corners = [bounds.left, bounds.right].flatMap(x => [bounds.top, bounds.bottom].map(y => new DOMPoint(x, y).matrixTransform(mapping)));
  const left = Math.floor(Math.min(0, ...corners.map(point => point.x)));
  const top = Math.floor(Math.min(0, ...corners.map(point => point.y)));
  const right = Math.ceil(Math.max(width, ...corners.map(point => point.x)));
  const bottom = Math.ceil(Math.max(height, ...corners.map(point => point.y)));
  if ((right - left) * (bottom - top) > 24_000_000) throw new Error("The expanded layer exceeds 24 megapixels. Add the selection to a new layer instead.");
  const canvas = document.createElement("canvas");
  canvas.width = right - left; canvas.height = bottom - top;
  const context = canvas.getContext("2d");
  context.drawImage(image, -left, -top);
  context.setTransform(new DOMMatrix().translate(-left, -top).multiply(mapping));
  context.drawImage(cutout, 0, 0);
  return { canvas, geometry: layerGeometryForBounds(target, { left, top, right, bottom }, width, height) };
}

export function initializeLayerStack(stack, draft) {
  const canvasSize = compositionSize(stack.items, stack.sourceSize, stack.canvasSize);
  const { width, height } = canvasSize;
  const layers = restoreLayers(stack.items, width, height, draft).map(({ item, ...edits }) => ({ ...edits, url: item.url }));
  const selected = [stack.selected, draft?.selected].find(url => layers.some(layer => layer.url === url))
    || layers.at(-1).url;
  const folders = Array.isArray(draft?.folders) ? draft.folders.filter(folder => typeof folder?.id === "string" && typeof folder.name === "string") : [];
  return { layers, selected, canvasSize, folders, appliedSignature: draft?.appliedSignature };
}

export function mergeLayerSeparation(stack, draft, results, sourceSize, replaceUrl) {
  const incoming = initializeLayerStack({ items: results, sourceSize });
  const canvasSize = draft.canvasSize || compositionSize(stack.items, stack.sourceSize, stack.canvasSize);
  const target = draft.layers.find(layer => layer.url === replaceUrl);
  const newLayers = incoming.layers.map(layer => {
    const anchor = target || { x: 0, y: 0, ...canvasSize, scale: 100, rotation: 0 };
    const bounds = { left: layer.x, top: layer.y, right: layer.x + layer.width, bottom: layer.y + layer.height };
    const geometry = layerGeometryForBounds(anchor, bounds, incoming.canvasSize.width, incoming.canvasSize.height);
    return { ...layer, ...geometry, folderId: target?.folderId, opacity: target?.opacity ?? layer.opacity, visible: target?.visible ?? layer.visible };
  });
  const layers = target ? draft.layers.flatMap(layer => layer.url === target.url ? newLayers : [layer]) : [...draft.layers, ...newLayers];
  const selected = newLayers.find(layer => layer.url === incoming.selected)?.url || newLayers[0]?.url || draft.selected;
  return { stack: { ...stack, canvasSize, items: [...stack.items.filter(item => item.url !== replaceUrl), ...results] },
    draft: { ...draft, layers, selected, canvasSize }, results };
}

export function consolidateLayerStacks(stored) {
  const groups = Map.groupBy(stored.results.filter(item => item.layerGroup), item => item.layerGroup);
  if (groups.size < 2) return stored;
  const key = groups.has(stored.lastStack) ? stored.lastStack : [...groups.keys()].at(-1);
  const drafts = new Map(stored.drafts);
  const read = group => {
    const items = groups.get(group);
    return initializeLayerStack({ items, sourceSize: items[0].layerSourceSize, canvasSize: drafts.get(group)?.canvasSize }, drafts.get(group));
  };
  const current = read(key);
  const urls = new Set(current.layers.map(layer => layer.url));
  const earlier = [];
  const folders = [...current.folders];
  for (const group of groups.keys()) {
    if (group === key) continue;
    const prior = read(group);
    folders.push(...prior.folders);
    const xScale = current.canvasSize.width / prior.canvasSize.width;
    const yScale = current.canvasSize.height / prior.canvasSize.height;
    for (const layer of prior.layers) {
      if (urls.has(layer.url)) continue;
      urls.add(layer.url);
      earlier.push({ ...layer, x: layer.x * xScale, y: layer.y * yScale, width: layer.width * xScale, height: layer.height * yScale });
    }
    drafts.delete(group);
  }
  drafts.set(key, { ...current, folders, layers: [...earlier, ...current.layers] });
  const known = new Set();
  const results = stored.results.flatMap(item => {
    if (!item.layerGroup) return [item];
    if (known.has(item.url)) return [];
    known.add(item.url);
    return [{ ...item, layerGroup: key }];
  });
  return { ...stored, results, drafts: [...drafts], lastStack: key, consolidated: true };
}

export function layerEditSource(stack, layer) {
  const item = stack.items.find(item => item.url === layer.url);
  return { ...item, ...layer.replacement, label: layer.name.trim() || item.label };
}

function rotateLayerOffset(x, y, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function layerSelectionFrame(layers, active) {
  if (layers.length <= 1) return layers[0];
  const angle = active.rotation * Math.PI / 180;
  const bounds = layers.map(layer => {
    const geometry = layerGeometry(layer);
    const center = rotateLayerOffset(geometry.x, geometry.y, -angle);
    const relative = geometry.angle - angle;
    const cos = Math.abs(Math.cos(relative)), sin = Math.abs(Math.sin(relative));
    const halfWidth = (geometry.width * cos + geometry.height * sin) / 2;
    const halfHeight = (geometry.width * sin + geometry.height * cos) / 2;
    return { left: center.x - halfWidth, top: center.y - halfHeight, right: center.x + halfWidth, bottom: center.y + halfHeight };
  });
  const left = Math.min(...bounds.map(box => box.left)), right = Math.max(...bounds.map(box => box.right));
  const top = Math.min(...bounds.map(box => box.top)), bottom = Math.max(...bounds.map(box => box.bottom));
  const center = rotateLayerOffset((left + right) / 2, (top + bottom) / 2, angle);
  const width = right - left, height = bottom - top;
  return { x: center.x - width / 2, y: center.y - height / 2, width, height, rotation: active.rotation, scale: 100 };
}

const clampLayerScale = value => Math.max(1, Math.min(400, Math.round(value)));
const wrapLayerAngle = value => ((value + 180) % 360 + 360) % 360 - 180;

function transformLayerSelection(layers, frame, { dx = 0, dy = 0, ratio = 1, rotation = 0 }, width, height) {
  if (layers.length === 1) {
    const [layer] = layers;
    return new Map([[layer.url, {
      x: dx ? Math.max(-width, Math.min(2 * width, Math.round(layer.x + dx))) : layer.x,
      y: dy ? Math.max(-height, Math.min(2 * height, Math.round(layer.y + dy))) : layer.y,
      scale: ratio === 1 ? layer.scale : clampLayerScale(layer.scale * ratio),
      rotation: rotation ? wrapLayerAngle(Math.round(layer.rotation + rotation)) : layer.rotation,
    }]]);
  }
  const minRatio = Math.max(...layers.map(layer => 1 / layer.scale));
  const maxRatio = Math.min(...layers.map(layer => 400 / layer.scale));
  ratio = Math.max(minRatio, Math.min(maxRatio, ratio));
  if (ratio === 1 && !rotation) {
    const clampDelta = (delta, axis, size) => Math.max(
      Math.min(0, Math.max(...layers.map(layer => -size - layer[axis]))),
      Math.min(Math.max(0, Math.min(...layers.map(layer => 2 * size - layer[axis]))), Math.round(delta))
    );
    const x = clampDelta(dx, "x", width), y = clampDelta(dy, "y", height);
    return new Map(layers.map(layer => [layer.url, { x: layer.x + x, y: layer.y + y }]));
  }
  const centerX = frame.x + frame.width / 2, centerY = frame.y + frame.height / 2;
  return new Map(layers.map(layer => {
    const geometry = layerGeometry(layer);
    const offset = rotateLayerOffset(geometry.x - centerX, geometry.y - centerY, rotation * Math.PI / 180);
    return [layer.url, {
      x: centerX + offset.x * ratio - layer.width / 2,
      y: centerY + offset.y * ratio - layer.height / 2,
      scale: layer.scale * ratio,
      rotation: rotation ? wrapLayerAngle(layer.rotation + rotation) : layer.rotation,
    }];
  }));
}

export function LayerStackPreview({ stack, draft, selectedUrls, disabled, onChange, activeContent, zoom, previewUrl, showTransform }) {
  const { width, height } = compositionSize(stack.items, stack.sourceSize, stack.canvasSize);
  const surface = React.useRef(null);
  const drag = React.useRef(null);
  const active = draft.layers.find(layer => layer.url === draft.selected);
  const selectedLayers = draft.layers.filter(layer => selectedUrls.has(layer.url));
  const frame = layerSelectionFrame(selectedLayers, active);
  const style = layer => ({
    left: layer.x / width * 100 + "%", top: layer.y / height * 100 + "%",
    width: layer.width / width * 100 + "%", height: layer.height / height * 100 + "%",
    transform: `rotate(${layer.rotation}deg) scale(${layer.scale / 100})`,
  });
  function startTransform(event) {
    if (event.button !== 0 || disabled || drag.current) return;
    event.stopPropagation();
    const rect = surface.current.getBoundingClientRect();
    const bounds = event.currentTarget.getBoundingClientRect();
    drag.current = {
      id: event.pointerId, operation: event.target.closest("[data-transform]")?.dataset.transform || "move",
      layers: selectedLayers, frame,
      startX: event.clientX, startY: event.clientY,
      centerX: bounds.left + bounds.width / 2, centerY: bounds.top + bounds.height / 2,
      scaleX: width / rect.width, scaleY: height / rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function updateTransform(event) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    event.stopPropagation();
    let transform;
    if (start.operation === "scale") {
      const initial = Math.hypot(start.startX - start.centerX, start.startY - start.centerY);
      const next = Math.hypot(event.clientX - start.centerX, event.clientY - start.centerY);
      transform = { ratio: next / Math.max(1, initial) };
    } else if (start.operation === "rotate") {
      const initial = Math.atan2(start.startY - start.centerY, start.startX - start.centerX);
      const next = Math.atan2(event.clientY - start.centerY, event.clientX - start.centerX);
      transform = { rotation: Math.round((next - initial) * 180 / Math.PI) };
    } else {
      transform = { dx: (event.clientX - start.startX) * start.scaleX, dy: (event.clientY - start.startY) * start.scaleY };
    }
    onChange(transformLayerSelection(start.layers, start.frame, transform, width, height), start);
  }
  function nudgeTransform(event) {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    event.stopPropagation();
    const step = (event.shiftKey ? 10 : 1) * (["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 1);
    const transform = event.currentTarget.dataset.transform === "scale"
      ? { ratio: (active.scale + step) / active.scale } : { rotation: step };
    onChange(transformLayerSelection(selectedLayers, frame, transform, width, height));
  }
  return <div ref={surface} className="ies-layer-surface" role="group" aria-label="Layer composition">
    <div className="ies-layer-pixels">{draft.layers.map(layer => {
      const visible = isLayerVisible(layer, draft.folders);
      return layer.url === draft.selected && activeContent
        ? <div className="ies-layer-active" key={layer.url} style={{ ...style(layer), opacity: visible ? layer.opacity / 100 : 0 }} inert={!visible || undefined}>{activeContent}</div>
        : visible && <img key={layer.url} src={(layer.url === draft.selected && previewUrl) || layer.replacement?.url || layer.url}
          alt="" draggable={false} data-selected={selectedUrls.has(layer.url) || undefined} style={{ ...style(layer), opacity: layer.opacity / 100 }} />;
    })}</div>
    {showTransform && !activeContent && selectedLayers.some(layer => isLayerVisible(layer, draft.folders)) && <div className="ies-layer-selection" role="group" aria-label={selectedLayers.length > 1 ? "Selected layers transform" : "Layer transform"}
      style={{ ...style(frame), "--ies-handle-scale": 100 / (frame.scale * zoom) }}
      onPointerDown={startTransform} onPointerMove={updateTransform} onLostPointerCapture={() => { drag.current = null; }}>
      {["Top left", "Top right", "Bottom left", "Bottom right"].map((corner, index) =>
        <button key={corner} type="button" className="ies-transform-handle" data-transform="scale"
          style={{ left: index % 2 ? "100%" : "0%", top: index >= 2 ? "100%" : "0%" }}
          aria-label={corner + " scale handle"} disabled={disabled} onKeyDown={nudgeTransform} />)}
      <span className="ies-rotate-stem"><button type="button" className="ies-transform-handle" data-transform="rotate"
        aria-label="Rotate layer handle" disabled={disabled} onKeyDown={nudgeTransform} /></span>
    </div>}
  </div>;
}

function layerBlocks(layers, folders) {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const grouped = new Map();
  const blocks = [];
  for (const layer of layers) {
    const folder = byId.get(layer.folderId);
    if (!folder) {
      blocks.push({ layers: [layer] });
      continue;
    }
    if (!grouped.has(folder.id)) {
      const block = { folder, layers: [] };
      grouped.set(folder.id, block);
      blocks.push(block);
    }
    grouped.get(folder.id).layers.push(layer);
  }
  return [...blocks, ...folders.filter(folder => !grouped.has(folder.id)).map(folder => ({ folder, layers: [] }))];
}

export function LayerStackControls({ stack, draft, disabled, showProperties, canUndo, canRedo, canSeparate, onSeparate, onRemove, onUndo, onRedo, selection, selectedUrls, onSelect, onDraft, onTransform }) {
  const { width, height } = compositionSize(stack.items, stack.sourceSize, stack.canvasSize);
  const { layers, selected, folders = [] } = draft;
  const blocks = layerBlocks(layers, folders);
  const selectionAnchor = React.useRef(null);
  const removeLabel = selectedUrls.size > 1 ? "Remove selected layers" : "Remove selected layer";
  const [rename, setRename] = React.useState(null);
  const [dropTarget, setDropTarget] = React.useState(null);
  const [draggedLayer, setDraggedLayer] = React.useState(null);
  const [listHeight, setListHeight] = React.useState();
  const listRef = React.useRef(null);
  const resizeStart = React.useRef(null);
  const resizeFrame = React.useRef(0);
  React.useEffect(() => () => cancelAnimationFrame(resizeFrame.current), []);
  const listId = React.useId();
  const activeIndex = layers.findIndex(layer => layer.url === selected);
  const active = layers[activeIndex];
  const activeBlockIndex = blocks.findIndex(block => block.layers.includes(active));
  const activeBlock = blocks[activeBlockIndex];
  const metadata = stack.items.find(item => item.url === active.url)?.layer;
  const change = (url, patch) => onDraft({ ...draft, layers: layers.map(layer => layer.url === url ? { ...layer, ...patch } : layer) });
  const name = layer => layer.name.trim() || stack.items.find(item => item.url === layer.url)?.label || "Layer";

  function reorder(delta) {
    if (activeBlock.folder) {
      const siblings = activeBlock.layers;
      const index = siblings.indexOf(active);
      [siblings[index], siblings[index + delta]] = [siblings[index + delta], siblings[index]];
    } else {
      const target = neighborBlock(delta);
      [blocks[activeBlockIndex], blocks[target]] = [blocks[target], blocks[activeBlockIndex]];
    }
    onDraft({ ...draft, layers: blocks.flatMap(block => block.layers) });
  }
  function neighborBlock(delta) {
    for (let index = activeBlockIndex + delta; index >= 0 && index < blocks.length; index += delta) {
      if (blocks[index].layers.length) return index;
    }
    return -1;
  }
  const canReorder = delta => activeBlock.folder
    ? Boolean(activeBlock.layers[activeBlock.layers.indexOf(active) + delta]) : neighborBlock(delta) !== -1;
  function updateFolder(id, patch) {
    onDraft({ ...draft, folders: folders.map(folder => folder.id === id ? { ...folder, ...patch } : folder) });
  }
  function moveLayer(url, folderId, targetUrl, above) {
    const moving = layers.find(layer => layer.url === url);
    if (!moving || url === targetUrl || (!targetUrl && (moving.folderId || "") === folderId)) return;
    const next = layers.filter(layer => layer !== moving);
    const last = folderId ? next.findLastIndex(layer => layer.folderId === folderId) : -1;
    const index = targetUrl ? next.findIndex(layer => layer.url === targetUrl) + Number(above) : last < 0 ? next.length : last + 1;
    next.splice(index, 0, { ...moving, folderId: folderId || undefined });
    onDraft({ ...draft, layers: next, folders: folders.map(folder => folder.id === folderId ? { ...folder, collapsed: false } : folder) });
  }
  function commitRename() {
    if (rename?.name.trim()) {
      if (rename.folder) updateFolder(rename.id, { name: rename.name.trim() });
      else change(rename.id, { name: rename.name.trim() });
    }
    setRename(null);
  }
  function renameInput(label) {
    return <input type="text" aria-label={label} maxLength={160} autoFocus value={rename.name}
      onFocus={event => event.currentTarget.select()} onBlur={commitRename}
      onChange={event => setRename({ ...rename, name: event.target.value })}
      onKeyDown={event => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") { event.stopPropagation(); setRename(null); }
      }} />;
  }
  function dropHandlers(folderId, targetUrl) {
    const isAbove = event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      return event.clientY < bounds.top + bounds.height / 2;
    };
    return {
      onDragOver: event => {
        if (!draggedLayer || disabled || draggedLayer === targetUrl) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        const id = targetUrl || folderId;
        const above = isAbove(event);
        setDropTarget(current => current?.id === id && current.above === above ? current : { id, above });
      },
      onDragLeave: event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(null);
      },
      onDrop: event => {
        if (!draggedLayer || disabled || draggedLayer === targetUrl) return;
        event.preventDefault();
        event.stopPropagation();
        moveLayer(draggedLayer, folderId, targetUrl, isAbove(event));
        setDraggedLayer(null); setDropTarget(null);
      },
    };
  }
  function selectLayer(event, url) {
    let primary = url;
    let urls = new Set([url]);
    const anchor = (selection?.primary === selected && selectionAnchor.current) || selected;
    if (event.shiftKey) {
      const visibleRows = [...blocks].reverse().flatMap(({ folder, layers }) => folder?.collapsed ? [] : [...layers].reverse());
      const from = visibleRows.findIndex(layer => layer.url === anchor);
      const to = visibleRows.findIndex(layer => layer.url === url);
      if (from >= 0 && to >= 0) {
        urls = new Set(visibleRows.slice(Math.min(from, to), Math.max(from, to) + 1).map(layer => layer.url));
      }
    } else if (event.ctrlKey || event.metaKey) {
      urls = new Set(selectedUrls);
      if (urls.has(url) && urls.size > 1) {
        urls.delete(url);
        primary = url === selected ? [...urls].at(-1) : selected;
      } else urls.add(url);
    }
    selectionAnchor.current = event.shiftKey ? anchor : primary;
    onSelect(primary, urls);
  }
  function layerRow(layer, nested = false) {
    const dropSide = dropTarget?.id === layer.url ? dropTarget.above ? " ies-drop-above" : " ies-drop-below" : "";
    return <div className={`ies-layer-row${nested ? " ies-layer-nested" : ""}${dropSide}`} key={layer.url} {...dropHandlers(layer.folderId || "", layer.url)}>
      <button type="button" aria-label={"Show " + name(layer)} aria-pressed={layer.visible} disabled={disabled}
        onClick={() => change(layer.url, { visible: !layer.visible })}>{layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
      {rename?.id === layer.url ? renameInput("Rename layer") : <button className="ies-layer-row-name" type="button" title="Drag to reorder · Double-click to rename"
        aria-pressed={selectedUrls.has(layer.url)} data-active={selected === layer.url} disabled={disabled} draggable={!disabled} onClick={event => selectLayer(event, layer.url)}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" onKeyDown={event => {
          if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key) || selected !== layer.url) return;
          event.preventDefault(); event.stopPropagation();
          const delta = event.key === "ArrowUp" ? 1 : -1;
          if (canReorder(delta)) reorder(delta);
        }}
        onDragStart={event => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", name(layer));
          setDraggedLayer(layer.url);
        }} onDragEnd={() => { setDraggedLayer(null); setDropTarget(null); }}
        onDoubleClick={() => setRename({ id: layer.url, name: name(layer) })}>
        <img src={layer.replacement?.url || layer.url} alt="" draggable={false} /><span>{name(layer)}</span>
      </button>}
    </div>;
  }
  function resizeList(height) {
    setListHeight(Math.max(56, height));
  }

  function resizeDuringDrag() {
    const drag = resizeStart.current;
    if (!drag) return;
    const list = listRef.current;
    const { sidebar } = drag;
    const height = drag.height + drag.pointerY - drag.startY + sidebar.scrollTop - drag.scrollTop + drag.edgeGrowth;
    if (drag.moved || height !== drag.height) resizeList(height);
    const edge = sidebar.getBoundingClientRect().bottom - 36;
    if (drag.pointerY > Math.max(edge, drag.startY) && height < list.scrollHeight) {
      const step = Math.min(20, Math.ceil((drag.pointerY - edge) / 2));
      const previousScroll = sidebar.scrollTop;
      sidebar.scrollTop += step;
      // The sidebar can reach its scroll limit before React lays out the larger list.
      drag.edgeGrowth += step - (sidebar.scrollTop - previousScroll);
    }
    resizeFrame.current = requestAnimationFrame(resizeDuringDrag);
  }

  return <section className="ies-layer-controls ies-panel-section">
    <div className="ies-layer-stack-heading">
      <h3>Layer stack <span>{layers.length}</span></h3>
      <div className="ies-layer-history" role="group" aria-label="Layer stack actions">
        <button type="button" title="Separate selected layer" aria-label="Separate Selected Layer" disabled={!canSeparate} onClick={onSeparate}><Layers size={14} /></button>
        <button type="button" title="New layer folder" aria-label="New layer folder" disabled={disabled} onClick={() => {
          const id = crypto.randomUUID();
          const names = new Set(folders.map(folder => folder.name));
          let number = 1;
          while (names.has("Folder " + number)) number += 1;
          onDraft({ ...draft, folders: [...folders, { id, name: "Folder " + number, collapsed: false }] });
        }}><FolderPlus size={14} /></button>
        <button type="button" title={selectedUrls.size === layers.length ? "Keep at least one layer" : removeLabel}
          aria-label={removeLabel}
          disabled={disabled || selectedUrls.size === layers.length} onClick={() => {
            onRemove(selectedUrls);
            onSelect(selected, new Set([selected]));
            selectionAnchor.current = null;
          }}><Trash2 size={14} /></button>
        <button type="button" title="Undo layer change" aria-label="Undo layer change" disabled={disabled || !canUndo} onClick={onUndo}><Undo2 size={14} /></button>
        <button type="button" title="Redo layer change" aria-label="Redo layer change" disabled={disabled || !canRedo} onClick={onRedo}><Redo2 size={14} /></button>
      </div>
    </div>
    <div ref={listRef} id={listId} className="ies-layer-list" aria-label="Layer stack" style={{ height: listHeight, maxHeight: listHeight === undefined ? 180 : undefined }}>
      {[...blocks].reverse().map(({ folder, layers: members }) => folder
        ? <div className="ies-layer-folder" key={folder.id}>
          <div className={`ies-folder-row${dropTarget?.id === folder.id ? " ies-folder-drop" : ""}`} {...dropHandlers(folder.id)}>
            <button type="button" aria-label={"Show " + folder.name} aria-pressed={folder.visible !== false} disabled={disabled}
              onClick={() => updateFolder(folder.id, { visible: folder.visible === false })}>{folder.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            <button type="button" aria-expanded={!folder.collapsed} aria-label={(folder.collapsed ? "Expand " : "Collapse ") + folder.name} disabled={disabled}
              onClick={() => updateFolder(folder.id, { collapsed: !folder.collapsed })}>{folder.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
            {rename?.id === folder.id ? renameInput("Rename folder") : <button type="button" className="ies-layer-row-name" title="Double-click to rename folder" disabled={disabled}
              onDoubleClick={() => setRename({ id: folder.id, folder: true, name: folder.name })}><Folder size={15} /><span>{folder.name}</span></button>}
            <button type="button" aria-label={"Ungroup " + folder.name} title="Remove folder and keep its layers" disabled={disabled} onClick={() => onDraft({
              ...draft, folders: folders.filter(entry => entry.id !== folder.id),
              layers: layers.map(layer => layer.folderId === folder.id ? { ...layer, folderId: undefined } : layer),
            })}><X size={13} /></button>
          </div>
          {!folder.collapsed && [...members].reverse().map(layer => layerRow(layer, true))}
        </div> : layerRow(members[0]))}
      {draggedLayer && <div className={`ies-folder-root${dropTarget?.id === "" ? " ies-folder-drop" : ""}`} {...dropHandlers("")}>Drop to move out of folder</div>}
    </div>
    <button type="button" className="ies-layer-resize" aria-label="Resize layer stack" aria-controls={listId}
      aria-keyshortcuts="ArrowUp ArrowDown Home End" title="Drag to resize or double-click to show all layers"
      onDoubleClick={() => setListHeight("auto")}
      onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary) return;
        const sidebar = event.currentTarget.closest(".ies-sidebar-scroll");
        resizeStart.current = { sidebar, startY: event.clientY, pointerY: event.clientY, height: listRef.current.clientHeight, scrollTop: sidebar.scrollTop, edgeGrowth: 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
        resizeFrame.current = requestAnimationFrame(resizeDuringDrag);
      }}
      onPointerMove={event => {
        const drag = resizeStart.current;
        if (drag && event.currentTarget.hasPointerCapture(event.pointerId)) {
          drag.pointerY = event.clientY;
          drag.moved ||= event.clientY !== drag.startY;
        }
      }}
      onPointerUp={event => {
        const drag = resizeStart.current;
        if (!drag) return;
        const height = drag.height + event.clientY - drag.startY + drag.sidebar.scrollTop - drag.scrollTop + drag.edgeGrowth;
        if (drag.moved || height !== drag.height) resizeList(height);
      }}
      onLostPointerCapture={() => {
        resizeStart.current = null;
        cancelAnimationFrame(resizeFrame.current);
      }}
      onKeyDown={event => {
        const height = listRef.current.clientHeight;
        const next = { ArrowUp: height - 24, ArrowDown: height + 24, Home: 56, End: "auto" }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        if (next === "auto") setListHeight(next);
        else resizeList(next);
      }}><span /></button>
    <details className="ies-disclosure" open={showProperties}>
      <summary>Layer properties</summary>
      <fieldset className="ies-transform-fields" disabled={disabled}>
      <p className="ies-layer-property-name">{name(active)}</p>
      {folders.length > 0 && <label className="ies-layer-folder-field">Folder<select value={active.folderId || ""} onChange={event => moveLayer(active.url, event.target.value)}>
        <option value="">No folder</option>
        {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select></label>}
      <LayerSlider label="Opacity" unit="%" value={active.opacity} min={0} max={100} onChange={(opacity, gesture) => onTransform({ opacity }, gesture)} />
      <LayerSlider label="Position X" unit=" px" value={active.x} min={-width} max={2 * width} onChange={(x, gesture) => onTransform({ x }, gesture)} />
      <LayerSlider label="Position Y" unit=" px" value={active.y} min={-height} max={2 * height} onChange={(y, gesture) => onTransform({ y }, gesture)} />
      <LayerSlider label="Scale" unit="%" value={active.scale} min={1} max={400} onChange={(scale, gesture) => onTransform({ scale }, gesture)} />
      <LayerSlider label="Rotation" unit="°" value={active.rotation} min={-180} max={180} onChange={(rotation, gesture) => onTransform({ rotation }, gesture)} />
      {metadata?.textRecognition?.text && <label className="ies-layer-ocr">Recognized text<textarea readOnly rows={1} value={metadata.textRecognition.text} /></label>}
      <button type="button" className="ies-reset-layers" onClick={() => {
        const initial = initializeLayerStack({ ...stack, selected });
        const byUrl = new Map(initial.layers.map(layer => [layer.url, layer]));
        onDraft({ ...draft, layers: layers.map(layer => ({ ...byUrl.get(layer.url), folderId: layer.folderId, replacement: layer.replacement })) });
      }}>Reset layer layout</button>
      </fieldset>
    </details>
  </section>;
}
