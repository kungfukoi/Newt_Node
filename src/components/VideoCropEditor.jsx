import React from "react";
import { createPortal } from "react-dom";
import { displayMediaUrl } from "../mediaAssets.js";
import { videoCropRect, videoCropSettings, constrainVideoCrop, dragVideoCrop } from "../videoCrop.js";
import "./VideoCropEditor.css";

export default function VideoCropEditor({ sourceUrl, settings, onSettingsChange }) {
  const [expanded, setExpanded] = React.useState(false);
  const [aspect, setAspect] = React.useState(16 / 9);
  const [dimensions, setDimensions] = React.useState({ width: 1920, height: 1080 });
  const stage = React.useRef(null);
  const drag = React.useRef(null);
  const rect = constrainVideoCrop(videoCropRect(settings), settings, dimensions);
  const mode = settings.cropMode || "normal";
  function changeMode(patch) {
    const next = { ...settings, ...patch };
    onSettingsChange({ ...patch, ...videoCropSettings(constrainVideoCrop(rect, next, dimensions)) });
  }
  React.useEffect(() => {
    if (!expanded) return;
    const close = event => { if (event.key === "Escape") { event.stopPropagation(); setExpanded(false); } };
    document.addEventListener("keydown", close, true);
    return () => document.removeEventListener("keydown", close, true);
  }, [expanded]);
  function start(event, handle) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const bounds = stage.current.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, bounds, rect, handle };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if (!drag.current) return;
    const initial = drag.current;
    onSettingsChange(videoCropSettings(dragVideoCrop(initial.rect, initial.handle,
      (event.clientX - initial.x) / initial.bounds.width * 100,
      (event.clientY - initial.y) / initial.bounds.height * 100, settings, dimensions)));
  }
  const editor = <div className="video-crop-editor nodrag nowheel" onPointerDown={event => event.stopPropagation()}>
    <div className="video-crop-toolbar">
      <label>Style <select aria-label="Crop style" value={mode} onChange={event => changeMode({ cropMode: event.target.value })}>
        <option value="normal">Normal</option><option value="ratio">Fixed Ratio</option><option value="size">Fixed Size</option>
      </select></label>
      {mode !== "normal" && <>
        <label>Width {mode === "size" ? "(px)" : ""}<input aria-label="Crop fixed width" type="number" min={mode === "size" ? 2 : 0.01} step={mode === "size" ? 2 : 0.01} max={mode === "size" ? dimensions.width : undefined} value={mode === "size" ? settings.cropPixelWidth || 640 : settings.cropRatioWidth || 1} onChange={event => changeMode({ [mode === "size" ? "cropPixelWidth" : "cropRatioWidth"]: Number(event.target.value) })} /></label>
        <button type="button" aria-label="Swap crop width and height" onClick={() => changeMode(mode === "size" ? { cropPixelWidth: settings.cropPixelHeight || 360, cropPixelHeight: settings.cropPixelWidth || 640 } : { cropRatioWidth: settings.cropRatioHeight || 1, cropRatioHeight: settings.cropRatioWidth || 1 })}>⇄</button>
        <label>Height {mode === "size" ? "(px)" : ""}<input aria-label="Crop fixed height" type="number" min={mode === "size" ? 2 : 0.01} step={mode === "size" ? 2 : 0.01} max={mode === "size" ? dimensions.height : undefined} value={mode === "size" ? settings.cropPixelHeight || 360 : settings.cropRatioHeight || 1} onChange={event => changeMode({ [mode === "size" ? "cropPixelHeight" : "cropRatioHeight"]: Number(event.target.value) })} /></label>
      </>}
      <button type="button" disabled={!sourceUrl} onClick={() => setExpanded(!expanded)}>{expanded ? "Done" : "Enlarge video crop"}</button>
      <button type="button" onClick={() => onSettingsChange(videoCropSettings(constrainVideoCrop(videoCropRect({}), settings, dimensions)))}>Reset crop</button>
    </div>
    {sourceUrl ? <>
      <div className="video-crop-stage" ref={stage} style={{ aspectRatio: aspect, "--video-aspect": aspect }}>
        <video key={sourceUrl} src={displayMediaUrl(sourceUrl)} muted playsInline preload="metadata" onLoadedMetadata={event => { setAspect(event.currentTarget.videoWidth / event.currentTarget.videoHeight || 16 / 9); setDimensions({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight }); }} />
        <div className="video-crop-region" aria-label="Video crop region" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
          onPointerDown={event => start(event, "move")} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          {mode !== "size" && ["nw", "ne", "sw", "se"].map(handle => <span key={handle} className={`video-crop-handle ${handle}`} aria-label={`Resize crop ${handle}`} onPointerDown={event => start(event, handle)} />)}
        </div>
      </div>
      <div className="video-crop-toolbar">
        <button type="button" onClick={() => { const video = stage.current.querySelector("video"); if (video.paused) video.play().catch(() => {}); else video.pause(); }}>Play / Pause</button>
        <label>Frame <input aria-label="Video crop frame" type="range" min="0" max="1000" defaultValue="0" onChange={event => { const video = stage.current.querySelector("video"); video.pause(); if (Number.isFinite(video.duration)) video.currentTime = video.duration * Number(event.target.value) / 1000; }} /></label>
      </div>
    </> : <p>Connect a video to position the crop.</p>}
    <div className="video-crop-fields">{[["x", "Left"], ["y", "Top"], ["width", "Width"], ["height", "Height"]].map(([key, label]) => <label key={key}>{label} %<input aria-label={`Crop ${label.toLowerCase()} percent`} type="number" disabled={mode === "size" && (key === "width" || key === "height")} min={key === "width" || key === "height" ? 1 : 0} max="100" step="0.1" value={Number(rect[key].toFixed(2))} onChange={event => onSettingsChange(videoCropSettings(constrainVideoCrop({ ...rect, [key]: Number(event.target.value) }, settings, dimensions, key)))} /></label>)}</div>
  </div>;
  return expanded ? createPortal(<div className="video-crop-overlay"><div className="video-crop-dialog" role="dialog" aria-modal="true" aria-label="Video crop"><h2>Video crop</h2>{editor}</div></div>, document.body) : editor;
}
