import React from "react";
import { FlipHorizontal2, FlipVertical2, Gauge, PanelRight, RotateCcw } from "lucide-react";
import { assemblyClipSourceSpan } from "../assembly/assemblyState.js";
import { assemblyMediaTechnicalReadout } from "../assembly/assemblyLivePreview.js";
import "../assembly/assemblyInspector.css";

export function AssemblyDetailsPanel({ selection, media, frameRate, outputWidth, outputHeight, onPreviewUpdate, onUpdate, onPreviewRetime, onRetime }) {
  const clip = selection?.clip;
  const track = selection?.track;
  if (!clip || !media || !track) {
    return (
      <aside className="assembly-inspector nodrag nowheel" onPointerDown={(event) => event.stopPropagation()}>
        <header><PanelRight size={14} /><strong>Details</strong></header>
        <div className="assembly-inspector-empty"><PanelRight size={22} /><span>Select a timeline clip</span></div>
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
            <section className="assembly-inspector-tile">
              <div className="assembly-inspector-title"><strong>Motion</strong><button type="button" title="Reset motion" onClick={resetMotion}><RotateCcw size={12} /></button></div>
              <InspectorRange label="Position X" value={clip.translateX} min={-outputWidth} max={outputWidth} step={1} suffix="px" onPreview={(value) => onPreviewUpdate({ translateX: value })} onCommit={(value) => onUpdate({ translateX: value })} />
              <InspectorRange label="Position Y" value={clip.translateY} min={-outputHeight} max={outputHeight} step={1} suffix="px" onPreview={(value) => onPreviewUpdate({ translateY: value })} onCommit={(value) => onUpdate({ translateY: value })} />
              <InspectorRange label="Scale" value={clip.scale} min={1} max={400} numberMax={1000} step={1} suffix="%" onPreview={(value) => onPreviewUpdate({ scale: value })} onCommit={(value) => onUpdate({ scale: value })} />
              <InspectorRange label="Rotation" value={clip.rotation} min={-180} max={180} numberMin={-3600} numberMax={3600} step={1} suffix="deg" onPreview={(value) => onPreviewUpdate({ rotation: value })} onCommit={(value) => onUpdate({ rotation: value })} />
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

function InspectorNumberInput({ value, min, max, step, onCommit }) {
  const [draft, setDraft] = React.useState(String(value));
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [value]);

  const commit = () => {
    focusedRef.current = false;
    const number = Number(draft);
    if (!Number.isFinite(number)) {
      setDraft(String(value));
      return;
    }
    const normalized = Math.min(max, Math.max(min, number));
    setDraft(String(normalized));
    if (normalized !== Number(value)) onCommit(normalized);
  };

  return (
    <input
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
