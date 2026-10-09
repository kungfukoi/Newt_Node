import { isFlux3Model, flux3ResolutionOptions } from "../flux3.js";
import { nanoBanana21ResolutionOptions } from "../nanoBanana21.js";
import { imageEditRequiresFal, imageEditUsesSelectionGuide } from "../imageEdit.js";
import React from "react";
import { Boxes } from "lucide-react";
import { validateEditBoxes } from "../imageEditBoxes.js";
import { boxNeedsObject, boxNeedsIdentification, objectMaskForBox, boxFromSelectionPixels } from "../imageEditBoxModels.js";
import { ImageEditBoxesOverlay, ImageEditBoxesPanel, ImageEditBoxPreview } from "./ImageEditBoxes.jsx";
import { drawObjectMask, objectAtPoint, selectObjectMarks, sam2Defaults } from "../objectSelection.js";
import { ArrowUpRight, Brush, Check, Circle, Download, Eraser, Hand, LoaderCircle, Maximize, Minus, Pencil, Plus, Redo2, RefreshCcw, Scan, ScanSearch, Square, Trash2, Type, Undo2, X } from "lucide-react";
import { drawImageEditMarks, imageEditColors, imageEditHasPixels, imageEditPoint, imageEditSize } from "../imageEdit.js";
import { nodeApi } from "../api/newtApi.js";
import { imageEditModelOptions, normalizeImageEditModel } from "../imageEdit.js";
import { saveImageEditorModel } from "../imageEditorPreference.js";
import { isIdeogram45Model, ideogram45QualityOptions } from "../ideogram45.js";
import { appendWorkflowContextFormFields } from "../workflowContext.js";
import "./imageEditStudio.css";

const tools = [["pen", Pencil, "Draw"], ["arrow", ArrowUpRight, "Arrow"], ["ellipse", Circle, "Circle"], ["rectangle", Square, "Rectangle"], ["text", Type, "Text note"], ["eraser", Eraser, "Erase marks"], ["hand", Hand, "Pan"]];
const blobOf = (canvas) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare the drawing.")), "image/png"));
const emptyHistory = { past: [], marks: [], future: [] };

function IconButton({ icon: Icon, label, active = false, ...props }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={active} className={`ies-icon ${active ? "active" : ""}`} {...props}><Icon size={18} /></button>;
}

function CompareHandle({ split, setSplit, surfaceRef }) {
  const update = event => {
    const rect = surfaceRef.current.getBoundingClientRect();
    setSplit(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)));
  };
  const release = event => {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="ies-split-line ies-compare-handle" role="slider" tabIndex={0} aria-label="Compare divider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)} style={{ left: `${split}%` }}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
    onPointerMove={event => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event); }}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={event => event.stopPropagation()}
    onKeyDown={event => { event.stopPropagation(); if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); setSplit(value => event.key === "Home" ? 0 : event.key === "End" ? 100 : Math.max(0, Math.min(100, value + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1)))); } }}>
    <span className="ies-compare-grip" aria-hidden="true">↔</span>
  </div>;
}

export function ImageEditStudio({ item, workflowContext, falAvailable, provider: defaultProvider = falAvailable ? "fal" : "", model: selectedModel, canApply, onAccept, onClose, showApiCosts = false }) {
  const model = normalizeImageEditModel(selectedModel);
  const provider = imageEditRequiresFal(model) ? (falAvailable ? "fal" : "") : defaultProvider;
  const resolutionOptions = isFlux3Model(model) ? flux3ResolutionOptions : nanoBanana21ResolutionOptions;
  const [base, setBase] = React.useState(item);
  const [size, setSize] = React.useState(null);
  const [history, setHistory] = React.useState(emptyHistory);
  const [draft, setDraft] = React.useState(null);
  const [selectedBoxId, setSelectedBoxId] = React.useState("");
  const boxGesture = React.useRef(false);
  const [tool, setTool] = React.useState("pen");
  const [layer, setLayer] = React.useState("drawing");
  const [color, setColor] = React.useState(imageEditColors[2]);
  const [brushSize, setBrushSize] = React.useState(1);
  const [opacity, setOpacity] = React.useState(100);
  const [note, setNote] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [mode, setMode] = React.useState("edit");
  const [blank, setBlank] = React.useState(false);
  const [resolution, setResolution] = React.useState("2K");
  const [quality, setQuality] = React.useState("high");
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [viewport, setViewport] = React.useState({ width: 700, height: 600 });
  const [versions, setVersions] = React.useState([]);
  const versionDrafts = React.useRef([]);
  const [resultIndex, setResultIndex] = React.useState(-1);
  const [view, setView] = React.useState("result");
  const [split, setSplit] = React.useState(50);
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [modelSaving, setModelSaving] = React.useState(false);
  const modelSavePending = React.useRef(false);
  const [error, setError] = React.useState("");
  const [warning, setWarning] = React.useState("");
  const [elapsed, setElapsed] = React.useState(0);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [cursor, setCursor] = React.useState(null);
  const [objectMasks, setObjectMasks] = React.useState([]);
  const [hoverObject, setHoverObject] = React.useState(null);
  const [selectionPrompt, setSelectionPrompt] = React.useState("");
  const selectionName = React.useRef("");
  const [sam2Settings, setSam2Settings] = React.useState(sam2Defaults);
  const [objectStatus, setObjectStatus] = React.useState("");
  const [busyLabel, setBusyLabel] = React.useState("Generating edit");
  const objectCache = React.useRef(new Map()), hoverRef = React.useRef(null);
  const scanRevision = React.useRef(0);
  const [inheritedScan, setInheritedScan] = React.useState(false);
  const mounted = React.useRef(true);
  const drawingRef = React.useRef(null), selectionRef = React.useRef(null), stageRef = React.useRef(null), surfaceRef = React.useRef(null);
  const dragRef = React.useRef(null), busyRef = React.useRef(false), rootRef = React.useRef(null);
  const result = versions[resultIndex];
  const reviewing = Boolean(result);
  const marks = draft ? [...history.marks, draft] : history.marks;
  const boxes = history.marks.filter(mark => mark.layer === "boxes");
  const hasDrawing = history.marks.some((mark) => mark.layer === "drawing" && mark.tool !== "eraser");
  const hasSelection = history.marks.some((mark) => mark.layer === "selection" && mark.tool !== "eraser");
  const dirty = history.marks.length || prompt.trim();
  const providerAvailable = provider === "fal" || provider === "atlas";
  const providerLabel = provider === "atlas" ? "Atlas Cloud" : provider === "fal" ? "Fal" : provider === "krea" ? "Krea" : "Unavailable";
  const resultProvider = result?.provider || result?.cost?.provider;

  React.useEffect(() => { rootRef.current?.focus(); }, []);
  React.useEffect(() => {
    const qualities = isIdeogram45Model(model) ? ideogram45QualityOptions : ["high", "xhigh", "max"];
    setQuality(current => qualities.includes(current) ? current : "high");
    setResolution(current => resolutionOptions.includes(current) ? current : "2K");
  }, [model]);
  async function changeModel(value) {
    if (busyRef.current || saving || modelSavePending.current) return;
    modelSavePending.current = true; setModelSaving(true); setError("");
    try { await saveImageEditorModel(value); }
    catch (failure) { if (mounted.current) setError(failure.message || "Could not save the image editor model."); }
    finally { modelSavePending.current = false; if (mounted.current) setModelSaving(false); }
  }
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => {
    const revision = ++scanRevision.current;
    objectCache.current.clear(); setObjectMasks([]); setHoverObject(null); setObjectStatus(""); setInheritedScan(false);
    let cancelled = false;
    nodeApi.imageObjectCache({ sourceUrl: base.url }).then(data => {
      if (cancelled || !mounted.current || revision !== scanRevision.current) return;
      const entries = data.entries || [];
      for (const entry of entries) objectCache.current.set(entry.key, entry.data);
      const auto = entries.filter(entry => entry.options.sam2).at(-1);
      if (entries.length) {
        const active = auto ? entries.slice(entries.indexOf(auto)) : entries;
        const masks = [...new Map(active.flatMap(entry => entry.data.masks).map(mask => [mask.id, mask])).values()].slice(-256);
        if (auto) setSam2Settings(auto.options.sam2);
        setObjectMasks(masks);
        setInheritedScan(active.some(entry => entry.data.inherited));
        setObjectStatus(`${masks.length} objects ready. Saved scan restored; hover to preview, click to select.`);
      }
    }).catch(() => {
      if (!cancelled && revision === scanRevision.current) setWarning("Could not restore the saved object scan. Object Selection can try again; no segmentation was submitted.");
    });
    return () => { cancelled = true; };
  }, [base.url]);
  React.useLayoutEffect(() => {
    const canvas = hoverRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (hoverObject && tool === "object" && !busy && !blank) {
      ctx.fillStyle = "#f2db51"; drawObjectMask(ctx, hoverObject, canvas.width, canvas.height);
    }
  }, [hoverObject, tool, busy, blank, size, reviewing]);
  React.useEffect(() => {
    const stage = stageRef.current;
    const observer = new ResizeObserver(() => setViewport({ width: stage.clientWidth, height: stage.clientHeight }));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  React.useEffect(() => {
    const stage = stageRef.current;
    const wheel = (event) => {
      event.preventDefault(); event.stopPropagation();
      if (event.ctrlKey || event.metaKey) setZoom((value) => Math.max(0.5, Math.min(5, value * Math.exp(-event.deltaY * 0.008))));
      else setPan((value) => ({ x: value.x - event.deltaX, y: value.y - event.deltaY }));
    };
    stage.addEventListener("wheel", wheel, { passive: false });
    return () => stage.removeEventListener("wheel", wheel);
  }, []);
  React.useEffect(() => {
    if (!busy) return;
    const start = Date.now(); setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  React.useLayoutEffect(() => {
    if (!size || reviewing) return;
    for (const [ref, targetLayer] of [[drawingRef, "drawing"], [selectionRef, "selection"]]) {
      const canvas = ref.current;
      if (!canvas) continue;
      drawImageEditMarks(canvas.getContext("2d"), marks, canvas.width, canvas.height, targetLayer);
    }
  }, [marks, size, reviewing]);

  function commit(nextMarks) {
    setHistory((current) => ({ past: [...current.past.slice(-59), current.marks], marks: nextMarks, future: [] }));
  }
  function commitBox(box) {
    const previous = boxes.find(entry => entry.id === box.id);
    if (previous && !box.selectionDerived && previous.label !== box.label && previous.sourceMask === box.sourceMask) box = { ...box, sourceMask: undefined };
    commit(history.marks.some(mark => mark.id === box.id) ? history.marks.map(mark => mark.id === box.id ? box : mark) : [...history.marks, box]);
    setSelectedBoxId(box.id);
  }
  function activateBoxes() {
    if (busyRef.current || !size) return;
    setError(""); setTool("boxes"); setLayer("boxes"); setMode("edit"); setBlank(false);
    if (!hasSelection || blank) return;
    if (boxes.length >= 8) { setError("Use up to 8 boxes. Delete one before converting this selection."); return; }
    try {
      const canvas = document.createElement("canvas"), scale = Math.min(1, 1024 / Math.max(size.width, size.height));
      canvas.width = Math.round(size.width * scale); canvas.height = Math.round(size.height * scale);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      drawImageEditMarks(context, history.marks, canvas.width, canvas.height, "selection");
      const box = boxFromSelectionPixels({ data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height, id: crypto.randomUUID(), label: selectionName.current || `Object ${boxes.length + 1}` });
      commit([...history.marks.filter(mark => mark.layer !== "selection"), box]); setSelectedBoxId(box.id);
    } catch (failure) { setError(failure.message); }
  }
  async function uploadBoxReference(box, file) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setBusyLabel("Uploading reference"); setError("");
    try {
      const form = new FormData(); appendWorkflowContextFormFields(form, workflowContext);
      form.append("nodeType", "image"); form.append("asset", file);
      const { response, data } = await nodeApi.uploadAsset(form);
      if (!response.ok || !data.asset?.localUrl) throw new Error(data.error || "Reference upload failed.");
      if (mounted.current) commit(history.marks.map(mark => mark.layer === "boxes" && (mark.id === box.id || mark.mode === "reference") ? { ...mark, referenceUrl: data.asset.localUrl } : mark));
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function identifyBoxObject(box, sourceBase = base) {
    if (!falAvailable) throw new Error("Enable a Fal key to identify box objects with SAM 3, or use an existing Object Selection.");
    setBusyLabel(`Identifying ${box.label} with SAM 3`);
    const form = new FormData(); appendWorkflowContextFormFields(form, workflowContext);
    const query = box.label.trim() && !/^Object(?: \d+)?$/i.test(box.label.trim()) ? { prompt: box.label.trim() } : { point: { x: box.source.x, y: box.source.y } };
    const data = await nodeApi.imageObjects({ ...Object.fromEntries(form), sourceUrl: sourceBase.url, requestId: crypto.randomUUID(), nodeId: item.editContext?.nodeId || "", nodeTitle: item.label || "Image Edit", ...query });
    const sourceMask = objectMaskForBox(data.masks || [], box);
    if (!sourceMask) throw new Error(`No object matched "${box.label}" inside its box. Refine the description or use Object Selection, then try again.`);
    if (mounted.current) setWarning(data.warning || "");
    return { ...box, selectionDerived: false, sourceMask };
  }
  async function selectBoxObject(box) {
    if (busyRef.current || !size) return;
    busyRef.current = true; setBusy(true); setBusyLabel("Selecting box object with SAM 3"); setError("");
    try {
      const selected = await identifyBoxObject(box);
      if (mounted.current) commitBox(selected);
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  function undo() {
    if (busyRef.current || dragRef.current || boxGesture.current) return;
    setHistory((s) => !s.past.length ? s : ({ past: s.past.slice(0, -1), marks: s.past.at(-1), future: [s.marks, ...s.future] }));
  }
  function redo() {
    if (busyRef.current || dragRef.current || boxGesture.current) return;
    setHistory((s) => !s.future.length ? s : ({ past: [...s.past, s.marks], marks: s.future[0], future: s.future.slice(1) }));
  }
  function close() { if (!busyRef.current && !saving) dirty ? setConfirmClose(true) : onClose(); }
  function keyboard(event) {
    if (event.target.closest(".ies-box-name-input") || (event.target.closest(".ies-compare-handle") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))) return;
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key === "Tab") {
      const container = confirmClose ? rootRef.current.querySelector(".ies-confirm") : rootRef.current;
      const controls = [...container.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [role="slider"][tabindex="0"]')].filter((element) => element.offsetParent && !element.matches(":disabled"));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
    if (event.target.closest("input, textarea, select")) return;
    if ((event.metaKey || event.ctrlKey) && ["z", "y"].includes(event.key.toLowerCase())) {
      event.preventDefault(); event.shiftKey || event.key.toLowerCase() === "y" ? redo() : undo();
    }
  }
  function point(event) { return imageEditPoint(event.clientX, event.clientY, surfaceRef.current.getBoundingClientRect()); }
  async function findObjects(options = {}, modifiers = {}, rescan = false) {
    if (busyRef.current || !size || reviewing || blank) return;
    setTool("object"); setLayer("selection"); setHoverObject(null);
    ++scanRevision.current;
    const kind = options.prompt ? "prompt" : options.point ? "point" : "auto";
    if (kind === "auto") options = { ...options, sam2: sam2Settings };
    const key = JSON.stringify(options);
    const apply = (data) => {
      const masks = data.masks || [];
      setInheritedScan(current => kind === "auto" ? Boolean(data.inherited) : current || Boolean(data.inherited));
      setObjectMasks(current => kind === "auto" ? masks : [...current.filter(mask => !masks.some(next => next.id === mask.id)), ...masks].slice(-256));
      if (kind === "point") {
        const mask = objectAtPoint(masks, options.point);
        if (mask) commit(selectObjectMarks(history.marks, mask, modifiers));
        setObjectStatus(mask ? "Object selected. Shift adds; Alt subtracts." : "No object found here. Try selecting by prompt or use the selection brush.");
      } else if (kind === "prompt") {
        if (masks.length) selectionName.current = options.prompt;
        if (masks.length) commit([...history.marks.filter(mark => mark.layer !== "selection"), ...masks.map(mask => ({ tool: "object", layer: "selection", mask }))]);
        setObjectStatus(masks.length ? `Selected ${masks.length} matching regions. Refine with Shift/Alt or the brush.` : "No matching objects found. Try a different description; your selection is unchanged.");
      } else setObjectStatus(masks.length ? `${masks.length} objects ready. Hover to preview; click to select.` : "No automatic objects found. Click an object to try SAM 3, or select by prompt.");
      if (data.warning) setWarning(data.warning);
    };
    if (!rescan && objectCache.current.has(key)) { apply(objectCache.current.get(key)); return; }
    busyRef.current = true; setBusy(true); setBusyLabel(kind === "auto" ? "Finding objects with SAM 2" : "Selecting with SAM 3"); setError(""); setWarning("");
    try {
      const form = new FormData(); appendWorkflowContextFormFields(form, workflowContext);
      const data = await nodeApi.imageObjects({ ...Object.fromEntries(form), sourceUrl: base.url, requestId: globalThis.crypto.randomUUID(), nodeId: item.editContext?.nodeId || "", nodeTitle: item.label || "Image Edit", ...options, rescan });
      if (!mounted.current) return;
      if (objectCache.current.size >= 12) objectCache.current.delete(objectCache.current.keys().next().value);
      objectCache.current.set(key, data); apply(data);
    } catch (failure) { if (mounted.current) setError(failure.message || "Object Selection failed."); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  function pointerDown(event) {
    if (tool === "boxes" && !reviewing) return;
    if (event.button !== 0 || busyRef.current || !size || dragRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const start = point(event);
    if (!reviewing && tool === "object" && !blank) {
      selectionName.current = "";
      const mask = objectAtPoint(objectMasks, start);
      if (mask) commit(selectObjectMarks(history.marks, mask, event));
      else void findObjects({ point: start }, { shiftKey: event.shiftKey, altKey: event.altKey });
      return;
    }
    if (!reviewing && tool === "text" && !note.trim()) { setError("Enter a text note first, then place it on the image."); return; }
    if (!reviewing && layer === "selection" && tool !== "hand") selectionName.current = "";
    event.currentTarget.setPointerCapture(event.pointerId);
    const mark = { tool: reviewing ? "hand" : tool, layer, color, opacity: opacity / 100, size: brushSize / 100, points: [start], text: note.slice(0, 500) };
    dragRef.current = { pointerId: event.pointerId, mark, clientX: event.clientX, clientY: event.clientY, pan };
    if (mark.tool !== "hand") setDraft(mark);
    setError("");
  }
  function pointerMove(event) {
    if (size) {
      const p = point(event); setCursor(p);
      if (tool === "object" && !busy && !reviewing && !blank) setHoverObject(objectAtPoint(objectMasks, p));
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (drag.mark.tool === "hand") { setPan({ x: drag.pan.x + event.clientX - drag.clientX, y: drag.pan.y + event.clientY - drag.clientY }); return; }
    const p = point(event);
    if (["pen", "eraser"].includes(drag.mark.tool)) {
      const last = drag.mark.points.at(-1);
      if (Math.hypot(last.x - p.x, last.y - p.y) < 0.0005 || drag.mark.points.length >= 12000) return;
      drag.mark = { ...drag.mark, points: [...drag.mark.points, p] };
    } else drag.mark = { ...drag.mark, points: [drag.mark.points[0], p] };
    setDraft(drag.mark);
  }
  function pointerUp(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.mark.tool !== "hand" && event.type !== "pointercancel") commit([...history.marks, drag.mark]);
    dragRef.current = null; setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  async function renderLayer(targetLayer, layerMarks = history.marks, layerSize = size) {
    const canvas = document.createElement("canvas"); canvas.width = layerSize.width; canvas.height = layerSize.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    drawImageEditMarks(ctx, layerMarks, layerSize.width, layerSize.height, targetLayer);
    return imageEditHasPixels(ctx, layerSize.width, layerSize.height) ? blobOf(canvas) : null;
  }
  async function generate(retryDraft) {
    const edit = retryDraft || { base, size, marks: history.marks, prompt, mode, blank, quality, resolution, selectedBoxId };
    const { base: editBase, size: editSize, marks: editMarks, prompt: editPrompt, mode: editMode, blank: editBlank } = edit;
    const editBoxesDraft = editMarks.filter(mark => mark.layer === "boxes");
    const qualities = isIdeogram45Model(model) ? ideogram45QualityOptions : ["high", "xhigh", "max"];
    const editQuality = qualities.includes(edit.quality) ? edit.quality : "high";
    const editResolution = resolutionOptions.includes(edit.resolution) ? edit.resolution : "2K";
    if (busyRef.current || modelSavePending.current) return;
    if (!editSize) { setError("Wait for the original image to load before generating."); return; }
    if (!providerAvailable) { setError("Enable an image-edit provider in Settings before generating."); return; }
    // Pointer capture can be lost when focus leaves the canvas. It must never
    // silently block an explicit Generate click using the committed boxes.
    boxGesture.current = false;
    busyRef.current = true; setBusy(true); setBusyLabel("Generating edit"); setError(""); setWarning("");
    try {
      imageEditSize(editSize.width, editSize.height, model);
      validateEditBoxes(editBoxesDraft);
      let resolvedBoxes = editBoxesDraft;
      for (const box of editBoxesDraft.filter(box => boxNeedsIdentification(box, model) && !box.sourceMask)) {
        const selected = await identifyBoxObject(box, editBase);
        if (!mounted.current) return;
        resolvedBoxes = resolvedBoxes.map(entry => entry.id === box.id ? selected : entry);
        // Save each successful selection before another paid step so retries reuse it.
        const byId = new Map(resolvedBoxes.map(entry => [entry.id, entry]));
        if (retryDraft) retryDraft.marks = editMarks.map(mark => byId.get(mark.id) || mark);
        else commit(editMarks.map(mark => byId.get(mark.id) || mark));
      }
      setBusyLabel("Generating edit");
      const editBoxes = validateEditBoxes(resolvedBoxes);
      const drawing = await renderLayer("drawing", editMarks, editSize), selection = editBlank ? null : await renderLayer("selection", editMarks, editSize);
      if (editMode === "remove" && !selection) throw new Error("Paint a selection over the area to remove.");
      if (editBlank && !drawing) throw new Error("Draw a sketch first.");
      const form = new FormData();
      appendWorkflowContextFormFields(form, workflowContext);
      form.append("boxes", JSON.stringify(editBoxes));
      const objects = Object.fromEntries(resolvedBoxes.filter(box => boxNeedsObject(box) && box.sourceMask).map(box => [box.id, box.sourceMask]));
      if (Object.keys(objects).length) form.append("boxObjects", new Blob([JSON.stringify(objects)], { type: "application/json" }), "box-objects.json");
      for (const [key, value] of Object.entries({ sourceUrl: editBase.url, requestId: globalThis.crypto.randomUUID(), prompt: editPrompt, mode: editMode, quality: editQuality, resolution: editResolution, model, blank: String(editBlank), provider, nodeId: item.editContext?.nodeId || "", nodeTitle: item.label || "Image Edit" })) form.append(key, value);
      if (drawing) form.append("drawing", drawing, "drawing.png");
      if (selection) form.append("selection", selection, "selection.png");
      const data = await nodeApi.editImage(form);
      if (!data.item?.url) throw new Error("The edit returned no image. Check History before running again.");
      let scanWarning = "";
      if (!editBlank && (retryDraft || objectCache.current.size)) {
        try {
          const linked = await nodeApi.imageObjectCache({ sourceUrl: editBase.url, targetUrl: data.item.url });
          scanWarning = linked.warning || "";
        } catch { scanWarning = "The edit completed, but its object scan could not be carried forward. The earlier image's scan is still saved."; }
      }
      const resolvedById = new Map(resolvedBoxes.map(box => [box.id, box]));
      versionDrafts.current.push({ ...edit, quality: editQuality, resolution: editResolution, marks: editMarks.map(mark => resolvedById.get(mark.id) || mark) });
      setVersions((old) => [...old, { ...data.item, modelName: model, before: editBase.url }]);
      setResultIndex(versions.length); setView("split"); setSplit(50); setWarning([data.warning, scanWarning].filter(Boolean).join(" "));
    } catch (failure) { setError(failure.message || "Image edit failed."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function accept(action) {
    if (busyRef.current || !result) return;
    busyRef.current = true; setSaving(true); setError("");
    try { await onAccept(item, result, action); onClose(); }
    catch (failure) { setError(failure.message || "Could not apply the edit."); }
    finally { busyRef.current = false; setSaving(false); }
  }
  function adjustBoxes() {
    const saved = versionDrafts.current[resultIndex];
    if (!saved || busyRef.current || saving) return;
    setBase(saved.base); setSize(saved.size); setHistory({ past: [], marks: saved.marks, future: [] });
    setPrompt(saved.prompt); setMode(saved.mode); setBlank(saved.blank);
    const qualities = isIdeogram45Model(model) ? ideogram45QualityOptions : ["high", "xhigh", "max"];
    setQuality(qualities.includes(saved.quality) ? saved.quality : "high");
    setResolution(resolutionOptions.includes(saved.resolution) ? saved.resolution : "2K");
    setSelectedBoxId(saved.selectedBoxId || saved.marks.find(mark => mark.layer === "boxes")?.id || "");
    setTool("boxes"); setLayer("boxes"); setResultIndex(-1); setError(""); setWarning(""); setZoom(1); setPan({ x: 0, y: 0 });
  }
  function continueEditing() {
    setBase(result); setResultIndex(-1); setHistory(emptyHistory); setPrompt(""); setBlank(false); setMode("edit"); setError(""); setZoom(1); setPan({ x: 0, y: 0 });
  }
  const scale = size ? Math.min(1, (viewport.width - 40) / size.width, (viewport.height - 40) / size.height) : 1;
  const displaySize = size ? { width: size.width * scale, height: size.height * scale } : { width: 300, height: 300 };
  const previewScale = size ? Math.min(1, 1600 / Math.max(size.width, size.height)) : 1;
  const setActiveLayer = (value) => { setLayer(value); if (tool === "boxes" || (value === "selection" && ["text", "arrow"].includes(tool)) || (value === "drawing" && tool === "object")) setTool("pen"); };

  return <section ref={rootRef} tabIndex={-1} className="image-edit-studio" aria-label="Image Edit" role="dialog" aria-modal="true" onKeyDownCapture={keyboard} onPointerDown={(event) => event.stopPropagation()}>
    <header className="ies-header"><span><Pencil size={18} /><strong>Image Edit</strong><small>{item.label || item.fileName || "Image"}</small></span><div className="ies-header-actions"><label className="ies-model-select" title="Shared with User Preferences"><span>Edit model</span><select aria-label="Image Editor Model" value={model} disabled={busy || saving || modelSaving} onChange={event => changeModel(event.target.value)}>{imageEditModelOptions.map(option => <option key={option}>{option}</option>)}</select></label>{modelSaving && <span role="status" className="ies-model-saving">Saving…</span>}<IconButton icon={X} label="Close image editor" onClick={close} disabled={busy || saving || modelSaving} /></div></header>
    <div className="ies-workspace">
      <div className="ies-main">
        <div className="ies-toolbar" role="toolbar" aria-label="Drawing tools">
          <div className="ies-segment" role="group" aria-label="Editing layer"><IconButton icon={Pencil} label="Drawing layer" active={layer === "drawing"} disabled={busy || reviewing} onClick={() => setActiveLayer("drawing")} /><IconButton icon={Scan} label="Selection layer" active={layer === "selection"} disabled={busy || reviewing || blank} onClick={() => setActiveLayer("selection")} /></div>
          {tools.map(([id, Icon, label]) => <IconButton key={id} icon={Icon} label={label} active={reviewing ? id === "hand" : tool === id} disabled={busy || (reviewing && id !== "hand") || (layer === "selection" && ["text", "arrow"].includes(id))} onClick={() => { setTool(id); if (layer === "boxes" && id !== "hand") setLayer("drawing"); }} />)}
          <IconButton icon={ScanSearch} label="Object Selection" active={tool === "object" && !reviewing} disabled={busy || reviewing || blank || !size} onClick={() => findObjects()} />
          <IconButton icon={Boxes} label="Boxes" active={tool === "boxes" && !reviewing} disabled={busy || reviewing || !size} onClick={activateBoxes} />
          <div className="ies-divider" />
          <IconButton icon={Undo2} label="Undo stroke" onClick={undo} disabled={busy || reviewing || !history.past.length} /><IconButton icon={Redo2} label="Redo stroke" onClick={redo} disabled={busy || reviewing || !history.future.length} />
          <IconButton icon={Trash2} label="Clear active layer" onClick={() => commit(history.marks.filter((mark) => mark.layer !== layer))} disabled={busy || reviewing || !history.marks.some((mark) => mark.layer === layer)} />
        </div>
        <div className="ies-stage" ref={stageRef}>
          <div ref={surfaceRef} className={`ies-surface ${tool === "hand" || reviewing ? "panning" : ""}`} style={{ ...displaySize, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerLeave={() => { setCursor(null); setHoverObject(null); }} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp}>
            <img src={reviewing ? result.before : base.url} alt="Original image" draggable={false} style={{ visibility: blank && !reviewing ? "hidden" : "visible" }} onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setError("Could not load the original full-resolution image.")} />
            {!reviewing && size && <><canvas ref={drawingRef} aria-label="Drawing canvas" width={Math.round(size.width * previewScale)} height={Math.round(size.height * previewScale)} /><canvas ref={selectionRef} aria-label="Selection canvas" className="ies-selection" width={Math.round(size.width * previewScale)} height={Math.round(size.height * previewScale)} /></>}
            {!reviewing && size && <canvas ref={hoverRef} aria-label="Object hover preview" className="ies-object-hover" width={Math.round(size.width * previewScale)} height={Math.round(size.height * previewScale)} />}
            {!reviewing && size && !blank && tool === "boxes" && <ImageEditBoxPreview box={boxes.find(box => box.id === selectedBoxId && boxNeedsObject(box))} size={size} sourceUrl={base.url} />}
            {!reviewing && size && !blank && (boxes.length > 0 || tool === "boxes") && <ImageEditBoxesOverlay boxes={boxes} size={size} active={tool === "boxes"} disabled={busy || saving} selectedId={selectedBoxId} onSelect={setSelectedBoxId} onCommit={commitBox} onGesture={active => { boxGesture.current = active; }} />}
            {reviewing && view !== "original" && <img className="ies-result" src={result.url} alt="Edited result" draggable={false} style={{ clipPath: view === "split" ? `inset(0 0 0 ${split}%)` : undefined }} />}
            {reviewing && view === "split" && <CompareHandle split={split} setSplit={setSplit} surfaceRef={surfaceRef} />}
            {cursor && !reviewing && !busy && ["pen", "eraser"].includes(tool) && <div className="ies-brush-cursor" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, width: Math.max(3, brushSize / 100 * Math.min(displaySize.width, displaySize.height)), aspectRatio: "1", borderColor: tool === "eraser" ? "#fff" : layer === "selection" ? "#72efd8" : color }} />}
          </div>
          {busy && <div className="ies-progress" role="status"><LoaderCircle size={22} className="ies-spinning" /><span>{busyLabel}</span><time>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</time></div>}
          {!size && !error && <div className="ies-progress" role="status"><LoaderCircle className="ies-spinning" size={22} />Loading image</div>}
          {error && <div className="ies-stage-error" role="alert">{error}</div>}
        </div>
        <div className="ies-viewbar">
          <span>{size ? `${size.width} x ${size.height}` : ""}</span>
          {reviewing && <div className="ies-review-controls"><div className="ies-segment">{["original", "split", "result"].map((value) => <button type="button" key={value} className={view === value ? "active" : ""} onClick={() => setView(value)}>{value === "split" ? "Compare" : value === "result" ? "Edit" : "Original"}</button>)}</div>{view === "split" && <input aria-label="Comparison split" type="range" min="0" max="100" value={split} onChange={(e) => setSplit(Number(e.target.value))} />}</div>}
          <div className="ies-zoom"><IconButton icon={Minus} label="Zoom out" onClick={() => setZoom((v) => Math.max(0.5, v - 0.25))} /><output>{Math.round(zoom * 100)}%</output><IconButton icon={Plus} label="Zoom in" onClick={() => setZoom((v) => Math.min(5, v + 0.25))} /><IconButton icon={Maximize} label="Fit image" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} /></div>
        </div>
      </div>
      <aside className="ies-sidebar">
        {!reviewing && <fieldset disabled={busy || saving}>
          {tool === "boxes" && <ImageEditBoxesPanel boxes={boxes} selectedId={selectedBoxId} onSelect={setSelectedBoxId} onCommit={commitBox} onDelete={id => commit(history.marks.filter(mark => mark.id !== id))} onUploadReference={uploadBoxReference} onSelectObject={selectBoxObject} model={model} busy={busy} />}
          {tool !== "boxes" && <div className="ies-object-controls">
            {tool === "object" && <div className="ies-sam2-controls" role="group" aria-label="SAM 2 settings">
              <strong>SAM 2 detection</strong>
              {[["pointsPerSide", "Sampling density", 8, 64, 8, "Higher finds more small objects; takes longer."], ["confidence", "Confidence threshold", 0, 1, 0.01, "Lower keeps more candidates, including uncertain ones."], ["stability", "Stability threshold", 0, 1, 0.01, "Lower accepts less consistent boundaries."], ["minRegionArea", "Minimum region area", 0, 10000, 1, "Lower keeps smaller regions; measured in analysis pixels."]].map(([key, label, min, max, step, hint]) => <label className="ies-slider" key={key}>{label}<output>{key === "pointsPerSide" ? `${sam2Settings[key]} × ${sam2Settings[key]}` : key === "minRegionArea" ? `${sam2Settings[key]} px` : sam2Settings[key].toFixed(2)}</output><input type="range" aria-label={label} min={min} max={max} step={step} value={sam2Settings[key]} onChange={event => setSam2Settings(current => ({ ...current, [key]: Number(event.target.value) }))} /><small>{hint}</small></label>)}
              <button type="button" disabled={!size || blank || !falAvailable} onClick={() => findObjects({}, {}, true)}>Rescan objects</button>
              <button type="button" onClick={() => setSam2Settings(sam2Defaults)}>Reset detection settings</button>
              <small>Apply changes with Rescan (a new Fal request). Your current selection is kept.</small>
            </div>}
            <label>Select by prompt<textarea aria-label="Object selection prompt" rows={2} maxLength={300} placeholder="The jacket, all people…" value={selectionPrompt} onChange={e => setSelectionPrompt(e.target.value)} /></label>
            <button type="button" disabled={!size || blank || !selectionPrompt.trim()} onClick={() => findObjects({ prompt: selectionPrompt.trim() })}>Select</button>
            <small>Fal · SAM 2 finds objects; SAM 3 selects by prompt or a click on an unhighlighted area. Hovering cached objects makes no API calls.</small>
            {tool === "object" && <small>Click selects · Shift adds · Alt subtracts</small>}
            {objectStatus && <p role="status">{objectStatus}</p>}
            {inheritedScan && <p role="status">Using scan from before this edit. Boundaries may have changed; Rescan objects updates them.</p>}
          </div>}
          <label>Method<select aria-label="Edit method" disabled={boxes.length > 0} value={mode} onChange={(e) => { setMode(e.target.value); if (e.target.value !== "sketch") setBlank(false); if (e.target.value === "remove") { setActiveLayer("selection"); setTool("pen"); } }}><option value="edit">Edit image</option><option value="sketch">Render sketch</option><option value="remove">Remove selected</option></select></label>
          {mode === "sketch" && <label className="ies-checkbox"><input type="checkbox" checked={blank} onChange={(e) => { setBlank(e.target.checked); if (e.target.checked) setActiveLayer("drawing"); }} />Blank canvas</label>}
          {tool !== "boxes" && <><div className="ies-color-row" aria-label="Drawing color">{imageEditColors.map((value) => <button type="button" key={value} aria-label={`Color ${value}`} title={value} aria-pressed={color === value} className={`ies-swatch ${color === value ? "active" : ""}`} style={{ background: value }} onClick={() => setColor(value)} disabled={layer === "selection"} />)}<input aria-label="Custom drawing color" type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={layer === "selection"} /></div>
          <label className="ies-slider">{tool === "text" ? "Text size" : "Brush size"}<output>{brushSize.toFixed(1)}</output><input aria-label="Brush size" type="range" min="0.2" max="12" step="0.2" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} /></label>
          <label className="ies-slider">Opacity<output>{opacity}%</output><input aria-label="Drawing opacity" type="range" min="10" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} disabled={layer === "selection"} /></label>
          {tool === "text" && <label>Text note<textarea aria-label="Text note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>}
          </>}
          <label>Prompt<textarea className="ies-prompt" aria-label="Edit prompt" rows={5} maxLength={16000} placeholder={mode === "remove" ? "Additional direction (optional)" : "Describe the change..."} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
          {imageEditUsesSelectionGuide(model) ? <label>Resolution<select aria-label="Edit resolution" value={resolution} onChange={e => setResolution(e.target.value)}>{resolutionOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label> : <label>Quality<select aria-label="Edit quality" value={quality} onChange={(e) => setQuality(e.target.value)}>{(isIdeogram45Model(model) ? ideogram45QualityOptions : ["high", "xhigh", "max"]).map((value) => <option key={value} value={value}>{({ low: "Low", medium: "Medium", high: "High", xhigh: "Extra High", max: "Maximum" })[value]}</option>)}</select></label>}
        </fieldset>}
        <div className="ies-run-section">
          <small>{reviewing ? result.modelName || model : isIdeogram45Model(model) ? "Ideogram 4.5 Precise Edit" : model} <span>{resultProvider === "fal.ai" ? "Fal" : resultProvider || providerLabel}</span></small>
          {!reviewing && <button className="ies-primary" type="button" onClick={() => generate()} disabled={busy || modelSaving || !size || !providerAvailable || (mode === "remove" ? !hasSelection : !prompt.trim() && !boxes.some(box => box.mode !== "keep") && !(mode === "sketch" && hasDrawing))}><Brush size={17} />{busy ? "Generating..." : "Generate Edit"}</button>}
          {!reviewing && showApiCosts && <small className="ies-cost">Variable API cost</small>}
          {!providerAvailable && <p role="status" className="ies-warning">{imageEditRequiresFal(model) ? `Enable a Fal key in Settings to use ${model}.` : "Enable Fal or Atlas Cloud in Settings to edit images."}</p>}
        </div>
        {versions.length > 0 && <label>Versions<select aria-label="Edit version" value={resultIndex} disabled={busy || saving} onChange={(e) => { setResultIndex(Number(e.target.value)); setView("split"); }}><option value="-1">Current draft</option>{versions.map((version, i) => <option key={version.url} value={i}>Edit {i + 1}</option>)}</select></label>}
        {reviewing && <div className="ies-result-actions">
          {versionDrafts.current[resultIndex]?.marks.some(mark => mark.layer === "boxes") && <>
            <button type="button" disabled={busy || saving || modelSaving || !providerAvailable} onClick={() => generate(versionDrafts.current[resultIndex])}><RefreshCcw size={17} />Rerun Box Edit</button>
            <button type="button" disabled={busy || saving} onClick={adjustBoxes}><Boxes size={17} />Adjust Boxes</button>
            <small>Rerun starts a new generation from the original source and saved boxes, using the model selected above.</small>
          </>}
          <button className="ies-primary" type="button" disabled={busy || saving} onClick={() => accept("copy")}><Plus size={17} />Add Image to Canvas</button>
          {canApply && <button type="button" disabled={busy || saving} onClick={() => accept("apply")}><Check size={17} />Apply to Source</button>}
          <button type="button" disabled={busy || saving} onClick={continueEditing}><Pencil size={17} />Continue Editing</button>
          <a href={result.url} download={result.fileName}><Download size={17} />Download</a>
        </div>}
        {warning && <p className="ies-warning" role="status">{warning}</p>}
      </aside>
    </div>
    {confirmClose && <div className="ies-confirm"><div role="alertdialog" aria-label="Discard edit draft"><h3>Discard this draft?</h3><p>Generated edits are kept in History. Unsaved drawing marks will be discarded.</p><div><button onClick={() => setConfirmClose(false)}>Keep Editing</button><button className="ies-primary" onClick={onClose}>Discard Draft</button></div></div></div>}
  </section>;
}
