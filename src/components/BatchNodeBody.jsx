import React from "react";
import { batchEntries } from "../batch.js";
import { NodeRow, OutputPortRow } from "./NodePorts.jsx";
import "./BatchNodeBody.css";

export default function BatchNodeBody({ node, incoming, config, onUpdate, onUpload, onOutputImport, parseOutputDrop, resolve, ...ports }) {
  const entries = batchEntries(node, [...(incoming.imageIn || []), ...(incoming.videoIn || [])], resolve);
  const busy = node.data.status === "uploading";
  const [active, setActive] = React.useState("");
  const entry = entries.find(item => item.id === active);
  function upload(files) { onUpload(node, Array.from(files)); }
  return <div className="node-body batch-body nodrag nowheel" onDragOver={event => { event.preventDefault(); event.stopPropagation(); }} onDrop={event => {
    event.preventDefault(); event.stopPropagation();
    if (busy) return;
    const item = parseOutputDrop?.(event.dataTransfer);
    if (item) onOutputImport(node, item);
    else if (event.dataTransfer.files.length) upload(event.dataTransfer.files);
  }}>
    {config.input.map(port => <NodeRow key={port.id} label={port.label} inputPort={port} node={node} {...ports}><span>{entries.length} entries</span></NodeRow>)}
    <div className="batch-entry-list">
      {entries.map((item, index) => <div className={`batch-entry ${active === item.id ? "active" : ""}`} key={item.id}>
        <button className="batch-entry-select" aria-label={`Edit prompt for ${item.label}`} aria-pressed={active === item.id} onClick={() => setActive(active === item.id ? "" : item.id)} title={item.label}>
          {item.url ? item.type === "video" ? <video src={item.url} poster={item.thumbnailUrl || undefined} muted playsInline preload="metadata" draggable={false} /> : <img src={item.url} alt="" draggable={false} /> : <span className="batch-missing">?</span>}
          <span className="batch-entry-caption"><strong>{item.label}</strong><small>{item.prompt || `${String(index + 1).padStart(2, "0")}${item.url ? "" : " · Missing image"}`}</small></span>
        </button>
        <button className="batch-entry-remove" aria-label={`Remove ${item.label} from batch`} onClick={() => onUpdate(node.id, { batchRemoveEntry: item.id })}>×</button>
      </div>)}
      {!entries.length && <p>Drop images or videos here.</p>}
    </div>
    {entry && <label className="batch-prompt-editor">Prompt for {entry.label}<textarea aria-label="Entry prompt" placeholder="Optional direction added to the connected node's prompt" value={entry.prompt || ""} onChange={event => onUpdate(node.id, { batchSettings: { ...node.data.batchSettings, [entry.id]: { prompt: event.target.value } } })} /></label>}
    {node.data.error && <p role="alert">{node.data.error}</p>}
    <OutputPortRow node={node} port={config.output[0]} {...ports} label="Batch output" />
  </div>;
}
