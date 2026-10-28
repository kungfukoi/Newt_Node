import React from "react";
import { canvasPreference, saveCanvasPreference } from "../canvasPreferences.js";
import { useCanvasPreference } from "../useCanvasPreference.js";

export function CanvasPreferences() {
  const [wheel, setWheel] = React.useState(() => canvasPreference("wheelBehavior", "zoom"));
  const [motion, setMotion] = React.useState(() => canvasPreference("canvasMotion", "on"));
  const [scrub, setScrub] = React.useState(() => canvasPreference("hoverScrub", "on"));
  const shadows = useCanvasPreference("canvasShadows", "on");
  return <>
    <label className="settings-preference-model">
      <span><strong>Mouse wheel behavior</strong><small>Zoom or pan the node canvas with the mouse wheel. Changes apply immediately.</small></span>
      <select aria-label="Mouse wheel behavior" value={wheel} onChange={e => { setWheel(e.target.value); saveCanvasPreference("wheelBehavior", e.target.value); }}><option value="zoom">Zoom</option><option value="pan">Pan</option></select>
    </label>
    <label className={`settings-preference-toggle ${motion === "on" ? "enabled" : ""}`}>
      <span><strong>Smooth canvas motion</strong><small>Ease canvas zoom and let panning glide on release. Changes apply immediately.</small></span>
      <input aria-label="Smooth canvas motion" type="checkbox" checked={motion === "on"} onChange={e => { const value = e.target.checked ? "on" : "off"; setMotion(value); saveCanvasPreference("canvasMotion", value); }} />
      <span className="node-toggle compact" aria-hidden="true"><span /></span>
    </label>
    <label className={`settings-preference-toggle ${shadows === "on" ? "enabled" : ""}`}>
      <span><strong>Canvas shadows</strong><small>Show shadows on nodes, groups, and selected wires. Turn off to reduce rendering work. Changes apply immediately.</small></span>
      <input aria-label="Canvas shadows" type="checkbox" checked={shadows === "on"} onChange={e => saveCanvasPreference("canvasShadows", e.target.checked ? "on" : "off")} />
      <span className="node-toggle compact" aria-hidden="true"><span /></span>
    </label>
    <label className={`settings-preference-toggle ${scrub === "on" ? "enabled" : ""}`}>
      <span><strong>Hover to scrub videos</strong><small>Move across a paused node video to preview its frames. Changes apply immediately.</small></span>
      <input aria-label="Hover to scrub videos" type="checkbox" checked={scrub === "on"} onChange={e => { const value = e.target.checked ? "on" : "off"; setScrub(value); saveCanvasPreference("hoverScrub", value); }} />
      <span className="node-toggle compact" aria-hidden="true"><span /></span>
    </label>
  </>;
}
