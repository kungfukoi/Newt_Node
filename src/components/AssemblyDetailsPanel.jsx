import React from "react";
import { ChevronsLeftRight, FlipHorizontal2, FlipVertical2, Gauge, PanelRight, RotateCcw } from "lucide-react";
import { assemblyClipSourceSpan } from "../assembly/assemblyState.js";
import { assemblyMediaTechnicalReadout } from "../assembly/assemblyLivePreview.js";
import "../assembly/assemblyInspector.css";

export function AssemblyDetailsPanel({ selection, selectionCount, media, frameRate, onPreviewUpdate, onUpdate, onPreviewRetime, onRetime }) {
  const clip = selection?.clip;
  const track = selection?.track;
  if (!clip || !media || !track) {
    return (
      <aside className="assembly-inspector nodrag nowheel" onPointerDown={(event) => event.stopPropagation()}>
        <header><PanelRight size={14} /><strong>Details</strong></header>
        <div className="assembly-inspector-empty"><PanelRight size={22} /><span>{selectionCount > 1 ? "Select one clip to edit its details" : "Select a timeline clip"}</span></div>
      </aside>
    );
  }

  const visual = media.type === "video" || media.type === "image";
  const timed = media.type === "video" || media.type === "audio";
  const sourceOut = clip.sourceIn + assemblyClipSourceSpan(clip);
  const resetMotion = () => onUpdate({ translateX: 0, translateY: 0, scale: 100, rotation: 0, flipHorizontal: false, flipVertical: false });

  return (
    <aside className="assembly-inspector nodrag nowheel" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      <header><PanelRight size={14} /><strong>Details</strong></header>
      <div className="assembly-inspector-scroll">
        <section className="assembly-inspector-tile">
          <div className="assembly-inspector-title"><strong>{media.label}</strong><span>{media.type}</span></div>
          <dl>
            <div><dt>Track</dt><dd>{track.name}</dd></div>
            <div><dt>Media</dt><dd>{assemblyMediaTechnicalReadout(media)}</dd></div>
            <div><dt>Timeline</dt><dd>{formatSeconds(clip.start)} - {formatSeconds(clip.start + clip.duration)}</dd></div>
            <div><dt>Source</dt><dd>{formatSeconds(clip.sourceIn)} - {formatSeconds(sourceOut)}</dd></div>
            <div><dt>Duration</dt><dd>{formatSeconds(clip.duration)}</dd></div>
          </dl>
        </section>

        {visual && (
          <>
            <section className="assembly-inspector-tile" key={clip.id}>
              <div className="assembly-inspector-title"><strong>Motion</strong><button type="button" title="Reset motion" onClick={resetMotion}><RotateCcw size={12} /></button></div>
              <MotionControl label="Position X" value={clip.translateX} min={-100000} max={100000} dragRate={1} suffix="px" onPreview={(value) => onPreviewUpdate({ translateX: value })} onCommit={(value) => onUpdate({ translateX: value })} />
              <MotionControl label="Position Y" value={clip.translateY} min={-100000} max={100000} dragRate={1} suffix="px" onPreview={(value) => onPreviewUpdate({ translateY: value })} onCommit={(value) => onUpdate({ translateY: value })} />
              <MotionControl label="Scale" value={clip.scale} min={1} max={1000} dragRate={0.25} suffix="%" onPreview={(value) => onPreviewUpdate({ scale: value })} onCommit={(value) => onUpdate({ scale: value })} />
              <MotionControl label="Rotation" value={clip.rotation} min={-3600} max={3600} dragRate={0.25} suffix="deg" onPreview={(value) => onPreviewUpdate({ rotation: value })} onCommit={(value) => onUpdate({ rotation: value })} />
              <div className="assembly-inspector-actions" role="group" aria-label="Clip flips">
                <button type="button" className={clip.flipHorizontal ? "active" : ""} title="Flip horizontally" onClick={() => onUpdate({ flipHorizontal: !clip.flipHorizontal })}><FlipHorizontal2 size={14} /><span>Horizontal</span></button>
                <button type="button" className={clip.flipVertical ? "active" : ""} title="Flip vertically" onClick={() => onUpdate({ flipVertical: !clip.flipVertical })}><FlipVertical2 size={14} /><span>Vertical</span></button>
              </div>
            </section>
            <section className="assembly-inspector-tile">
              <div className="assembly-inspector-title"><strong>Opacity</strong><span>{Math.round(clip.opacity)}%</span></div>
              <InspectorRange label="Opacity" value={clip.opacity} min={0} max={100} step={1} suffix="%" onPreview={(value) => onPreviewUpdate({ opacity: value })} onCommit={(value) => onUpdate({ opacity: value })} />
            </section>
          </>
        )}

        <section className="assembly-inspector-tile">
          <div className="assembly-inspector-title"><strong>{timed ? "Time Remap" : "Timing"}</strong>{timed ? <Gauge size={13} /> : null}</div>
          {timed ? (
            <>
              <InspectorRange label="Speed" value={clip.speed} min={25} max={400} numberMin={1} numberMax={1000} step={1} suffix="%" onPreview={onPreviewRetime} onCommit={onRetime} />
              <label className="assembly-inspector-toggle">
                <span>Reverse speed</span>
                <input type="checkbox" checked={clip.reverse} onChange={(event) => onUpdate({ reverse: event.target.checked })} />
              </label>
              <small>{formatSeconds(assemblyClipSourceSpan(clip))} of source plays in {formatSeconds(clip.duration)} at {clip.speed}%.</small>
            </>
          ) : (
            <InspectorNumber label="Duration" value={clip.duration} min={1 / Math.max(1, frameRate)} max={36000} step={1 / Math.max(1, frameRate)} suffix="sec" onChange={(value) => onUpdate({ duration: value })} />
          )}
        </section>
      </div>
    </aside>
  );
}

function MotionControl({ label, value, min, max, dragRate, suffix, onPreview, onCommit }) {
  const dragRef = React.useRef(null);
  const inputId = React.useId();

  function finishDrag(event, cancel = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.value === drag.startValue) return;
    if (cancel) onPreview(drag.startValue);
    else onCommit(drag.value);
  }

  return (
    <div className="assembly-motion-control">
      <label
        htmlFor={inputId}
        tabIndex={-1}
        title="Drag left or right. Hold Shift for finer adjustments."
        onPointerDown={(event) => {
          if (event.button !== 0 || dragRef.current) return;
          event.preventDefault();
          const handle = event.currentTarget;
          const input = handle.control;
          const typedValue = input === input.ownerDocument.activeElement ? input.valueAsNumber : NaN;
          const startValue = Number.isFinite(typedValue) ? Math.min(max, Math.max(min, typedValue)) : value;
          handle.focus({ preventScroll: true });
          handle.setPointerCapture(event.pointerId);
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, startValue, raw: startValue, value: startValue };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const delta = (event.clientX - drag.x) * dragRate * (event.shiftKey ? 0.1 : 1);
          drag.x = event.clientX;
          if (!delta) return;
          drag.raw = Math.min(max, Math.max(min, drag.raw + delta));
          const next = Number(drag.raw.toFixed(2));
          if (next === drag.value) return;
          drag.value = next;
          onPreview(next);
        }}
        onPointerUp={(event) => finishDrag(event)}
        onPointerCancel={(event) => finishDrag(event, true)}
        onLostPointerCapture={(event) => finishDrag(event, true)}
        onClick={(event) => event.preventDefault()}
      ><ChevronsLeftRight size={12} />{label}</label>
      <InspectorNumberInput id={inputId} value={value} min={min} max={max} step={0.1} onCommit={onCommit} />
      <small>{suffix}</small>
    </div>
  );
}

function InspectorRange({ label, value, min, max, numberMin = min, numberMax = max, step, suffix, onPreview, onCommit }) {
  return (
    <label className="assembly-inspector-control">
      <span>{label}</span>
      <div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, Number(value) || 0))}
          onChange={(event) => onPreview(Number(event.target.value))}
          onPointerUp={(event) => onCommit(Number(event.currentTarget.value))}
          onPointerCancel={(event) => onCommit(Number(event.currentTarget.value))}
          onKeyUp={(event) => onCommit(Number(event.currentTarget.value))}
        />
        <InspectorNumberInput value={value} min={numberMin} max={numberMax} step={step} onCommit={onCommit} />
        <small>{suffix}</small>
      </div>
    </label>
  );
}

function InspectorNumber({ label, value, min, max, step, suffix, onChange }) {
  return (
    <label className="assembly-inspector-control number-only">
      <span>{label}</span>
      <div><InspectorNumberInput value={value} min={min} max={max} step={step} onCommit={onChange} /><small>{suffix}</small></div>
    </label>
  );
}

function InspectorNumberInput({ id, value, min, max, step, onCommit }) {
  const [draft, setDraft] = React.useState(String(value));
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [value]);

  const commit = () => {
    if (!focusedRef.current) return;
    focusedRef.current = false;
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number)) {
      setDraft(String(value));
      return;
    }
    const normalized = Math.min(max, Math.max(min, number));
    setDraft(String(normalized));
    if (normalized !== Number(value)) onCommit(normalized);
  };

  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={() => { focusedRef.current = true; }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.stopPropagation();
          focusedRef.current = false;
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function formatSeconds(value) {
  return `${Math.max(0, Number(value) || 0).toFixed(2)}s`;
}
