import React from "react";
export function StoryboardRevisionControls({ node, frames, busy, onUpdate, onRevise }) {
  const ids = (node.data.storyboardSelectedFrameIds || []).filter(id => frames.some(f => f.id === id));
  if (!ids.length) return <small className="storyboard-revision-hint">Select panels to revise their directions and images together.</small>;
  const instruction = node.data.storyboardRevisionInstruction || "";
  return <section className="storyboard-revision-controls nodrag nowheel">
    <span>{ids.length} panel{ids.length === 1 ? "" : "s"} selected</span>
    <button type="button" disabled={busy} onClick={() => onUpdate(node.id, { storyboardSelectedFrameIds: [] })}>Clear selection</button>
    <textarea aria-label="Selected panel revision" placeholder="Describe changes for the selected panels" value={instruction} maxLength={8000} disabled={busy} onChange={e => onUpdate(node.id, { storyboardRevisionInstruction: e.target.value })} />
    <button type="button" disabled={busy || ids.length > 8 || !instruction.trim()} onClick={() => onRevise(node, ids, instruction)}>{node.data.status === "revising" ? "Revising directions..." : "Revise Selected"}</button>
    {ids.length > 8 && <small>Select up to eight panels per revision.</small>}
    {node.data.storyboardRevisionWarning && <small role="status">{node.data.storyboardRevisionWarning}</small>}
  </section>;
}
