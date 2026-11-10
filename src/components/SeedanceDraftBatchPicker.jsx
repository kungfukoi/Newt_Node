import { useState } from "react";
import { seedanceVersion } from "../seedanceDraft.js";

export function SeedanceDraftBatchPicker({ drafts, running, onFinish }) {
  const [selection, setSelection] = useState([]);
  const receiptIds = drafts.map(item => item.seedanceDraft.receiptId);
  const selected = receiptIds.filter(id => selection.includes(id));

  return (
    <details className="seedance-draft-batch nodrag nopan" onPointerDown={event => event.stopPropagation()}>
      <summary>Finish multiple drafts ({drafts.length} available)</summary>
      <div className="seedance-draft-batch-list">
        {drafts.map(item => {
          const id = item.seedanceDraft.receiptId;
          const { name } = seedanceVersion(item);
          return <label key={id} title={name}>
            <input type="checkbox" checked={selected.includes(id)} disabled={running} onChange={event => {
              setSelection(event.target.checked ? [...selected, id] : selected.filter(value => value !== id));
            }} />
            <span>{name}</span>
          </label>;
        })}
      </div>
      <div className="seedance-draft-actions">
        <button type="button" disabled={running || !drafts.length} onClick={() => setSelection(selected.length === drafts.length ? [] : receiptIds)}>
          {selected.length === drafts.length ? "Clear selection" : "Select all"}
        </button>
        <button type="button" disabled={running || !selected.length} onClick={() => onFinish(selected)}
          title="Each selected draft is finished and billed separately using its original provider and key.">
          Finish selected at 1080p ({selected.length})
        </button>
      </div>
    </details>
  );
}
