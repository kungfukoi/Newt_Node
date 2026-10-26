import React from "react";
import { canvasPreference, saveCanvasPreference } from "../canvasPreferences.js";

export function CanvasPreferences() {
  const [wheel, setWheel] = React.useState(() => canvasPreference("wheelBehavior", "zoom"));
  const [motion, setMotion] = React.useState(() => canvasPreference("canvasMotion", "on"));
  const [scrub, setScrub] = React.useState(() => canvasPreference("hoverScrub", "on"));
  return <details className="canvas-preferences"><summary title="Canvas preferences">Canvas options</summary><div>
    <label>Mouse wheel <select aria-label="Mouse wheel behavior" value={wheel} onChange={e => { setWheel(e.target.value); saveCanvasPreference("wheelBehavior", e.target.value); }}><option value="zoom">Zoom</option><option value="pan">Pan</option></select></label>
    <label><input type="checkbox" checked={motion === "on"} onChange={e => { const value = e.target.checked ? "on" : "off"; setMotion(value); saveCanvasPreference("canvasMotion", value); }} /> Smooth canvas motion</label>
    <label><input type="checkbox" checked={scrub === "on"} onChange={e => { const value = e.target.checked ? "on" : "off"; setScrub(value); saveCanvasPreference("hoverScrub", value); }} /> Hover to scrub videos</label>
  </div></details>;
}
