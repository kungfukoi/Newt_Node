import { storyboardReviewSignature } from "../storyboardSequenceReview.js";
import React from "react";
export function StoryboardRevisionControls({ node, frames, busy, onUpdate, onRevise, onReview }) {
  const ids = (node.data.storyboardSelectedFrameIds || []).filter(id => frames.some(f => f.id === id));
  const review = node.data.storyboardSequenceReview;
  const stale = review && review.signature !== storyboardReviewSignature(frames, node.data.storyboardBoardUrl || "");
  const instruction = node.data.storyboardRevisionInstruction || "";
  return <section className="storyboard-revision-controls nodrag nowheel">
    <button type="button" disabled={busy || !frames.length} onClick={() => onReview(node)}>{node.data.status === "reviewing-sequence" ? "Reviewing sequence..." : "Review Sequence"}</button>
    {review && <details open><summary>Sequence review{review.directionsOnly ? " (directions only)" : ""}{stale ? " — panels changed; review again" : ""}</summary><p>{review.summary}</p><ul>{review.issues.map((issue,index) => <li key={index}>{issue.frameIds.length ? "Panels " + issue.frameIds.map(id => frames.find(frame => frame.id === id)?.number || id).join(", ") + ": " : ""}{issue.message}</li>)}</ul><small>Advisory only. No panels were changed.</small></details>}
    {!ids.length && <small>Select panels to revise their directions and images together.</small>}
    {!!ids.length && <><span>{ids.length} panel{ids.length === 1 ? "" : "s"} selected</span>
    <button type="button" disabled={busy} onClick={() => onUpdate(node.id, { storyboardSelectedFrameIds: [] })}>Clear selection</button>
    <textarea aria-label="Selected panel revision" placeholder="Describe changes for the selected panels" value={instruction} maxLength={8000} disabled={busy} onChange={e => onUpdate(node.id, { storyboardRevisionInstruction: e.target.value })} />
    <button type="button" disabled={busy || ids.length > 8 || ids.some(id => frames.find(f => f.id === id)?.protected) || !instruction.trim()} onClick={() => onRevise(node, ids, instruction)}>{node.data.status === "revising" ? "Revising directions..." : "Revise Selected"}</button>
    {ids.length > 8 && <small>Select up to eight panels per revision.</small>}</>}
    {node.data.storyboardRevisionWarning && <small role="status">{node.data.storyboardRevisionWarning}</small>}
  </section>;
}
