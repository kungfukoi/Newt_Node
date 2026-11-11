import React from "react";
import { createPortal } from "react-dom";
import { displayMediaUrl } from "../mediaAssets.js";
import { clampLtxReframeRectangle, ltxReframeOutputSize, ltxReframeRectangleBounds, ltxVfxModels } from "../ltxVfx.js";
import { defaultOutpaintFrame, outpaintRatio } from "../videoOutpaintFrame.js";
import "./VideoOutpaintCanvasEditor.css";
import "./LtxReframePlacementPreview.css";

const placementGrid = [
  ["top_left", "Top left"], ["top", "Top"], ["top_right", "Top right"],
  ["left", "Left"], ["center", "Center"], ["right", "Right"],
  ["bottom_left", "Bottom left"], ["bottom", "Bottom"], ["bottom_right", "Bottom right"],
];

function ReframePreview({ sourceUrl, settings, interactive = false, onDimensions, onMove }) {
  const { aspect_ratio: aspectRatio, anchor, rectangle } = settings;
  const video = React.useRef(null);
  const frameElement = React.useRef(null);
  const drag = React.useRef(null);
  const [dimensions, setDimensions] = React.useState(null);
  const [failed, setFailed] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const ratio = outpaintRatio(aspectRatio);
  let sourceStyle = { visibility: "hidden" };

  if (dimensions) {
    const frame = defaultOutpaintFrame(dimensions, aspectRatio);
    const width = rectangle ? rectangle.width * 100 : 100 / frame.width;
    const height = (width * ratio * dimensions.height) / dimensions.width;
    const x = anchor.includes("left") ? 0 : anchor.includes("right") ? 1 : 0.5;
    const y = anchor.includes("top") ? 0 : anchor.includes("bottom") ? 1 : 0.5;
    sourceStyle = {
      width: `${width}%`, height: `${height}%`,
      left: `${rectangle ? rectangle.x * 100 : Math.max(0, 100 - width) * x}%`,
      top: `${rectangle ? rectangle.y * 100 : Math.max(0, 100 - height) * y}%`,
    };
  }

  return (
    <figure className={`ltx-reframe-preview${interactive ? " expanded" : ""}`} aria-label="Reframe placement preview">
      <div ref={frameElement} className="ltx-reframe-preview-frame" style={{ "--reframe-ratio": ratio }}>
        {sourceUrl && <video
          ref={video}
          aria-label="Source video"
          src={displayMediaUrl(sourceUrl)}
          muted
          playsInline
          preload="auto"
          style={sourceStyle}
          onLoadedMetadata={({ currentTarget: { videoWidth, videoHeight, duration } }) => {
            if (videoWidth && videoHeight) {
              const size = { width: videoWidth, height: videoHeight };
              setDimensions(size);
              onDimensions?.(size);
            }
            if (interactive && Number.isFinite(duration)) setDuration(duration);
          }}
          onPlay={interactive ? () => setPlaying(true) : undefined}
          onPause={interactive ? () => setPlaying(false) : undefined}
          onEnded={interactive ? () => setPlaying(false) : undefined}
          onTimeUpdate={interactive ? event => setTime(event.currentTarget.currentTime) : undefined}
          onError={() => { setFailed(true); setDimensions(null); }}
        />}
        {rectangle && dimensions && onMove && <button type="button" className="ltx-reframe-drag" aria-label="Move custom placement"
          style={sourceStyle}
          onPointerDown={event => {
            if (event.button !== 0) return;
            const { width, height } = frameElement.current.getBoundingClientRect();
            drag.current = { x: event.clientX, y: event.clientY, width, height, rectangle };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const start = drag.current;
            if (!start) return;
            onMove({ ...start.rectangle, x: start.rectangle.x + (event.clientX - start.x) / start.width,
              y: start.rectangle.y + (event.clientY - start.y) / start.height });
          }}
          onLostPointerCapture={() => { drag.current = null; }}
        />}
      </div>
      <figcaption>
        {failed ? "Could not preview the source video."
          : !sourceUrl ? "Connect a source video to preview placement."
          : !dimensions ? "Loading source video…"
          : `${aspectRatio} output · striped area shows space to fill`}
      </figcaption>
      {interactive && <div className="outpaint-canvas-toolbar ltx-reframe-transport">
        <button type="button" disabled={!dimensions} onClick={() => {
          const element = video.current;
          if (element.paused) element.play().catch(() => {});
          else element.pause();
        }}>{playing ? "Pause" : "Play"}</button>
        <input type="range" aria-label="Reframe preview time" min="0" max={duration} step="0.01" value={time}
          disabled={!dimensions || !duration} onChange={event => {
            const next = Number(event.target.value);
            video.current.pause();
            video.current.currentTime = next;
            setTime(next);
          }} />
        <span>{time.toFixed(2)} s</span>
      </div>}
    </figure>
  );
}

function ReframePlacementEditor({ sourceUrl, settings, onApply, onClose }) {
  const dialog = React.useRef(null);
  const [draft, setDraft] = React.useState(settings);
  const [source, setSource] = React.useState(null);
  const bounds = source && ltxReframeRectangleBounds(draft, source);
  const rectangle = bounds && draft.rectangle ? clampLtxReframeRectangle(draft.rectangle, bounds) : draft.rectangle;
  const previewSettings = { ...draft, rectangle };
  const output = ltxReframeOutputSize(draft);
  const updateRectangle = value => setDraft(current => ({ ...current, rectangle: clampLtxReframeRectangle(value, bounds) }));
  React.useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element.showModal();
    return () => { element.close(); opener?.focus?.(); };
  }, []);

  return createPortal(
    <dialog ref={dialog} className="outpaint-canvas-dialog ltx-reframe-dialog nodrag nowheel" aria-label="Reframe placement editor"
      onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}>
      <div className="outpaint-canvas-heading">
        <h2>Reframe placement</h2>
        <button type="button" onClick={onClose} aria-label="Close placement editor">×</button>
      </div>
      <div className="ltx-reframe-editor-layout">
        <ReframePreview sourceUrl={sourceUrl} settings={previewSettings} onDimensions={setSource}
          onMove={bounds ? updateRectangle : undefined} interactive />
        <div className="ltx-reframe-editor-controls">
          {ltxVfxModels.reframe.controls.filter(control => control.key !== "anchor").map(({ key, label, options }) => (
            <label key={key}>{label}
              <select value={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))}>
                {options.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
          ))}
          <span>{output.width} × {output.height} output</span>
          <label>Safety checker
            <input type="checkbox" checked={draft.enable_safety_checker !== false}
              onChange={event => setDraft(current => ({ ...current, enable_safety_checker: event.target.checked }))} />
          </label>
          <fieldset>
            <legend>Source placement</legend>
            <label>Custom placement
              <input type="checkbox" checked={Boolean(rectangle)} disabled={!bounds}
                onChange={event => {
                  if (!event.target.checked) { setDraft(current => ({ ...current, rectangle: null })); return; }
                  const width = bounds.maxWidth;
                  const x = (1 - width) * (draft.anchor.includes("left") ? 0 : draft.anchor.includes("right") ? 1 : 0.5);
                  const y = (1 - width * bounds.heightPerWidth) * (draft.anchor.includes("top") ? 0 : draft.anchor.includes("bottom") ? 1 : 0.5);
                  updateRectangle({ x, y, width });
                }} />
            </label>
            {rectangle && bounds ? <div className="ltx-reframe-rectangle-fields">
              {[["x", "Left"], ["y", "Top"], ["width", "Source width"]].map(([key, label]) => (
                <label key={key}>{label} (%)
                  <input type="number" min="0" max="100" step="0.1" value={Number((rectangle[key] * 100).toFixed(3))}
                    onChange={event => {
                      if (Number.isFinite(event.target.valueAsNumber)) updateRectangle({ ...rectangle, [key]: event.target.valueAsNumber / 100 });
                    }} />
                </label>
              ))}
            </div> :
            <div className="ltx-reframe-anchor-grid">
              {placementGrid.map(([anchor, label]) => (
                <button type="button" key={anchor} aria-pressed={draft.anchor === anchor}
                  onClick={() => setDraft(current => ({ ...current, anchor }))}>{label}</button>
              ))}
            </div>
            }
          </fieldset>
        </div>
      </div>
      <div className="outpaint-canvas-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" disabled={Boolean(rectangle) && !bounds} onClick={() => onApply(previewSettings)}>Apply placement</button>
      </div>
    </dialog>, document.body
  );
}

export default function LtxReframePlacementPreview({ sourceUrl, settings, running, onApply }) {
  const [editing, setEditing] = React.useState(false);
  return <>
    <ReframePreview sourceUrl={sourceUrl} settings={settings} />
    <button className="outpaint-user-action" type="button" disabled={!sourceUrl || running} onClick={() => setEditing(true)}>Edit placement</button>
    {editing && <ReframePlacementEditor sourceUrl={sourceUrl} settings={settings} onClose={() => setEditing(false)}
      onApply={value => { onApply(value); setEditing(false); }} />}
  </>;
}
