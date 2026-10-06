import React from "react";
import { displayMediaUrl, previewImageUrl } from "../mediaAssets.js";
export function StoryboardPanelHistory({ frame, busy, onProtect, onRestore }) {
  const versions = frame.versions || [];
  return <div className="storyboard-panel-history nodrag nowheel" onClick={e => e.stopPropagation()}>
    <button type="button" aria-pressed={Boolean(frame.protected)} disabled={busy} onClick={onProtect}>{frame.protected ? "Unprotect panel" : "Protect panel"}</button>
    {versions.length > 0 && <details><summary>Previous versions ({versions.length})</summary>
      {[...versions].reverse().map((version, i) => <div className="storyboard-panel-version" key={versions.length - i - 1}>
        <img src={displayMediaUrl(previewImageUrl(version.exportUrl || version.resultUrl))} alt={"Previous panel version " + (versions.length-i)} loading="lazy" />
        <span>{version.shot} · {version.lens}<small>{version.prompt}</small></span>
        <button type="button" disabled={busy || frame.protected} aria-label={"Restore panel " + frame.number + " version " + (versions.length-i)} onClick={() => onRestore(versions.length-i-1)}>Restore</button>
      </div>)}
    </details>}
  </div>;
}
