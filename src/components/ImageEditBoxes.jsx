import React from "react";
import { drawObjectMask } from "../objectSelection.js";
import { boxNeedsObject, boxNeedsIdentification } from "../imageEditBoxModels.js";
import { boxCorners, boxContextRect, boxFromDrag, transformEditBox, maxEditBoxes, editBoxModes, clampBoxValue } from "../imageEditBoxes.js";

export function ImageEditBoxesOverlay({ boxes, size, active, disabled, selectedId, onSelect, onCommit, onGesture }) {
  const svgRef = React.useRef(null), drag = React.useRef(null);
  const [draft, setDraft] = React.useState(null);
  const [renaming, setRenaming] = React.useState(null);
  const gestureCallback = React.useRef(onGesture);
  gestureCallback.current = onGesture;
  React.useEffect(() => () => gestureCallback.current(false), []);
  function rename(event, box) {
    event.preventDefault(); event.stopPropagation();
    if (!active || disabled) return;
    drag.current = null; setDraft(null); onGesture(false); onSelect(box.id);
    setRenaming({ id: box.id, value: box.label });
  }
  function saveName() {
    if (!renaming) return;
    const box = boxes.find(box => box.id === renaming.id);
    if (box && renaming.value.trim() && renaming.value.trim() !== box.label) onCommit({ ...box, label: renaming.value.trim() });
    setRenaming(null);
  }
  const point = event => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: clampBoxValue((event.clientX - rect.left) / rect.width, 0, 1), y: clampBoxValue((event.clientY - rect.top) / rect.height, 0, 1) };
  };
  function begin(event, box, operation = "translate") {
    if (!active || disabled || event.button !== 0 || drag.current) return;
    event.preventDefault(); event.stopPropagation();
    if (!box && boxes.length >= maxEditBoxes) return;
    const start = point(event);
    const original = box || boxFromDrag(start, start, crypto.randomUUID());
    drag.current = { original, operation: box ? operation : "create", start, pointerId: event.pointerId, next: original };
    svgRef.current.setPointerCapture(event.pointerId); onSelect(original.id); onGesture(true); setDraft(original);
  }
  function move(event) {
    const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const p = point(event);
    current.next = current.operation === "create" ? boxFromDrag(current.start, p, current.original.id) : transformEditBox(current.original, current.operation, current.start, p, size.width, size.height);
    setDraft(current.next);
  }
  function finish(event) {
    const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation(); drag.current = null;
    if (event.type !== "pointercancel" && current.next.source.w >= .005 && current.next.source.h >= .005) onCommit(current.next);
    setDraft(null); onGesture(false);
    if (svgRef.current.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  }
  const shown = draft ? [...boxes.filter(box => box.id !== draft.id), draft] : boxes;
  const points = rect => boxCorners(rect, size.width, size.height).map(p => `${p.x},${p.y}`).join(" ");
  const radius = Math.max(4, Math.min(size.width, size.height) / 65);
  return <svg ref={svgRef} className={`ies-box-overlay ${active ? "interactive" : ""}`} aria-label="Boxes canvas" viewBox={`0 0 ${size.width} ${size.height}`} onPointerDown={event => begin(event)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
    {shown.map((box, index) => {
      const sourceOnly = ["keep", "remove"].includes(box.mode), rect = sourceOnly ? box.source : box.target;
      const corners = boxCorners(rect, size.width, size.height), top = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
      const cx = rect.x * size.width, cy = rect.y * size.height;
      const length = Math.max(1, Math.hypot(top.x - cx, top.y - cy));
      const rotate = { x: top.x + (top.x - cx) / length * radius * 4, y: top.y + (top.y - cy) / length * radius * 4 };
      return <g key={box.id}>
        {active && selectedId === box.id && box.mode !== "keep" && (box.mode === "move" ? [box.source, box.target] : [rect]).map((region, i) => <polygon key={`context-${i}`} points={points(boxContextRect(region, size.width, size.height, box.contextPadding))} fill="none" stroke="#ffffff88" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
        {box.mode === "move" && <><polygon className="ies-box-source" points={points(box.source)} /><line className="ies-box-link" x1={box.source.x * size.width} y1={box.source.y * size.height} x2={cx} y2={cy} /></>}
        <polygon data-box-id={box.id} aria-label={`Box ${index + 1}: ${box.label}`} className={`ies-box-target ${selectedId === box.id ? "selected" : ""} ${sourceOnly ? box.mode : ""}`} points={points(rect)} onPointerDown={event => begin(event, box)} onDoubleClick={event => rename(event, box)} />
        <text className="ies-box-caption" aria-label={`Rename box ${index + 1}`} x={corners[0].x} y={corners[0].y - radius} fontSize={radius * 1.2} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => rename(event, box)}>{index + 1}. {box.label} · {editBoxModes[box.mode]}</text>
        {active && selectedId === box.id && <>
          {corners.map((p, i) => <g key={i}>
            <circle aria-label={`Scale box ${index + 1}`} className="ies-box-scale-hit" cx={p.x} cy={p.y} r={radius} onPointerDown={event => begin(event, box, "scale")} />
            <circle className="ies-box-handle ies-box-corner" cx={p.x} cy={p.y} r={radius / 4} />
          </g>)}
          {!sourceOnly && <><line className="ies-box-link" x1={top.x} y1={top.y} x2={rotate.x} y2={rotate.y} />
          <circle aria-label={`Rotate box ${index + 1}`} className="ies-box-handle rotate" cx={rotate.x} cy={rotate.y} r={radius} onPointerDown={event => begin(event, box, "rotate")} /></>}
        </>}
        {renaming?.id === box.id && <foreignObject x={clampBoxValue(corners[0].x, 0, size.width * .6)} y={clampBoxValue(corners[0].y - radius * 5, 0, size.height - radius * 6)} width={size.width * .4} height={radius * 6} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
          <input className="ies-box-name-input" aria-label="Canvas box description" autoFocus maxLength={200} value={renaming.value} style={{ fontSize: radius * 1.8 }} onFocus={event => event.target.select()} onChange={event => setRenaming({ ...renaming, value: event.target.value })} onBlur={saveName} onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); saveName(); } else if (event.key === "Escape") { event.preventDefault(); setRenaming(null); } }} />
        </foreignObject>}
      </g>;
    })}
  </svg>;
}

export function ImageEditBoxesPanel({ boxes, selectedId, onSelect, onCommit, onDelete, onUploadReference, onSelectObject, model, busy }) {
  const box = boxes.find(entry => entry.id === selectedId);
  const reference = boxes.find(entry => entry.mode === "reference" && entry.referenceUrl)?.referenceUrl;
  const sourceOnly = box && ["keep", "remove"].includes(box.mode);
  function setTarget(patch) {
    const target = { ...box.target, ...patch };
    if (sourceOnly) {
      target.w = Math.min(1, target.w); target.h = Math.min(1, target.h); target.rotation = 0;
      target.x = clampBoxValue(target.x, target.w / 2, 1 - target.w / 2); target.y = clampBoxValue(target.y, target.h / 2, 1 - target.h / 2);
    }
    onCommit({ ...box, target, ...(sourceOnly ? { source: target, sourceMask: undefined } : {}) });
  }
  return <div className="ies-box-controls" role="group" aria-label="Boxes settings">
    <strong>Boxes</strong><small>Draw around an object or its destination. Drag to translate, corners to scale, and the round handle above to rotate. Double-click a box or its label to rename it.</small>
    {boxes.length > 0 && <label>Active box<select aria-label="Active box" value={box?.id || ""} onChange={event => onSelect(event.target.value)}><option value="" disabled>Choose a box</option>{boxes.map((entry, index) => <option key={entry.id} value={entry.id}>{index + 1}. {entry.label}</option>)}</select></label>}
    {box && <>
      <label>Mode<select aria-label="Box mode" value={box.mode} onChange={event => onCommit({ ...box, mode: event.target.value, ...(["keep", "remove"].includes(event.target.value) ? { target: { ...box.source } } : {}) })}>{Object.entries(editBoxModes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Description<input aria-label="Box description" value={box.label} maxLength={200} onChange={event => onCommit({ ...box, label: event.target.value })} /></label>
      {boxNeedsObject(box) && <>
        <small>{boxNeedsIdentification(box, model) ? "Generate identifies the named object with SAM 3 when no selection exists (a separate Fal request), then uses its shape as the placement reference." : "FLUX 3 identifies the named subject using native source/destination instructions. Select object for a precise shape if needed."} The full generated scene is kept for continuous lighting; Keep boxes protect exact pixels.</small>
        <button type="button" onClick={() => onSelectObject(box)}>{box.sourceMask ? "Reselect object" : "Select object"}</button>
        {box.sourceMask && <small role="status">Object selected. Check the highlighted source and destination preview before generating.</small>}
      </>}
      {box.mode !== "keep" && <label>Shadow / lighting area ({Math.round((box.contextPadding ?? .35) * 100)}%)<input aria-label="Shadow / lighting area" type="range" min="0" max="100" step="5" value={Math.round((box.contextPadding ?? .35) * 100)} onChange={event => onCommit({ ...box, contextPadding: Number(event.target.value) / 100 })} /><small>Expand the context around the object for shadows and lighting. Dashed boxes indicate approximate reach; blending follows the selected shape. Keep boxes protect nearby objects.</small></label>}
      {box.mode === "text" && <label>Text to render<textarea aria-label="Box text" rows={2} maxLength={500} value={box.text || ""} onChange={event => onCommit({ ...box, text: event.target.value })} /></label>}
      {box.mode === "reference" && <>
        <label>Reference image<input aria-label="Box reference image" type="file" accept="image/*" disabled={busy} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) onUploadReference(box, file); }} /></label>
        {box.referenceUrl && <img className="ies-box-reference" src={box.referenceUrl} alt="Box reference" />}
        {reference && box.referenceUrl !== reference && <button type="button" onClick={() => onCommit({ ...box, referenceUrl: reference })}>Use existing reference</button>}
        <small>One shared reference image per edit.</small>
      </>}
      <div className="ies-box-numbers">
        {[["x", "Translate X (%)", 0, 100], ["y", "Translate Y (%)", 0, 100], ["w", "Width (%)", .5, sourceOnly ? 100 : 200], ["h", "Height (%)", .5, sourceOnly ? 100 : 200], ["rotation", "Rotation (°)", -180, 180]].filter(([key]) => !sourceOnly || key !== "rotation").map(([key, label, min, max]) => <label key={key}>{label}<input aria-label={label} type="number" step="1" min={min} max={max} value={Number((box.target[key] * (key === "rotation" ? 1 : 100)).toFixed(2))} onChange={event => { if (event.target.value !== "" && Number.isFinite(event.target.valueAsNumber)) setTarget({ [key]: clampBoxValue(event.target.valueAsNumber, min, max) / (key === "rotation" ? 1 : 100) }); }} /></label>)}
      </div>
      <button type="button" onClick={() => onCommit({ ...box, target: { ...box.source } })}>Reset transform</button>
      <button type="button" onClick={() => onDelete(box.id)}>Delete box</button>
    </>}
    <small>{boxes.length}/{maxEditBoxes} boxes · Uses your preferred image-edit model. Results may vary by model.</small>
  </div>;
}


export function ImageEditBoxPreview({ box, size, sourceUrl }) {
  const ref = React.useRef(null);
  const scale = Math.min(1, 1600 / Math.max(size.width, size.height));
  const width = Math.round(size.width * scale), height = Math.round(size.height * scale);
  React.useEffect(() => {
    const canvas = ref.current, context = canvas.getContext("2d"); context.clearRect(0, 0, width, height);
    if (!box?.sourceMask) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const cutout = document.createElement("canvas"); cutout.width = width; cutout.height = height;
      const c = cutout.getContext("2d");
      c.save();
      c.drawImage(image, 0, 0, width, height); c.globalCompositeOperation = "destination-in"; c.fillStyle = "white"; drawObjectMask(c, box.sourceMask, width, height); c.restore();
      context.save(); context.fillStyle = "#f2db5177"; drawObjectMask(context, box.sourceMask, width, height); context.restore();
      if (box.mode !== "move") return;
      context.save(); context.translate(box.target.x * width, box.target.y * height); context.rotate(box.target.rotation * Math.PI / 180); context.scale(box.target.w / box.source.w, box.target.h / box.source.h); context.translate(-box.source.x * width, -box.source.y * height); context.drawImage(cutout, 0, 0); context.restore();
    };
    image.src = sourceUrl;
    return () => { cancelled = true; };
  }, [box, sourceUrl, width, height]);
  return <canvas ref={ref} aria-label="Box object preview" width={width} height={height} />;
}
