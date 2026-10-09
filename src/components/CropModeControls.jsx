import React from "react";
import "./VideoCropEditor.css";

export default function CropModeControls({ settings, dimensions, onChange }) {
  const mode = settings.cropMode || "normal";
  const widthKey = mode === "size" ? "cropPixelWidth" : "cropRatioWidth";
  const heightKey = mode === "size" ? "cropPixelHeight" : "cropRatioHeight";
  const width = settings[widthKey] || (mode === "size" ? 640 : 1);
  const height = settings[heightKey] || (mode === "size" ? 360 : 1);
  return <div className="video-crop-toolbar">
    <label>Style <select aria-label="Crop style" value={mode} onChange={event => onChange({ cropMode: event.target.value })}><option value="normal">Normal</option><option value="ratio">Fixed Ratio</option><option value="size">Fixed Size</option></select></label>
    {mode !== "normal" && <>
      <label>Width {mode === "size" ? "(px)" : ""}<input aria-label="Crop fixed width" type="number" min={mode === "size" ? 1 : 0.01} step={mode === "size" ? 1 : 0.01} max={mode === "size" ? dimensions.width : undefined} value={width} onChange={event => onChange({ [widthKey]: Number(event.target.value) })} /></label>
      <button type="button" aria-label="Swap crop width and height" onClick={() => onChange({ [widthKey]: height, [heightKey]: width })}>⇄</button>
      <label>Height {mode === "size" ? "(px)" : ""}<input aria-label="Crop fixed height" type="number" min={mode === "size" ? 1 : 0.01} step={mode === "size" ? 1 : 0.01} max={mode === "size" ? dimensions.height : undefined} value={height} onChange={event => onChange({ [heightKey]: Number(event.target.value) })} /></label>
    </>}
  </div>;
}
