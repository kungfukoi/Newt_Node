import { isFlux3Model, flux3ResolutionOptions } from "../flux3.js";
import { nanoBanana21ResolutionOptions } from "../nanoBanana21.js";
import { imageEditRequiresFal, imageEditUsesSelectionGuide, isSeedream55Edit } from "../imageEdit.js";
import { prepareSeedreamLabelTranslator, seedream55AspectRatios, seedream55Backgrounds, seedream55Formats, seedream55Sizes, translateSeedreamLabels } from "../seedream55Editor.js";
import React from "react";
import { Boxes } from "lucide-react";
import { validateEditBoxes } from "../imageEditBoxes.js";
import { exportBoxSelections } from "../imageEditBoxExport.js";
import { useImageEditBoxNames } from "../useImageEditBoxNames.js";
import { imageEditDownload, downloadImageEdit } from "../imageEditSave.js";
import { boxNeedsObject, boxNeedsIdentification, objectMaskForBox, boxFromSelectionPixels } from "../imageEditBoxModels.js";
import { ImageEditBoxesOverlay, ImageEditBoxesPanel, ImageEditBoxPreview } from "./ImageEditBoxes.jsx";
import { LayerStackControls, LayerStackPreview, compositionSize, consolidateLayerStacks, cropLayerSelection, downloadLayerPsd, extractLayerSelection, initializeLayerStack, isLayerVisible, layerCompositeBlob, layerEditSource, mergeLayerSeparation, pasteLayerSelection, renderLayerStack, uploadLayerComposite } from "./SeedreamLayerEditor.jsx";
import { imageLayerDraftKey, readImageLayerDraft, saveImageLayerDraft, updateImageLayerDraft, writeImageLayerDraft } from "../imageLayerDrafts.js";
import { drawObjectMask, objectAtPoint, selectObjectMarks, sam2Defaults } from "../objectSelection.js";
import { ArrowUpRight, Brush, Check, Circle, Download, Eraser, Hand, Layers, LoaderCircle, Maximize, Minus, Pencil, Plus, Redo2, RefreshCcw, Save, Scan, ScanSearch, Square, Trash2, Type, Undo2, X } from "lucide-react";
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

function CompareHandle({ split, setSplit }) {
  const update = event => {
    setSplit(imageEditPoint(event.clientX, event.clientY, event.currentTarget.parentElement.getBoundingClientRect()).x * 100);
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

export function ImageEditStudio({ item, workflowContext, falAvailable, kreaAvailable, atlasAvailable, provider: defaultProvider = falAvailable ? "fal" : "", model: selectedModel, canApply, onAccept, onClose, showApiCosts = false }) {
  const model = normalizeImageEditModel(selectedModel);
  const seedream = isSeedream55Edit(model);
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
  const layerMode = seedream && mode === "layers";
  const provider = layerMode ? (atlasAvailable ? "atlas" : "") : imageEditRequiresFal(model) ? (falAvailable ? "fal" : "") : seedream ? (kreaAvailable ? "krea" : "") : defaultProvider;
  const resolutionOptions = seedream ? seedream55Sizes : isFlux3Model(model) ? flux3ResolutionOptions : nanoBanana21ResolutionOptions;
  const [seedreamSettings, setSeedreamSettings] = React.useState({
    background: "auto", aspectRatio: "auto", outputFormat: "png", references: [],
    atlasMaxLayers: 9, atlasLayerResolution: "auto", atlasTextRecognition: false,
  });
  const changeSeedream = patch => setSeedreamSettings(current => ({ ...current, ...patch }));
  const [blank, setBlank] = React.useState(false);
  const [resolution, setResolution] = React.useState("2K");
  const [quality, setQuality] = React.useState("high");
  const [{ zoom, pan }, setCanvasView] = React.useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const fitImage = () => setCanvasView({ zoom: 1, pan: { x: 0, y: 0 } });
  const adjustZoom = (step) => setCanvasView((view) => ({ ...view, zoom: Math.max(0.5, Math.min(5, view.zoom + step)) }));
  const [viewport, setViewport] = React.useState({ width: 700, height: 600 });
  const layerStorageKey = imageLayerDraftKey(workflowContext, item.url);
  const [savedLayerDraft] = React.useState(() => readImageLayerDraft(layerStorageKey));
  const [restoredLayers] = React.useState(() => consolidateLayerStacks(savedLayerDraft));
  const pendingLayerDraft = React.useRef(null);
  const [versions, setVersions] = React.useState(restoredLayers.results);
  const [layerSession, setLayerSession] = React.useState(null);
  const [stackDraft, setStackDraft] = React.useState(null);
  const [moveLayers, setMoveLayers] = React.useState(true);
  const [selectionDestination, setSelectionDestination] = React.useState("");
  const layerTarget = Boolean(layerSession);
  const showComposition = layerTarget && moveLayers;
  const activeLayer = stackDraft?.layers.find(entry => entry.url === stackDraft.selected);
  const sourceDraft = React.useRef(null);
  const layerToolDrafts = React.useRef(new Map());
  const stackHistory = React.useRef(new Map());
  const layerHistory = layerSession && stackHistory.current.get(layerSession.key);
  const restoreStackOnLoad = React.useRef(Boolean(restoredLayers.lastStack));
  const layerDrafts = React.useRef(new Map(restoredLayers.drafts));
  const lastLayerStack = React.useRef(restoredLayers.lastStack);
  const [layerStorageError, setLayerStorageError] = React.useState("");
  const openLayersButton = React.useRef(null);
  const versionDrafts = React.useRef(Array(restoredLayers.results.length));
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
  const [selectionSaved, setSelectionSaved] = React.useState("");
  const [restoringSelections, setRestoringSelections] = React.useState(true);
  const skipSelectionRestore = React.useRef(false);
  const mounted = React.useRef(true);
  const drawingRef = React.useRef(null), selectionRef = React.useRef(null), stageRef = React.useRef(null), surfaceRef = React.useRef(null);
  const dragRef = React.useRef(null), busyRef = React.useRef(false), rootRef = React.useRef(null);
  const result = versions[resultIndex];
  const resultLayerGroup = result?.layerGroup || layerSession?.items[0]?.layerGroup;
  const reviewing = Boolean(result);
  const previewOnly = reviewing || layerMode || showComposition || view !== "result";
  const layerOptions = React.useMemo(() => {
    const groups = new Map();
    let separation = 0;
    versions.forEach((version, index) => {
      const id = version.layerGroup || "edits";
      if (!groups.has(id)) groups.set(id, { id, label: version.layerGroup ? `Separation ${++separation}` : "Image edits", entries: [] });
      groups.get(id).entries.push({ version, index });
    });
    return [...groups.values()];
  }, [versions]);
  const marks = draft ? [...history.marks, draft] : history.marks;
  const boxes = history.marks.filter(mark => mark.layer === "boxes");
  const hasDrawing = history.marks.some((mark) => mark.layer === "drawing" && mark.tool !== "eraser");
  const hasSelection = history.marks.some((mark) => mark.layer === "selection" && mark.tool !== "eraser");
  const selectionBox = tool === "boxes" ? boxes.find(box => box.id === selectedBoxId) : null;
  const layerDestinations = stackDraft?.layers.filter(entry => entry.url !== stackDraft.selected) || [];
  const destination = layerDestinations.find(entry => entry.url === selectionDestination) || layerDestinations[0];
  const providerAvailable = ["fal", "atlas", "krea"].includes(provider);
  const providerLabel = provider === "atlas" ? "Atlas Cloud" : provider === "fal" ? "Fal" : provider === "krea" ? "Krea" : "Unavailable";
  const resultProvider = result?.provider || result?.cost?.provider;
  const namingBoxes = useImageEditBoxNames({ boxes, base, enabled: !blank && !reviewing, workflowContext,
    nodeId: item.editContext?.nodeId || "", nodeTitle: item.label || "Image Edit", onWarning: setWarning,
    onNamed: ({ id, label, expectedLabel, region }) => {
      if (busyRef.current) return;
      setHistory(current => {
        const previous = current.marks.find(mark => mark.id === id && mark.layer === "boxes");
        if (!previous || previous.label !== expectedLabel || JSON.stringify(previous.source) !== JSON.stringify(region)) return current;
        const next = { ...previous, label, ...(!previous.selectionDerived ? { sourceMask: undefined } : {}) };
        return { past: [...current.past.slice(-59), current.marks], marks: current.marks.map(mark => mark.id === id ? next : mark), future: [] };
      });
    }
  });

  async function saveToDisk() {
    if (busyRef.current || saving || !size || namingBoxes.length) return;
    setSaving(true); setError("");
    try {
      if (showComposition) {
        const composition = await renderLayerStack(layerSession, stackDraft);
        downloadImageEdit({ blob: await layerCompositeBlob(composition.canvas), fileName: "seedream-composition.png" });
      } else downloadImageEdit(await imageEditDownload({ base, result, size, marks: history.marks, prompt, blank, lockAlpha: layerTarget }));
    }
    catch (failure) { setError(failure.message || "Could not save the image to disk."); }
    finally { if (mounted.current) setSaving(false); }
  }

  async function saveSelections() {
    return exportBoxes();
  }
  async function applyLayerDrawing() {
    if (busyRef.current || saving || !size || !hasDrawing) return;
    busyRef.current = true; setSaving(true); setError("");
    try {
      const { blob } = await imageEditDownload({ base, size, marks: history.marks.filter(mark => mark.layer === "drawing"), prompt: "", blank, lockAlpha: true });
      const output = await uploadLayerComposite(blob, size, workflowContext);
      applyLayerResult(output);
    } catch (failure) { setError(failure.message || "Could not apply the drawing to the layer."); }
    finally { busyRef.current = false; setSaving(false); }
  }

  function selectionState() {
    return { marks: history.marks.filter(mark => ["selection", "boxes"].includes(mark.layer)), sam2Settings, selectedBoxId, selectionName: selectionName.current,
      editorDraft: { drawingMarks: history.marks.filter(mark => mark.layer === "drawing"), prompt, mode, blank } };
  }

  async function done() {
    if (busyRef.current || saving || restoringSelections || namingBoxes.length) return;
    busyRef.current = true; setSaving(true); setError("");
    try {
      await nodeApi.imageObjectCache({ sourceUrl: base.url, selectionState: selectionState() });
      let output;
      let appliedStack;
      if (layerSession) {
        appliedStack = await finishStackForDone();
        const signature = layerPixelSignature(appliedStack);
        const unchangedSource = !layerSession.items[0].layerGroup && layerSession.items[0].url === item.url &&
          signature === layerPixelSignature(initializeLayerStack(layerSession));
        if (signature !== appliedStack.appliedSignature && !unchangedSource) {
          const composition = await renderLayerStack(layerSession, appliedStack);
          output = await uploadLayerComposite(await layerCompositeBlob(composition.canvas), composition, workflowContext);
          appliedStack = { ...appliedStack, appliedSignature: signature };
        }
      } else if (result) {
        output = result;
      } else if (hasDrawing && size) {
        output = await saveDoneDrawing(captureTools(), false);
      } else if (base.url !== item.url) {
        output = base;
      }
      const applied = output && await onAccept(item, output, canApply ? "apply" : "copy");
      if (appliedStack && output) {
        storeStackDraft({ ...appliedStack, appliedSignature: stackDraft.appliedSignature });
        try {
          saveImageLayerDraft(imageLayerDraftKey(workflowContext, output.url), {
            stackKey: layerSession.key, results: layerSession.items, draft: appliedStack,
          });
        } catch { /* The editable stack remains saved under the original source. */ }
      }
      commitLayerChanges();
      onClose(applied || output);
    } catch (failure) { setError(failure.message || "Could not apply the image edits."); }
    finally { busyRef.current = false; if (mounted.current) setSaving(false); }
  }

  function layerPixelSignature(draft) {
    return JSON.stringify(draft.layers.filter(entry => isLayerVisible(entry, draft.folders) && entry.opacity > 0).map(entry =>
      [entry.replacement?.url || entry.url, entry.x, entry.y, entry.width, entry.height, entry.scale, entry.rotation, entry.opacity]));
  }

  async function saveDoneDrawing(state, lockAlpha) {
    const drawing = state.history.marks.filter(mark => mark.layer === "drawing");
    const { blob } = await imageEditDownload({ base: state.base, size: state.size, marks: drawing, prompt: "", blank: state.blank, lockAlpha });
    const output = await uploadLayerComposite(blob, state.size, workflowContext);
    return { ...output, label: lockAlpha ? output.label : "Image Edit" };
  }

  async function finishStackForDone() {
    const layers = [];
    for (const entry of stackDraft.layers) {
      const state = entry.url === stackDraft.selected ? captureTools()
        : layerToolDrafts.current.get(JSON.stringify([layerSession.key, entry.url]));
      const source = layerEditSource(layerSession, entry);
      let replacement;
      if (state) {
        replacement = versions[state.resultIndex];
        if (!replacement && state.size && state.history.marks.some(mark => mark.layer === "drawing" && mark.tool !== "eraser")) {
          replacement = await saveDoneDrawing(state, true);
        }
        if (!replacement && state.base.url !== source.url) replacement = state.base;
      }
      layers.push(replacement ? { ...entry, replacement: { url: replacement.url, width: replacement.width, height: replacement.height,
        mimeType: replacement.mimeType, fileName: replacement.fileName } } : entry);
    }
    return { ...stackDraft, layers };
  }

  React.useEffect(() => { rootRef.current?.focus(); }, []);
  React.useEffect(() => {
    const qualities = isIdeogram45Model(model) ? ideogram45QualityOptions : ["high", "xhigh", "max"];
    setQuality(current => qualities.includes(current) ? current : "high");
    setResolution(current => resolutionOptions.includes(current) ? current : "2K");
    if (!seedream) setMode(current => current === "layers" ? "edit" : current);
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
    const restoreMarks = !skipSelectionRestore.current;
    skipSelectionRestore.current = false;
    setRestoringSelections(true); setSelectionSaved("");
    objectCache.current.clear(); setObjectMasks([]); setHoverObject(null); setObjectStatus(""); setInheritedScan(false);
    let cancelled = false;
    nodeApi.imageObjectCache({ sourceUrl: base.url }).then(data => {
      if (cancelled || !mounted.current || revision !== scanRevision.current) return;
      const entries = data.entries || [];
      if (data.selectionState && restoreMarks) {
        const saved = data.selectionState;
        setHistory(current => ({ past: [], marks: [...(saved.editorDraft?.drawingMarks || current.marks.filter(mark => mark.layer === "drawing")), ...saved.marks], future: [] }));
        if (saved.editorDraft) { setPrompt(saved.editorDraft.prompt); setMode(saved.editorDraft.mode); setBlank(saved.editorDraft.blank); }
        setSelectedBoxId(saved.selectedBoxId); selectionName.current = saved.selectionName;
        setSam2Settings(saved.sam2Settings);
        setSelectionSaved("Saved selections and boxes restored.");
      }
      for (const entry of entries) objectCache.current.set(entry.key, entry.data);
      const auto = entries.filter(entry => entry.options.sam2).at(-1);
      if (entries.length) {
        const active = auto ? entries.slice(entries.indexOf(auto)) : entries;
        const masks = [...new Map(active.flatMap(entry => entry.data.masks).map(mask => [mask.id, mask])).values()].slice(-256);
        if (auto && !data.selectionState && restoreMarks) setSam2Settings(auto.options.sam2);
        setObjectMasks(masks);
        setInheritedScan(active.some(entry => entry.data.inherited));
        setObjectStatus(`${masks.length} objects ready. Saved scan restored; hover to preview, click to select.`);
      }
    }).catch(() => {
      if (!cancelled && revision === scanRevision.current) setWarning("Could not restore the saved object scan. Object Selection can try again; no segmentation was submitted.");
    }).finally(() => { if (!cancelled && mounted.current) setRestoringSelections(false); });
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
      const bounds = stage.getBoundingClientRect();
      const x = event.clientX - bounds.left - bounds.width / 2;
      const y = event.clientY - bounds.top - bounds.height / 2;
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
      const { deltaX, deltaY, shiftKey } = event;
      setCanvasView((view) => {
        if (shiftKey || !deltaY) {
          return { ...view, pan: { x: view.pan.x - deltaX * units, y: view.pan.y - deltaY * units } };
        }
        const zoom = Math.max(0.5, Math.min(5, view.zoom * Math.exp(-deltaY * units * 0.002)));
        if (zoom === view.zoom) return view;
        const ratio = zoom / view.zoom;
        return { zoom, pan: { x: x - (x - view.pan.x) * ratio, y: y - (y - view.pan.y) * ratio } };
      });
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
  async function uploadSeedreamReferences(files) {
    if (busyRef.current || !files.length) return;
    busyRef.current = true; setBusy(true); setBusyLabel("Uploading references"); setError("");
    try {
      for (const file of files.slice(0, 9 - seedreamSettings.references.length)) {
        const form = new FormData(); appendWorkflowContextFormFields(form, workflowContext);
        form.append("nodeType", "image"); form.append("asset", file);
        const { response, data } = await nodeApi.uploadAsset(form);
        if (!response.ok || !data.asset?.localUrl) throw new Error(data.error || "Reference upload failed.");
        if (mounted.current) setSeedreamSettings(current => ({ ...current, references: [...current.references, { url: data.asset.localUrl, name: file.name }] }));
      }
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }
  async function exportBoxes() {
    if (busyRef.current || saving || restoringSelections || !size || blank || namingBoxes.length) return;
    setSaving(true); setError("");
    try {
      const exportBoxes = [...boxes];
      if (hasSelection) {
        const canvas = document.createElement("canvas"), scale = Math.min(1, 1024 / Math.max(size.width, size.height));
        canvas.width = Math.round(size.width * scale); canvas.height = Math.round(size.height * scale);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        drawImageEditMarks(context, history.marks, canvas.width, canvas.height, "selection");
        try {
          exportBoxes.push(boxFromSelectionPixels({ data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height, id: crypto.randomUUID(), label: selectionName.current || `Selection ${boxes.length + 1}` }));
        } catch (failure) { if (failure.message !== "The selection is empty. Select an object before creating its box.") throw failure; }
      }
      if (!exportBoxes.length) throw new Error("Select an object or draw a box before saving an Image Selection node. Use Done to save the draft and close.");
      await nodeApi.imageObjectCache({ sourceUrl: base.url, selectionState: selectionState() });
      const png = await exportBoxSelections({ boxes: exportBoxes, size, base, prompt, drawingMarks: history.marks });
      const form = new FormData(); appendWorkflowContextFormFields(form, workflowContext);
      form.append("sourceUrl", base.url);
      form.append("nodeId", item.editContext?.nodeId || "");
      form.append("nodeTitle", item.label || "Image Edit");
      form.append("selection", png, "image-selection.png");
      const data = await nodeApi.saveImageSelection(form);
      await onAccept(item, data.item, "copy"); commitLayerChanges(); onClose();
    }
    catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  }
  async function identifyBoxObject(box, sourceBase = base) {
    if (!falAvailable) throw new Error("Enable a Fal key to identify box objects with SAM 3.1, or use an existing Object Selection.");
    setBusyLabel(`Identifying ${box.label} with SAM 3.1`);
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
    busyRef.current = true; setBusy(true); setBusyLabel("Selecting box object with SAM 3.1"); setError("");
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
  function discardEdits() { if (!busyRef.current && !saving && !modelSaving) onClose(); }
  function keyboard(event) {
    if (event.target.closest('.ies-box-name-input, [aria-label="Rename layer"], [aria-label="Rename folder"]') || (event.target.closest(".ies-compare-handle") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))) return;
    if (event.target.closest(".ies-transform-handle") && event.key.startsWith("Arrow")) return;
    if (event.target.closest(".ies-layer-resize") && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    if (event.altKey && event.target.closest(".ies-layer-row-name[draggable='true']") && ["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); discardEdits(); return; }
    if (event.key === "Tab") {
      const container = rootRef.current;
      const controls = [...container.querySelectorAll('button:not(:disabled), summary, a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [role="slider"][tabindex="0"]')].filter((element) => {
        const closed = element.closest("details:not([open])");
        return element.offsetParent && !element.matches(":disabled") && (!closed || element === closed.firstElementChild);
      });
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
    if (event.target.closest('input:not([type="range"]), textarea, select')) return;
    if ((event.metaKey || event.ctrlKey) && ["z", "y"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      const forward = event.shiftKey || event.key.toLowerCase() === "y";
      const strokeChanges = forward ? history.future : history.past;
      if (layerTarget && (showComposition || !strokeChanges.length)) restoreLayerHistory(forward);
      else if (forward) redo();
      else undo();
    }
  }
  function point(event) {
    const surface = surfaceRef.current || stageRef.current;
    const rect = surface.getBoundingClientRect();
    if (!layerTarget || showComposition) return imageEditPoint(event.clientX, event.clientY, rect);
    const angle = activeLayer.rotation * Math.PI / 180;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const scale = zoom * activeLayer.scale / 100;
    const width = surface.clientWidth * scale;
    const height = surface.clientHeight * scale;
    return imageEditPoint(dx * Math.cos(angle) + dy * Math.sin(angle), -dx * Math.sin(angle) + dy * Math.cos(angle),
      { left: -width / 2, top: -height / 2, width, height });
  }
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
      } else setObjectStatus(masks.length ? `${masks.length} objects ready. Hover to preview; click to select.` : "No automatic objects found. Click an object to try SAM 3.1, or select by prompt.");
      if (data.warning) setWarning(data.warning);
    };
    if (!rescan && objectCache.current.has(key)) { apply(objectCache.current.get(key)); return; }
    busyRef.current = true; setBusy(true); setBusyLabel(kind === "auto" ? "Finding objects with SAM 2" : "Selecting with SAM 3.1"); setError(""); setWarning("");
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
    if (tool === "boxes" && !previewOnly) return;
    if (event.button !== 0 || busyRef.current || saving || restoringSelections || !size || dragRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const start = point(event);
    if (!previewOnly && tool === "object" && !blank) {
      selectionName.current = "";
      const mask = objectAtPoint(objectMasks, start);
      if (mask) commit(selectObjectMarks(history.marks, mask, event));
      else void findObjects({ point: start }, { shiftKey: event.shiftKey, altKey: event.altKey });
      return;
    }
    if (!previewOnly && tool === "text" && !note.trim()) { setError("Enter a text note first, then place it on the image."); return; }
    if (!previewOnly && layer === "selection" && tool !== "hand") selectionName.current = "";
    event.currentTarget.setPointerCapture(event.pointerId);
    const mark = { tool: previewOnly ? "hand" : tool, layer, color, opacity: opacity / 100, size: brushSize / 100, points: [start], text: note.slice(0, 500) };
    dragRef.current = { pointerId: event.pointerId, mark, clientX: event.clientX, clientY: event.clientY, pan };
    if (mark.tool !== "hand") setDraft(mark);
    setError("");
  }
  function pointerMove(event) {
    if (size && !previewOnly) {
      if (["pen", "eraser"].includes(tool)) setCursor(point(event));
      if (tool === "object" && !busy && !blank) setHoverObject(objectAtPoint(objectMasks, point(event)));
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (drag.mark.tool === "hand") {
      const pan = { x: drag.pan.x + event.clientX - drag.clientX, y: drag.pan.y + event.clientY - drag.clientY };
      setCanvasView((view) => ({ ...view, pan }));
      return;
    }
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
    const edit = retryDraft || { base, size, marks: history.marks, prompt, mode, blank, quality, resolution, selectedBoxId, seedreamSettings };
    const { base: editBase, size: editSize, marks: editMarks, prompt: editPrompt, mode: editMode, blank: editBlank } = edit;
    const splitLayers = editMode === "layers";
    const requestModel = splitLayers ? "Seedream 5.5" : model;
    const requestProvider = splitLayers ? (atlasAvailable ? "atlas" : "") : provider;
    const editBoxesDraft = splitLayers ? [] : editMarks.filter(mark => mark.layer === "boxes");
    const output = edit.seedreamSettings || seedreamSettings;
    const qualities = isIdeogram45Model(requestModel) ? ideogram45QualityOptions : ["high", "xhigh", "max"];
    const editQuality = qualities.includes(edit.quality) ? edit.quality : "high";
    const editResolution = resolutionOptions.includes(edit.resolution) ? edit.resolution : "2K";
    if (busyRef.current || saving || (!splitLayers && namingBoxes.length) || modelSavePending.current) return;
    if (!editSize) { setError("Wait for the original image to load before generating."); return; }
    if (!requestProvider) { setError("Enable an image-edit provider in Settings before generating."); return; }
    const maxLayers = Number(output.atlasMaxLayers);
    if (splitLayers && (!Number.isInteger(maxLayers) || maxLayers < 1 || maxLayers > 99)) {
      setError("Choose a maximum of 1 to 99 layers.");
      return;
    }
    const translator = splitLayers ? prepareSeedreamLabelTranslator() : null;
    // Pointer capture can be lost when focus leaves the canvas. It must never
    // silently block an explicit Generate click using the committed boxes.
    boxGesture.current = false;
    busyRef.current = true; setBusy(true); setBusyLabel("Generating edit"); setError(""); setWarning("");
    try {
      imageEditSize(editSize.width, editSize.height, requestModel);
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
      const drawing = splitLayers ? null : await renderLayer("drawing", editMarks, editSize);
      const selection = editBlank || splitLayers ? null : await renderLayer("selection", editMarks, editSize);
      if (editMode === "remove" && !selection) throw new Error("Paint a selection over the area to remove.");
      if (editBlank && !drawing) throw new Error("Draw a sketch first.");
      const form = new FormData();
      appendWorkflowContextFormFields(form, workflowContext);
      form.append("boxes", JSON.stringify(editBoxes));
      const objects = Object.fromEntries(resolvedBoxes.filter(box => boxNeedsObject(box) && box.sourceMask).map(box => [box.id, box.sourceMask]));
      if (Object.keys(objects).length) form.append("boxObjects", new Blob([JSON.stringify(objects)], { type: "application/json" }), "box-objects.json");
      for (const [key, value] of Object.entries({ sourceUrl: editBase.url, requestId: globalThis.crypto.randomUUID(), prompt: editPrompt, mode: editMode, quality: editQuality, resolution: splitLayers ? output.atlasLayerResolution : editResolution, model: requestModel, blank: String(editBlank), provider: requestProvider, nodeId: item.editContext?.nodeId || "", nodeTitle: item.label || "Image Edit" })) form.append(key, value);
      if (seedream || splitLayers) {
        const fields = splitLayers ? { maxLayers: maxLayers + 1, textRecognition: output.atlasTextRecognition }
          : {
            outputFormat: output.outputFormat,
            background: output.background,
            aspectRatio: selection || editBoxes.length || (drawing && editMode !== "sketch") ? "auto" : output.aspectRatio,
            referenceUrls: JSON.stringify(output.references.map(reference => reference.url)),
          };
        for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
      }
      if (drawing) form.append("drawing", drawing, "drawing.png");
      if (selection) form.append("selection", selection, "selection.png");
      if (layerTarget && !splitLayers) form.append("preserveAlpha", "true");
      const data = await nodeApi.editImage(form);
      if (splitLayers && data.items?.length) {
        const baseImage = data.items.find(layer => layer.layer.index === 0);
        const canvasSize = baseImage?.width && baseImage?.height ? { width: baseImage.width, height: baseImage.height } : editSize;
        const layers = await translateSeedreamLabels(data.items, translator);
        if (!mounted.current) return;
        const previous = versions.findLast(version => version.layerGroup);
        const existing = layerSession || (previous ? stackFor(previous) : null);
        const group = existing?.items[0].layerGroup || globalThis.crypto.randomUUID();
        const results = layers.map(layer => ({ ...layer, layerGroup: group, before: editBase.url, layerSourceSize: editSize }));
        const merged = existing && mergeLayerSeparation({ ...existing, key: group }, layerDrafts.current.get(existing.key) || initializeLayerStack(existing),
          results, canvasSize, existing === layerSession ? stackDraft.selected : undefined);
        const nextStack = merged?.stack || { key: group, items: results, sourceSize: editSize, canvasSize };
        const added = merged?.results || results;
        const nextDraft = merged?.draft || initializeLayerStack(nextStack);
        if (merged && existing.key === group) recordLayerChange(undefined, existing, layerDrafts.current.get(group) || initializeLayerStack(existing));
        stageLayerChanges({ results: nextStack.items, stackKey: group, draft: nextDraft, replaceResults: true });
        versionDrafts.current.push(...added.map(() => ({ ...edit, marks: [] })));
        setVersions(old => [...old, ...added]);
        enterLayerStack(nextStack, nextDraft);
        setWarning(data.warning || "");
        return;
      }
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
      setVersions((old) => [...old, { ...data.item, modelName: model, before: editBase.url, layerEdit: layerTarget }]);
      setResultIndex(versions.length); setView("split"); setSplit(50); setWarning([data.warning, scanWarning].filter(Boolean).join(" "));
    } catch (failure) { setError(failure.message || "Image edit failed."); }
    finally {
      void translator?.then(instance => instance?.destroy?.()).catch(() => {});
      busyRef.current = false; setBusy(false);
    }
  }
  async function accept(action) {
    if (busyRef.current || (!result && action !== "layers")) return;
    busyRef.current = true; setSaving(true); setError("");
    try {
      if (layerTarget && action === "apply") { applyLayerResult(result); return; }
      const output = action === "layers" ? layerSession?.items || versions.filter(version => version.layerGroup === resultLayerGroup) : result;
      await onAccept(item, output, action);
      commitLayerChanges();
      onClose();
    }
    catch (failure) { setError(failure.message || "Could not apply the edit."); }
    finally { busyRef.current = false; setSaving(false); }
  }
  function adjustBoxes() {
    const saved = versionDrafts.current[resultIndex];
    if (!saved || busyRef.current || saving) return;
    if (saved.base.url !== base.url) skipSelectionRestore.current = true;
    setBase(saved.base); setSize(saved.size); setHistory({ past: [], marks: saved.marks, future: [] });
    setPrompt(saved.prompt); setMode(saved.mode); setBlank(saved.blank);
    const qualities = isIdeogram45Model(model) ? ideogram45QualityOptions : ["high", "xhigh", "max"];
    setQuality(qualities.includes(saved.quality) ? saved.quality : "high");
    setResolution(resolutionOptions.includes(saved.resolution) ? saved.resolution : "2K");
    setSelectedBoxId(saved.selectedBoxId || saved.marks.find(mark => mark.layer === "boxes")?.id || "");
    setTool("boxes"); setLayer("boxes"); setResultIndex(-1); setView("result"); setError(""); setWarning(""); fitImage();
  }
  function continueEditing() {
    setBase(result); setResultIndex(-1); setView("result"); setHistory(emptyHistory); setPrompt(""); setBlank(false); setMode("edit"); setError(""); fitImage();
  }
  function stackFor(target) {
    const group = target.layerGroup;
    const saved = layerDrafts.current.get(group);
    const urls = saved && new Set(saved.layers.map(entry => entry.url));
    return {
      key: group || "image:" + target.url,
      items: group ? versions.filter(version => version.layerGroup === group && (!urls || urls.has(version.url))) : [{ ...target, label: target.label || "Image", layer: { index: 0 } }],
      canvasSize: saved?.canvasSize,
      result: !group && versions.includes(target) ? target : null,
      sourceSize: target.layerSourceSize || size,
    };
  }
  function currentLayerStack() {
    if (layerSession) return layerSession;
    const previous = versions.find(version => (version.layerGroup || "image:" + version.url) === lastLayerStack.current);
    const recentGroup = versions.findLast(version => version.layerGroup);
    return stackFor(result || previous || (lastLayerStack.current === "image:" + base.url ? base : recentGroup) || base);
  }
  function stageLayerChanges(changes) {
    pendingLayerDraft.current ??= readImageLayerDraft(layerStorageKey);
    updateImageLayerDraft(pendingLayerDraft.current, changes);
  }
  function commitLayerChanges() {
    if (!pendingLayerDraft.current) return;
    try {
      writeImageLayerDraft(layerStorageKey, pendingLayerDraft.current);
      pendingLayerDraft.current = null;
      setLayerStorageError("");
    } catch { setLayerStorageError("Layer changes could not be saved in this browser."); }
  }
  function storeStackDraft(next, stack = layerSession) {
    setStackDraft(next);
    layerDrafts.current.set(stack.key, next);
    lastLayerStack.current = stack.key;
    stageLayerChanges({ stackKey: stack.key, draft: next, results: stack.result ? [stack.result] : [] });
  }
  function recordLayerChange(gesture, stack = layerSession, draft = stackDraft) {
    if (!stack || !draft) return;
    const previous = stackHistory.current.get(stack.key);
    if (gesture && previous?.gesture === gesture) return;
    stackHistory.current.set(stack.key, { past: [...(previous?.past || []).slice(-49), { stack, draft }], future: [], gesture });
  }
  function changeStackDraft(next, gesture) {
    recordLayerChange(gesture);
    storeStackDraft(next);
  }
  function restoreLayerHistory(forward) {
    if (busyRef.current || saving || dragRef.current || boxGesture.current || !layerHistory) return;
    const { past, future } = layerHistory;
    const snapshot = (forward ? future : past).at(-1);
    if (!snapshot) return;
    const current = { stack: layerSession, draft: stackDraft };
    stackHistory.current.set(layerSession.key, forward
      ? { past: [...past, current], future: future.slice(0, -1) }
      : { past: past.slice(0, -1), future: [...future, current] });
    const next = snapshot.draft.layers.some(entry => entry.url === stackDraft.selected)
      ? { ...snapshot.draft, selected: stackDraft.selected } : snapshot.draft;
    const target = next.layers.find(entry => entry.url === next.selected);
    const source = layerEditSource(snapshot.stack, target);
    if (layerSession.items !== snapshot.stack.items) {
      stageLayerChanges({ results: snapshot.stack.items, stackKey: snapshot.stack.key, draft: next, replaceResults: true });
      const restored = snapshot.stack.items.filter(item => !versions.some(version => version.url === item.url && version.layerGroup === item.layerGroup));
      if (restored.length) {
        versionDrafts.current.push(...restored.map(() => undefined));
        setVersions(old => [...old, ...restored]);
      }
    }
    setLayerSession(snapshot.stack);
    storeStackDraft(next, snapshot.stack);
    if (source.url !== base.url || next.selected !== stackDraft.selected) loadLayerTools(snapshot.stack, next);
  }
  function captureTools() {
    return { base, size, history, prompt, mode, blank, selectedBoxId, resultIndex, tool, layer, selectionName: selectionName.current };
  }
  function restoreTools(source, saved) {
    if (base.url !== source.url) skipSelectionRestore.current = Boolean(saved);
    setBase(source); setHistory(saved?.history || emptyHistory); setDraft(null);
    setPrompt(saved?.prompt || ""); setMode(saved?.mode || "edit"); setBlank(saved?.blank || false);
    setSelectedBoxId(saved?.selectedBoxId || ""); setTool(saved?.tool || "pen"); setLayer(saved?.layer || "drawing");
    selectionName.current = saved?.selectionName || "";
    setResultIndex(saved?.resultIndex ?? -1); setView("result"); setError(""); fitImage();
  }
  function rememberLayerTools() {
    if (layerSession) layerToolDrafts.current.set(JSON.stringify([layerSession.key, stackDraft.selected]), captureTools());
  }
  function loadLayerTools(stack, next) {
    const source = layerEditSource(stack, next.layers.find(entry => entry.url === next.selected));
    const saved = layerToolDrafts.current.get(JSON.stringify([stack.key, next.selected]));
    restoreTools(source, saved?.base.url === source.url ? saved : !layerSession && sourceDraft.current?.base.url === source.url ? sourceDraft.current : null);
  }
  function enterLayerStack(stack, initialDraft) {
    if (layerSession) rememberLayerTools();
    else sourceDraft.current = captureTools();
    const next = initialDraft || initializeLayerStack(stack, layerDrafts.current.get(stack.key));
    setLayerSession(stack);
    storeStackDraft(next, stack);
    loadLayerTools(stack, next);
  }
  function leaveLayerStack() {
    rememberLayerTools();
    setLayerSession(null); setStackDraft(null);
    if (sourceDraft.current) restoreTools(sourceDraft.current.base, sourceDraft.current);
  }
  function selectStackLayer(url) {
    if (url !== stackDraft.selected) {
      rememberLayerTools();
      const next = { ...stackDraft, selected: url };
      storeStackDraft(next);
      loadLayerTools(layerSession, next);
    }
  }
  function removeSelectedLayers(urls) {
    if (busyRef.current || saving || urls.size >= stackDraft.layers.length) return;
    const layers = stackDraft.layers.filter(entry => !urls.has(entry.url));
    const index = stackDraft.layers.findIndex(entry => entry.url === stackDraft.selected);
    const selected = stackDraft.layers.slice(index + 1).find(entry => !urls.has(entry.url))?.url || layers.at(-1).url;
    const stack = { ...layerSession, items: layerSession.items.filter(entry => !urls.has(entry.url)) };
    recordLayerChange();
    enterLayerStack(stack, { ...stackDraft, layers, selected });
  }
  function transformStackLayer(patch, gesture) {
    changeStackDraft({ ...stackDraft, layers: stackDraft.layers.map(entry => entry.url === stackDraft.selected ? { ...entry, ...patch } : entry) }, gesture);
  }
  function separateSelectedLayer() {
    const source = layerEditSource(layerSession, activeLayer);
    const sourceSize = source.width && source.height ? { width: source.width, height: source.height } : size;
    return generate({ base: source, size: sourceSize, mode: "layers", marks: [], blank: false,
      prompt: layerMode ? prompt : "", quality, resolution, seedreamSettings });
  }
  function applyLayerResult(output) {
    const replacement = { url: output.url, width: output.width, height: output.height, mimeType: output.mimeType, fileName: output.fileName };
    const next = { ...stackDraft, layers: stackDraft.layers.map(entry => entry.url === stackDraft.selected ? { ...entry, replacement } : entry) };
    layerToolDrafts.current.delete(JSON.stringify([layerSession.key, stackDraft.selected]));
    changeStackDraft(next);
    loadLayerTools(layerSession, next);
  }
  async function addSelectionToStack(target) {
    if (busyRef.current || saving || !size || (!selectionBox && !hasSelection)) return;
    busyRef.current = true; setSaving(true); setError("");
    try {
      const mask = selectionBox ? null : await renderLayer("selection");
      if (!selectionBox && !mask) throw new Error("Select visible pixels first.");
      const cutout = await extractLayerSelection(base.url, size, mask, selectionBox);
      const previous = layerSession || currentLayerStack();
      const previousDraft = stackDraft || initializeLayerStack(previous, layerDrafts.current.get(previous.key));
      const sourceGeometry = layerSession ? previousDraft.layers.find(entry => entry.url === previousDraft.selected)
        : { x: 0, y: 0, ...previousDraft.canvasSize, rotation: 0, scale: 100 };
      if (target) {
        const targetUrl = layerEditSource(previous, target).url;
        const pasted = await pasteLayerSelection(cutout, sourceGeometry, target, targetUrl);
        const replacement = await uploadLayerComposite(await layerCompositeBlob(pasted.canvas), pasted.canvas, workflowContext);
        layerToolDrafts.current.delete(JSON.stringify([previous.key, target.url]));
        changeStackDraft({ ...previousDraft, layers: previousDraft.layers.map(entry => entry.url === target.url ? { ...entry, ...pasted.geometry, replacement } : entry) });
      } else {
        const cropped = cropLayerSelection(cutout, sourceGeometry);
        const output = await uploadLayerComposite(await layerCompositeBlob(cropped.canvas), cropped.canvas, workflowContext);
        const name = selectionBox?.label || selectionName.current || "Selection";
        const group = previous.items[0].layerGroup || globalThis.crypto.randomUUID();
        const item = { ...output, label: name, before: base.url, layerGroup: group, layer: { index: previousDraft.layers.length } };
        const promoted = group !== previous.key ? previous.items.map(entry => ({ ...entry, layerGroup: group, before: entry.url })) : [];
        const nextStack = { ...previous, key: group, canvasSize: previousDraft.canvasSize, items: [...(promoted.length ? promoted : previous.items), item] };
        const nextDraft = { ...previousDraft, selected: item.url, layers: [...previousDraft.layers,
          { ...cropped.geometry, url: item.url, name, visible: true, opacity: 100 }] };
        const added = [...promoted, item];
        recordLayerChange(undefined, promoted.length ? { ...previous, key: group, items: promoted } : previous, previousDraft);
        stageLayerChanges({ results: nextStack.items, stackKey: group, draft: nextDraft, replaceResults: true });
        versionDrafts.current.push(...added.map(() => undefined));
        setVersions(old => [...old, ...added]);
        enterLayerStack(nextStack, nextDraft);
      }
    } catch (failure) { setError(failure.message || "Could not add the selection to the layer stack."); }
    finally { busyRef.current = false; setSaving(false); }
  }
  React.useEffect(() => {
    if (!size || restoringSelections || !restoreStackOnLoad.current) return;
    restoreStackOnLoad.current = false;
    const stack = currentLayerStack();
    if (restoredLayers.consolidated) stageLayerChanges({ results: stack.items, stackKey: stack.key, draft: layerDrafts.current.get(stack.key), replaceResults: true });
    enterLayerStack(stack);
  }, [size, restoringSelections]);
  async function saveLayerStack(format) {
    if (busyRef.current || saving || !size) return;
    busyRef.current = true; setSaving(true); setError("");
    try {
      const stack = currentLayerStack();
      const composition = await renderLayerStack(stack, layerDrafts.current.get(stack.key), format === "psd");
      if (format === "psd") await downloadLayerPsd(composition);
      else {
        const output = await uploadLayerComposite(await layerCompositeBlob(composition.canvas), composition, workflowContext);
        if (format === "edit") {
          leaveLayerStack();
          restoreTools(output, null);
          return;
        }
        await onAccept(item, output, "copy");
        commitLayerChanges();
        onClose();
      }
    } catch (failure) { setError(failure.message || "Could not save the layer stack."); }
    finally { busyRef.current = false; setSaving(false); }
  }
  const displayedImageSize = layerTarget ? compositionSize(layerSession.items, layerSession.sourceSize, layerSession.canvasSize) : reviewing && result.width && result.height ? result : size;
  const fitMargin = layerTarget ? 64 : 36;
  const scale = displayedImageSize ? Math.max(0.01, Math.min((viewport.width - fitMargin) / displayedImageSize.width, (viewport.height - fitMargin) / displayedImageSize.height)) : 1;
  const displaySize = displayedImageSize ? { width: displayedImageSize.width * scale, height: displayedImageSize.height * scale } : { width: 300, height: 300 };
  const showAlpha = showComposition || (reviewing ? view !== "original" && (layerTarget || result.layer || isSeedream55Edit(result.modelName)) && result.mimeType === "image/png"
    : layerTarget && !blank && base.mimeType === "image/png");
  const previewScale = size ? Math.min(1, 1600 / Math.max(size.width, size.height)) : 1;
  const setActiveLayer = (value) => { setLayer(value); if (tool === "boxes" || (value === "selection" && ["text", "arrow"].includes(tool)) || (value === "drawing" && tool === "object")) setTool("pen"); };

  const canvasStyle = { ...displaySize, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` };
  function readImageSize(event) {
    setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
  }
  const comparison = view !== "result" && <>
    <div className="ies-original-preview" style={{ clipPath: view === "split" ? `inset(0 ${100 - split}% 0 0)` : undefined }}>
      <img src={item.url} alt="Original comparison image" draggable={false} />
    </div>
    {view === "split" && <CompareHandle split={split} setSplit={setSplit} />}
  </>;
  const imageSurface = <div ref={surfaceRef} className={`ies-surface ${tool === "hand" || previewOnly ? "panning" : ""}${showAlpha && !layerTarget ? " alpha-preview" : ""}${layerMode || showComposition ? " ies-layer-source" : ""}`} style={layerTarget ? undefined : canvasStyle} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerLeave={() => { setCursor(null); setHoverObject(null); }} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp}>
            <img src={reviewing ? result.before : base.url} alt="Original image" draggable={false}
              style={{ visibility: blank || reviewing ? "hidden" : "visible" }}
              onLoad={readImageSize} onError={() => setError("Could not load the original full-resolution image.")} />
            {!reviewing && size && <><canvas ref={drawingRef} aria-label="Drawing canvas" width={Math.round(size.width * previewScale)} height={Math.round(size.height * previewScale)} /><canvas ref={selectionRef} aria-label="Selection canvas" className="ies-selection" width={Math.round(size.width * previewScale)} height={Math.round(size.height * previewScale)} /></>}
            {!reviewing && size && <canvas ref={hoverRef} aria-label="Object hover preview" className="ies-object-hover" width={Math.round(size.width * previewScale)} height={Math.round(size.height * previewScale)} />}
            {!previewOnly && size && !blank && tool === "boxes" && <ImageEditBoxPreview box={boxes.find(box => box.id === selectedBoxId && boxNeedsObject(box))} size={size} sourceUrl={base.url} />}
            {!previewOnly && size && !blank && (boxes.length > 0 || tool === "boxes") && <ImageEditBoxesOverlay boxes={boxes} size={size} active={tool === "boxes"} disabled={busy || saving} selectedId={selectedBoxId} onSelect={setSelectedBoxId} onCommit={commitBox} onGesture={active => { boxGesture.current = active; }} />}
            {reviewing && <img className="ies-result" src={result.url} alt="Edited result" draggable={false} style={{ objectFit: "contain" }} />}
            {!layerTarget && comparison}
            {cursor && !previewOnly && !busy && ["pen", "eraser"].includes(tool) && <div className="ies-brush-cursor" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, width: Math.max(3, brushSize / 100 * Math.min(displaySize.width, displaySize.height)), aspectRatio: "1", borderColor: tool === "eraser" ? "#fff" : layer === "selection" ? "#72efd8" : color }} />}
          </div>;

  return <section ref={rootRef} tabIndex={-1} className="image-edit-studio" aria-label="Image Edit" role="dialog" aria-modal="true" onKeyDownCapture={keyboard} onPointerDown={(event) => event.stopPropagation()}>
    <header className="ies-header">
      <span><Pencil size={18} /><strong>Image Edit</strong><small>{item.label || item.fileName || "Image"}</small></span>
      <div className="ies-header-actions">
        <button ref={openLayersButton} className="ies-open-layers" type="button" aria-label="Show layers" title="Show layers"
          disabled={busy || saving || !size} aria-pressed={layerTarget} onClick={() => layerTarget ? rootRef.current?.querySelector('.ies-layer-row-name[data-active="true"]')?.focus() : enterLayerStack(currentLayerStack())}><Layers size={17} /><span>Layers</span></button>
        <button className="ies-export-psd" type="button" aria-label="Export PSD" title="Export PSD" disabled={busy || saving || !size}
          onClick={() => saveLayerStack("psd")}><Download size={17} /><span>Export PSD</span></button>
        <IconButton icon={Save} label="Save image to disk" onClick={saveToDisk} disabled={busy || saving || !size || namingBoxes.length > 0} />
        <button type="button" disabled={busy || saving || modelSaving || restoringSelections || namingBoxes.length > 0} onClick={done}><Check size={17} />Done</button>
        <IconButton icon={X} label="Discard edits and close image editor" onClick={discardEdits} disabled={busy || saving || modelSaving} />
      </div>
    </header>
    <div className="ies-workspace">
      <div className="ies-main">
        <div className="ies-toolbar" role="toolbar" aria-label="Drawing tools">
          <div className="ies-segment" role="group" aria-label="Editing layer"><IconButton icon={Pencil} label="Drawing layer" active={layer === "drawing"} disabled={busy || previewOnly} onClick={() => setActiveLayer("drawing")} /><IconButton icon={Scan} label="Selection layer" active={layer === "selection"} disabled={busy || previewOnly || blank} onClick={() => setActiveLayer("selection")} /></div>
          {tools.map(([id, Icon, label]) => <IconButton key={id} icon={Icon} label={label} active={previewOnly ? id === "hand" : tool === id} disabled={busy || (previewOnly && id !== "hand") || (layer === "selection" && ["text", "arrow"].includes(id))} onClick={() => { setTool(id); if (layer === "boxes" && id !== "hand") setLayer("drawing"); }} />)}
          <IconButton icon={ScanSearch} label="Object Selection" active={tool === "object" && !reviewing} disabled={busy || previewOnly || blank || !size || restoringSelections} onClick={() => { setTool("object"); setLayer("selection"); setHoverObject(null); }} />
          <IconButton icon={Boxes} label="Boxes" active={tool === "boxes" && !reviewing} disabled={busy || previewOnly || !size} onClick={activateBoxes} />
          <div className="ies-divider" />
          <IconButton icon={Undo2} label="Undo stroke" onClick={undo} disabled={busy || previewOnly || !history.past.length} /><IconButton icon={Redo2} label="Redo stroke" onClick={redo} disabled={busy || previewOnly || !history.future.length} />
          <IconButton icon={Trash2} label="Clear active layer" onClick={() => commit(history.marks.filter((mark) => mark.layer !== layer))} disabled={busy || previewOnly || !history.marks.some((mark) => mark.layer === layer)} />
        </div>
        <div className="ies-contextbar">
          {!showComposition && <strong>{tool === "boxes" ? "Boxes" : tool === "object" ? "Object Selection" : tools.find(([id]) => id === tool)?.[2]}</strong>}
          {activeLayer && <span className="ies-context-target" title={activeLayer.name}>{activeLayer.name}</span>}
          {layerTarget && <div className="ies-segment" role="group" aria-label="Layer tools">
            <button type="button" aria-pressed={showComposition} className={showComposition ? "active" : ""} onClick={() => setMoveLayers(true)}>Move Layers</button>
            <button type="button" aria-pressed={!showComposition} className={!showComposition ? "active" : ""} onClick={() => setMoveLayers(false)}>Edit Pixels</button>
          </div>}
        </div>
        <div className="ies-stage" ref={stageRef}>
          {layerTarget ? <div className="ies-surface ies-stack-canvas alpha-preview" style={canvasStyle}
            onPointerDown={previewOnly ? pointerDown : undefined} onPointerMove={previewOnly ? pointerMove : undefined}
            onPointerUp={previewOnly ? pointerUp : undefined} onPointerCancel={previewOnly ? pointerUp : undefined}>
            <LayerStackPreview stack={layerSession} draft={stackDraft} disabled={busy || saving} zoom={zoom}
              onChange={transformStackLayer} showTransform={view === "result"} activeContent={showComposition ? null : imageSurface} previewUrl={showComposition ? result?.url : undefined} />
            {showComposition && <img style={{ display: "none" }} src={base.url} alt="" onLoad={readImageSize} />}
            {comparison}
          </div> : imageSurface}
          {busy && <div className="ies-progress" role="status"><LoaderCircle size={22} className="ies-spinning" /><span>{busyLabel}</span><time>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</time></div>}
          {!size && !error && <div className="ies-progress" role="status"><LoaderCircle className="ies-spinning" size={22} />Loading image</div>}
          {error && <div className="ies-stage-error" role="alert">{error}</div>}
        </div>
        <div className="ies-viewbar">
          <span>{displayedImageSize ? `${displayedImageSize.width} x ${displayedImageSize.height}` : ""}</span>
          <div className="ies-review-controls"><div className="ies-segment" role="group" aria-label="Preview mode">{["original", "split", "result"].map((value) => <button type="button" key={value} className={view === value ? "active" : ""} aria-pressed={view === value} onClick={() => setView(value)}>{value === "split" ? "Compare" : value === "result" ? "Edit" : "Original"}</button>)}</div>{view === "split" && <input aria-label="Comparison split" type="range" min="0" max="100" value={split} onChange={(e) => setSplit(Number(e.target.value))} />}</div>
          <div className="ies-zoom"><IconButton icon={Minus} label="Zoom out" onClick={() => adjustZoom(-0.25)} /><output>{Math.round(scale * zoom * 100)}%</output><IconButton icon={Plus} label="Zoom in" onClick={() => adjustZoom(0.25)} /><IconButton icon={Maximize} label="Fit image" onClick={fitImage} /></div>
        </div>
      </div>
      <aside className="ies-sidebar" aria-label="Image inspector">
        <div className="ies-inspector-header">
          <label>Layers<select aria-label="Layers" value={layerTarget ? "stack:" + layerSession.key : resultIndex} disabled={busy || saving} onChange={event => {
            const value = event.target.value;
            if (value.startsWith("stack:")) {
              const version = versions.find(entry => entry.layerGroup === value.slice(6));
              if (version) enterLayerStack(stackFor(version));
              return;
            }
            if (layerTarget) leaveLayerStack();
            setResultIndex(Number(value)); setView(value === "-1" ? "result" : "split");
          }}>
            <option value="-1">Current draft</option>
            {layerTarget && !layerSession.items[0].layerGroup && <option value={"stack:" + layerSession.key}>Layer stack</option>}
            {layerOptions.map(({ id, label, entries }) => id === "edits" ? <optgroup key={id} label={label}>
              {entries.filter(({ version }) => !version.layerEdit).map(({ version, index }) => <option key={version.url + index} value={index}>Edit {index + 1}</option>)}
            </optgroup> : <option key={id} value={"stack:" + id}>{label}</option>)}
          </select></label>
          <label title="Shared with User Preferences">Model<select aria-label="Image Editor Model" value={model} disabled={busy || saving || modelSaving}
            onChange={event => changeModel(event.target.value)}>{imageEditModelOptions.map(option => <option key={option}>{option}</option>)}</select></label>
          {modelSaving && <small role="status">Saving model preference…</small>}
        </div>
        <div className="ies-sidebar-scroll">
        {layerTarget && <LayerStackControls key={layerSession.key} stack={layerSession} draft={stackDraft} disabled={busy || saving} showProperties={showComposition}
          canUndo={Boolean(layerHistory?.past.length)} canRedo={Boolean(layerHistory?.future.length)}
          canSeparate={Boolean(atlasAvailable && size && !busy && !saving && !modelSaving && !restoringSelections)} onSeparate={separateSelectedLayer}
          onRemove={removeSelectedLayers} onUndo={() => restoreLayerHistory(false)} onRedo={() => restoreLayerHistory(true)}
          onSelect={selectStackLayer} onDraft={changeStackDraft} onTransform={transformStackLayer} />}
        {!reviewing && (selectionBox || hasSelection) && <section className="ies-panel-section">
          <h3>Selection to layer</h3>
          <button type="button" disabled={busy || saving || !size} onClick={() => addSelectionToStack()}>Add to New Layer</button>
          {destination && <label>Destination layer<select value={destination.url} disabled={busy || saving} onChange={event => setSelectionDestination(event.target.value)}>
            {layerDestinations.map(entry => <option key={entry.url} value={entry.url}>{entry.name}</option>)}
          </select></label>}
          <button type="button" disabled={busy || saving || !destination || !size} onClick={() => addSelectionToStack(destination)}>Add to Existing Layer</button>
        </section>}
        {!reviewing && <fieldset disabled={busy || saving || restoringSelections}>
          <section className="ies-panel-section"><div className="ies-section-heading"><h3>Edit instructions</h3></div>
          <label>Method<select aria-label="Edit method" disabled={boxes.length > 0 && !seedream} value={mode} onChange={(e) => { setMode(e.target.value); if (e.target.value !== "sketch") setBlank(false); if (e.target.value === "remove") { setActiveLayer("selection"); setTool("pen"); } }}><option value="edit">Edit image</option><option value="sketch" disabled={boxes.length > 0}>Render sketch</option><option value="remove" disabled={boxes.length > 0}>Remove selected</option>{seedream && <option value="layers">Separate layers</option>}</select></label>
          {mode === "sketch" && <label className="ies-checkbox"><input type="checkbox" checked={blank} onChange={(e) => { setBlank(e.target.checked); if (e.target.checked) setActiveLayer("drawing"); }} />Blank canvas</label>}
          <label>Prompt<textarea className="ies-prompt" aria-label="Edit prompt" rows={5} maxLength={16000} placeholder={layerMode ? "Name the elements to separate (optional)" : mode === "remove" ? "Additional direction (optional)" : "Describe the change..."} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
          </section>
          {selectionSaved && <p className="ies-selection-notice" role="status">{selectionSaved}</p>}
          {tool !== "object" && objectStatus && <p className="ies-selection-notice" role="status">{objectStatus}</p>}
          {tool !== "object" && inheritedScan && <p className="ies-selection-notice" role="status">Using scan from before this edit. Boundaries may have changed; Scan image for objects updates them.</p>}
          {!layerMode && tool === "boxes" && <ImageEditBoxesPanel boxes={boxes} selectedId={selectedBoxId} onSelect={setSelectedBoxId} onCommit={commitBox} onDelete={id => commit(history.marks.filter(mark => mark.id !== id))} onUploadReference={uploadBoxReference} onSelectObject={selectBoxObject} onSaveSelection={exportBoxes} namingBoxes={namingBoxes} model={model} busy={busy || saving || typeof onAccept !== "function"} />}
          {!layerMode && tool === "object" && <section className="ies-object-controls ies-panel-section"><div className="ies-section-heading"><h3>Object selection</h3></div>
            <label>Select by prompt<textarea aria-label="Object selection prompt" rows={2} maxLength={300} placeholder="The jacket, all people…" value={selectionPrompt} onChange={e => setSelectionPrompt(e.target.value)} /></label>
            <div className="ies-object-actions">
              <button type="button" disabled={!size || blank || !selectionPrompt.trim()} onClick={() => findObjects({ prompt: selectionPrompt.trim() })}>Select</button>
              <button type="button" disabled={!size || blank || !falAvailable} onClick={() => findObjects({}, {}, true)}>Scan image for objects</button>
            </div>
            <small>Click selects · Shift adds · Alt subtracts. Scan and Select use Fal.</small>

            {objectStatus && <p role="status">{objectStatus}</p>}
            {inheritedScan && <p role="status">Using scan from before this edit. Boundaries may have changed; Scan image for objects updates them.</p>}
            <details className="ies-disclosure"><summary>Detection settings</summary><div className="ies-sam2-controls ies-section-body" role="group" aria-label="SAM 2 settings">

              {[["pointsPerSide", "Sampling density", 8, 64, 8, "Higher finds more small objects; takes longer."], ["confidence", "Confidence threshold", 0, 1, 0.01, "Lower keeps more candidates, including uncertain ones."], ["stability", "Stability threshold", 0, 1, 0.01, "Lower accepts less consistent boundaries."], ["minRegionArea", "Minimum region area", 0, 10000, 1, "Lower keeps smaller regions; measured in analysis pixels."]].map(([key, label, min, max, step, hint]) => <label className="ies-slider" key={key}>{label}<output>{key === "pointsPerSide" ? `${sam2Settings[key]} × ${sam2Settings[key]}` : key === "minRegionArea" ? `${sam2Settings[key]} px` : sam2Settings[key].toFixed(2)}</output><input type="range" aria-label={label} min={min} max={max} step={step} value={sam2Settings[key]} onChange={event => setSam2Settings(current => ({ ...current, [key]: Number(event.target.value) }))} /><small>{hint}</small></label>)}

              <button type="button" onClick={() => setSam2Settings(sam2Defaults)}>Reset detection settings</button>
              <small>Scan image for objects submits a new Fal request. Your current selection is kept.</small>
            </div></details>
          </section>}
          {!layerMode && !["boxes", "object", "hand"].includes(tool) && <details key={tool + layer} open={tool === "text"} className="ies-disclosure ies-panel-section"><summary>{layer === "selection" ? "Selection brush settings" : "Drawing tool settings"}</summary><div className="ies-section-body ies-tool-options">{layer === "drawing" && <div className="ies-color-row" aria-label="Drawing color">{imageEditColors.map((value) => <button type="button" key={value} aria-label={`Color ${value}`} title={value} aria-pressed={color === value} className={`ies-swatch ${color === value ? "active" : ""}`} style={{ background: value }} onClick={() => setColor(value)} disabled={layer === "selection"} />)}<input aria-label="Custom drawing color" type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={layer === "selection"} /></div>}
          <label className="ies-slider">{tool === "text" ? "Text size" : "Brush size"}<output>{brushSize.toFixed(1)}</output><input aria-label="Brush size" type="range" min="0.2" max="12" step="0.2" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} /></label>
          {layer === "drawing" && <label className="ies-slider">Opacity<output>{opacity}%</output><input aria-label="Drawing opacity" type="range" min="10" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} disabled={layer === "selection"} /></label>}
          {tool === "text" && <label>Text note<textarea aria-label="Text note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>}
          </div></details>}
          <section className="ies-panel-section"><div className="ies-section-heading"><h3>Output</h3></div><div className="ies-output-grid">
          {!layerMode && (imageEditUsesSelectionGuide(model) ? <label>Resolution<select aria-label="Edit resolution" value={resolution} onChange={e => setResolution(e.target.value)}>{resolutionOptions.map(value => <option key={value}>{value}</option>)}</select></label> : <label>Quality<select aria-label="Edit quality" value={quality} onChange={(e) => setQuality(e.target.value)}>{(isIdeogram45Model(model) ? ideogram45QualityOptions : ["high", "xhigh", "max"]).map((value) => <option key={value} value={value}>{({ low: "Low", medium: "Medium", high: "High", xhigh: "Extra High", max: "Maximum" })[value]}</option>)}</select></label>)}
          {seedream && <>
            {layerMode ? <>
              <label className="ies-layer-count">Maximum layers<input aria-describedby="ies-layer-count-help" type="number" min="1" max="99" step="1" value={seedreamSettings.atlasMaxLayers} onChange={event => changeSeedream({ atlasMaxLayers: event.target.value })} /></label>
              <label>Layer resolution<select value={seedreamSettings.atlasLayerResolution} onChange={event => changeSeedream({ atlasLayerResolution: event.target.value })}>
                <option value="auto">Auto</option><option value="1k">1K</option><option value="1.5k">1.5K</option><option value="2k">2K</option>
              </select></label>
              <small id="ies-layer-count-help">1–99 editable layers. Seedream may return fewer.</small>
              <label className="ies-checkbox"><input type="checkbox" checked={seedreamSettings.atlasTextRecognition} onChange={event => changeSeedream({ atlasTextRecognition: event.target.checked })} />Recognize text layers</label>
            </> : <>
              <label>Background<select aria-label="Edit background" value={seedreamSettings.background} onChange={event => changeSeedream({ background: event.target.value, ...(event.target.value === "transparent" && { outputFormat: "png" }) })}>
                {seedream55Backgrounds.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
              </select></label>
              <label>Aspect ratio<select aria-label="Edit aspect ratio" value={hasSelection || boxes.length || hasDrawing && mode !== "sketch" ? "auto" : seedreamSettings.aspectRatio}
                disabled={hasSelection || boxes.length > 0 || hasDrawing && mode !== "sketch"} onChange={event => changeSeedream({ aspectRatio: event.target.value })}>
                {seedream55AspectRatios.map(value => <option key={value} value={value}>{value === "auto" ? "Auto" : value}</option>)}
              </select></label>
              <label>Reference images<input aria-label="Seedream reference images" type="file" accept="image/png,image/jpeg,image/webp" multiple
                disabled={seedreamSettings.references.length >= 9} onChange={event => {
                  const files = Array.from(event.target.files);
                  event.target.value = "";
                  uploadSeedreamReferences(files);
                }} /></label>
              {seedreamSettings.references.map((reference, index) => <div key={reference.url + index} className="ies-seedream-reference">
                <span>{reference.name}</span><button type="button" aria-label={`Remove ${reference.name}`}
                  onClick={() => changeSeedream({ references: seedreamSettings.references.filter((_, i) => i !== index) })}>Remove</button>
              </div>)}
              <small>Up to 10 images per edit, including the source and guides.</small>
            </>}
            {!layerMode && <label>Save format<select aria-label="Edit output format" value={seedreamSettings.outputFormat}
              onChange={event => changeSeedream({ outputFormat: event.target.value })}>
              {seedream55Formats.map(value => <option key={value} value={value} disabled={value === "jpeg" && seedreamSettings.background === "transparent"}>{value.toUpperCase()}</option>)}
            </select></label>}
          </>}
          </div></section>
          {!layerMode && <details className="ies-disclosure ies-panel-section"><summary>Save selection draft</summary><div className="ies-section-body">
            <button type="button" onClick={saveSelections} disabled={!size || blank || namingBoxes.length > 0}>Save selections and boxes</button>
          <small>Create an Image Selection node to reuse this draft. Done applies the image edits and saves the selection draft.</small>
          </div></details>}
        </fieldset>}
        {reviewing && <div className="ies-result-actions">
          {result.layer?.description && <small>{result.layer.description}</small>}
          {result.layer?.textRecognition?.text && <label>Recognized text<textarea readOnly value={result.layer.textRecognition.text} /></label>}
          {versionDrafts.current[resultIndex]?.marks.some(mark => mark.layer === "boxes") && <>
            <button type="button" disabled={busy || saving || modelSaving || !providerAvailable} onClick={() => generate(versionDrafts.current[resultIndex])}><RefreshCcw size={17} />Rerun Box Edit</button>
            <button type="button" disabled={busy || saving} onClick={adjustBoxes}><Boxes size={17} />Adjust Boxes</button>
            <small>Rerun starts a new generation from the original source and saved boxes, using the model selected above.</small>
          </>}
          {resultLayerGroup && <button type="button" disabled={busy || saving} onClick={() => accept("layers")}><Layers size={17} />Add Layers to Canvas</button>}
          {!layerTarget && canApply && !result.layer && <button type="button" disabled={busy || saving} onClick={() => accept("apply")}><Check size={17} />Apply to Source</button>}
          <button type="button" disabled={busy || saving} onClick={continueEditing}><Pencil size={17} />Continue Editing</button>
          <a href={result.url} download={result.fileName}><Download size={17} />Download</a>
        </div>}
        {(warning || layerStorageError) && <p className="ies-warning" role="status">{[warning, layerStorageError].filter(Boolean).join(" ")}</p>}
        </div>
        <div className="ies-run-section">
          <small>{reviewing ? result.modelName || model : layerMode ? "Seedream 5.5 Layer Decomposition" : isIdeogram45Model(model) ? "Ideogram 4.5 Precise Edit" : model} <span>{resultProvider === "fal.ai" ? "Fal" : resultProvider || providerLabel}</span></small>
          {reviewing && <button className="ies-primary" type="button" disabled={busy || saving} onClick={() => accept(layerTarget ? "apply" : "copy")}>
            {layerTarget ? <><Check size={17} />Apply to Layer</> : <><Plus size={17} />Add Image to Canvas</>}
          </button>}
          {!reviewing && <button className="ies-primary" type="button" onClick={() => generate()} disabled={busy || saving || namingBoxes.length > 0 || modelSaving || !size || !providerAvailable || (!layerMode && (mode === "remove" ? !hasSelection : !prompt.trim() && !boxes.some(box => box.mode !== "keep") && !(mode === "sketch" && hasDrawing)))}><Brush size={17} />{busy ? "Generating..." : layerMode ? "Separate Layers" : "Generate Edit"}</button>}
          {layerTarget && !reviewing && !layerMode && hasDrawing && <button type="button" disabled={busy || saving || !size}
            onClick={applyLayerDrawing}><Check size={17} />Apply Drawing to Layer</button>}
          {!reviewing && showApiCosts && <small className="ies-cost">Variable API cost</small>}
          {!reviewing && !providerAvailable && <p role="status" className="ies-warning">{layerMode ? "Enable an Atlas Cloud key in Settings to separate layers with Seedream 5.5." : seedream ? "Enable a Krea key in Settings to edit with Seedream 5.5." : imageEditRequiresFal(model) ? `Enable a Fal key in Settings to use ${model}.` : "Enable Fal or Atlas Cloud in Settings to edit images."}</p>}
          {layerTarget && <div className="ies-stack-actions">
            <button type="button" disabled={busy || saving} onClick={() => saveLayerStack("png")}>Save composite as Image</button>
            {showComposition && <button type="button" disabled={busy || saving} onClick={() => saveLayerStack("edit")}>Edit Composite</button>}
            {!reviewing && resultLayerGroup && <button type="button" disabled={busy || saving} onClick={() => accept("layers")}>Add Layers to Canvas</button>}
          </div>}
        </div>
      </aside>
    </div>
  </section>;
}
