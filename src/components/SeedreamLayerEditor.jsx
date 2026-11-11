import React from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
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
  return <label className="ies-layer-slider">{label}<output>{readout}</output>
    <input aria-label={label} aria-valuetext={readout} type="range" min={min} max={max} step="1" value={value} onChange={event => onChange(event.target.valueAsNumber)} />
  </label>;
}

async function renderLayers(layers, width, height, includeLayers) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the composition.");
  // Keep the PSD records in bottom-first order, matching the canvas draw order.
  const children = [];
  for (const layer of layers) {
    const visible = layer.visible && layer.opacity > 0;
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
  return renderLayers(restoreLayers(items, width, height, draft), width, height, psd);
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
    || stack.items.find(item => item.layer.index !== 0)?.url || layers[0].url;
  return { layers, selected, canvasSize };
}

export function mergeLayerSeparation(stack, draft, results, sourceSize, replaceUrl) {
  const incoming = initializeLayerStack({ items: results, sourceSize });
  const canvasSize = draft.canvasSize || compositionSize(stack.items, stack.sourceSize, stack.canvasSize);
  const target = draft.layers.find(layer => layer.url === replaceUrl);
  const incomingItems = target ? results : results.filter(item => item.layer.index !== 0);
  const allowed = new Set(incomingItems.map(item => item.url));
  const newLayers = incoming.layers.filter(layer => allowed.has(layer.url)).map(layer => {
    const anchor = target || { x: 0, y: 0, ...canvasSize, scale: 100, rotation: 0 };
    const bounds = { left: layer.x, top: layer.y, right: layer.x + layer.width, bottom: layer.y + layer.height };
    const geometry = layerGeometryForBounds(anchor, bounds, incoming.canvasSize.width, incoming.canvasSize.height);
    return { ...layer, ...geometry, opacity: target?.opacity ?? layer.opacity, visible: target?.visible ?? layer.visible };
  });
  const layers = target ? draft.layers.flatMap(layer => layer.url === target.url ? newLayers : [layer]) : [...draft.layers, ...newLayers];
  const selected = newLayers.find(layer => layer.url === incoming.selected)?.url || newLayers[0]?.url || draft.selected;
  return { stack: { ...stack, canvasSize, items: [...stack.items.filter(item => item.url !== replaceUrl), ...incomingItems] },
    draft: { layers, selected, canvasSize }, results: incomingItems };
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
  for (const group of groups.keys()) {
    if (group === key) continue;
    const prior = read(group);
    const xScale = current.canvasSize.width / prior.canvasSize.width;
    const yScale = current.canvasSize.height / prior.canvasSize.height;
    for (const layer of prior.layers) {
      if (urls.has(layer.url)) continue;
      urls.add(layer.url);
      earlier.push({ ...layer, x: layer.x * xScale, y: layer.y * yScale, width: layer.width * xScale, height: layer.height * yScale });
    }
    drafts.delete(group);
  }
  drafts.set(key, { ...current, layers: [...earlier, ...current.layers] });
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

export function LayerStackPreview({ stack, draft, disabled, onChange, activeContent, zoom, previewUrl }) {
  const { width, height } = compositionSize(stack.items, stack.sourceSize, stack.canvasSize);
  const surface = React.useRef(null);
  const drag = React.useRef(null);
  const active = draft.layers.find(layer => layer.url === draft.selected);
  const style = layer => ({
    left: layer.x / width * 100 + "%", top: layer.y / height * 100 + "%",
    width: layer.width / width * 100 + "%", height: layer.height / height * 100 + "%",
    transform: `rotate(${layer.rotation}deg) scale(${layer.scale / 100})`,
  });
  const clampScale = value => Math.max(1, Math.min(400, Math.round(value)));
  const wrapAngle = value => ((Math.round(value) + 180) % 360 + 360) % 360 - 180;
  function startTransform(event) {
    if (event.button !== 0 || disabled || drag.current) return;
    event.stopPropagation();
    const rect = surface.current.getBoundingClientRect();
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2, centerY = bounds.top + bounds.height / 2;
    drag.current = {
      id: event.pointerId, operation: event.target.closest("[data-transform]")?.dataset.transform || "move",
      x: active.x, y: active.y, scale: active.scale, rotation: active.rotation,
      startX: event.clientX, startY: event.clientY, centerX, centerY,
      scaleX: width / rect.width, scaleY: height / rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function updateTransform(event) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    event.stopPropagation();
    if (start.operation === "scale") {
      const initial = Math.hypot(start.startX - start.centerX, start.startY - start.centerY);
      const next = Math.hypot(event.clientX - start.centerX, event.clientY - start.centerY);
      onChange({ scale: clampScale(start.scale * next / Math.max(1, initial)) });
    } else if (start.operation === "rotate") {
      const initial = Math.atan2(start.startY - start.centerY, start.startX - start.centerX);
      const next = Math.atan2(event.clientY - start.centerY, event.clientX - start.centerX);
      onChange({ rotation: wrapAngle(start.rotation + (next - initial) * 180 / Math.PI) });
    } else {
      onChange({
        x: Math.max(-width, Math.min(2 * width, Math.round(start.x + (event.clientX - start.startX) * start.scaleX))),
        y: Math.max(-height, Math.min(2 * height, Math.round(start.y + (event.clientY - start.startY) * start.scaleY))),
      });
    }
  }
  function nudgeTransform(event) {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    event.stopPropagation();
    const step = (event.shiftKey ? 10 : 1) * (["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 1);
    onChange(event.currentTarget.dataset.transform === "scale"
      ? { scale: clampScale(active.scale + step) } : { rotation: wrapAngle(active.rotation + step) });
  }
  return <div ref={surface} className="ies-layer-surface" role="group" aria-label="Layer composition">
    <div className="ies-layer-pixels">{draft.layers.map(layer => layer.url === draft.selected && activeContent
      ? <div className="ies-layer-active" key={layer.url} style={{ ...style(layer), opacity: layer.visible ? layer.opacity / 100 : 0 }} inert={!layer.visible || undefined}>{activeContent}</div>
      : layer.visible && <img key={layer.url} src={(layer.url === draft.selected && previewUrl) || layer.replacement?.url || layer.url}
        alt="" draggable={false} style={{ ...style(layer), opacity: layer.opacity / 100 }} />)}</div>
    {!activeContent && active.visible && <div className="ies-layer-selection" role="group" aria-label="Layer transform"
      style={{ ...style(active), "--ies-handle-scale": 100 / (active.scale * zoom) }}
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

export function LayerStackControls({ stack, draft, disabled, showProperties, onSelect, onDraft, onTransform }) {
  const { width, height } = compositionSize(stack.items, stack.sourceSize, stack.canvasSize);
  const { layers, selected } = draft;
  const [rename, setRename] = React.useState(null);
  const activeIndex = layers.findIndex(layer => layer.url === selected);
  const active = layers[activeIndex];
  const metadata = stack.items.find(item => item.url === active.url)?.layer;
  const change = (url, patch) => onDraft({ ...draft, layers: layers.map(layer => layer.url === url ? { ...layer, ...patch } : layer) });
  const name = layer => layer.name.trim() || stack.items.find(item => item.url === layer.url)?.label || "Layer";

  function reorder(delta) {
    const next = layers.slice();
    [next[activeIndex], next[activeIndex + delta]] = [next[activeIndex + delta], next[activeIndex]];
    onDraft({ ...draft, layers: next });
  }
  function commitRename() {
    if (rename?.name.trim()) change(rename.url, { name: rename.name.trim() });
    setRename(null);
  }

  return <section className="ies-layer-controls ies-panel-section">
    <h3>Layer stack <span>{layers.length}</span></h3>
    <div className="ies-layer-list" aria-label="Layer stack">
      {[...layers].reverse().map(layer => <div key={layer.url}>
        <button type="button" aria-label={"Show " + name(layer)} aria-pressed={layer.visible} disabled={disabled}
          onClick={() => change(layer.url, { visible: !layer.visible })}>{layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
        {rename?.url === layer.url ? <input type="text" aria-label="Rename layer" maxLength={160} autoFocus
          value={rename.name} onFocus={event => event.currentTarget.select()} onBlur={commitRename}
          onChange={event => setRename({ url: layer.url, name: event.target.value })}
          onKeyDown={event => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") { event.stopPropagation(); setRename(null); }
          }} /> : <button className="ies-layer-row-name" type="button" title="Double-click to rename"
          aria-pressed={selected === layer.url} disabled={disabled} onClick={() => onSelect(layer.url)}
          onDoubleClick={() => setRename({ url: layer.url, name: name(layer) })}>
          <img src={layer.replacement?.url || layer.url} alt="" /><span>{name(layer)}</span>
        </button>}
        {selected === layer.url && <div className="ies-layer-order" role="group" aria-label="Layer order">
          <button type="button" title="Raise layer" aria-label="Raise layer" disabled={disabled || activeIndex === layers.length - 1} onClick={() => reorder(1)}><ArrowUp size={15} /></button>
          <button type="button" title="Lower layer" aria-label="Lower layer" disabled={disabled || activeIndex === 0} onClick={() => reorder(-1)}><ArrowDown size={15} /></button>
        </div>}
      </div>)}
    </div>
    <details className="ies-disclosure" open={showProperties}>
      <summary>Layer properties</summary>
      <fieldset disabled={disabled}>
      <p className="ies-layer-property-name">{name(active)}</p>
      {metadata?.textRecognition?.text && <label>Recognized text<textarea readOnly rows={2} value={metadata.textRecognition.text} /></label>}
      <LayerSlider label="Opacity" unit="%" value={active.opacity} min={0} max={100} onChange={opacity => onTransform({ opacity })} />
      <LayerSlider label="Position X" unit=" px" value={active.x} min={-width} max={2 * width} onChange={x => onTransform({ x })} />
      <LayerSlider label="Position Y" unit=" px" value={active.y} min={-height} max={2 * height} onChange={y => onTransform({ y })} />
      <LayerSlider label="Scale" unit="%" value={active.scale} min={1} max={400} onChange={scale => onTransform({ scale })} />
      <LayerSlider label="Rotation" unit="°" value={active.rotation} min={-180} max={180} onChange={rotation => onTransform({ rotation })} />
      <button type="button" className="ies-reset-layers" onClick={() => {
        const initial = initializeLayerStack({ ...stack, selected });
        onDraft({ ...initial, layers: initial.layers.map(layer => ({ ...layer, replacement: layers.find(previous => previous.url === layer.url)?.replacement })) });
      }}>Reset layer layout</button>
      </fieldset>
    </details>
  </section>;
}
