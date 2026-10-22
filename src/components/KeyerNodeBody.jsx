import React from "react";
import { keyerApi } from "../api/newtApi.js";
import { keyerInputError, keyerSettings, normalizeKeyerData } from "../keyer.js";
import { NodeRow, OutputPortRow } from "./NodePorts.jsx";
import { ResultPane } from "./MediaViews.jsx";
import "./keyer.css";

export function KeyerNodeBody({ node, config, source, firstHint, hintVideo, sourceConnected, onUpdate, onRun, onPreviewOpen, utilityControls, utilityModeControls, ...ports }) {
  const d = normalizeKeyerData(node.data);
  const patch = value => onUpdate(node.id, value);
  const [engine, setEngine] = React.useState(null);
  const [statusError, setStatusError] = React.useState("");
  const [refresh, setRefresh] = React.useState(0);
  React.useEffect(() => {
    let current = true;
    setStatusError("");
    keyerApi.status().then(value => { if (current) setEngine(value); }, error => { if (current) setStatusError(error.message); });
    return () => { current = false; };
  }, [refresh]);
  const busy = ["running", "uploading"].includes(d.status);
  const sourceUrl = sourceConnected ? source?.url || "" : "";
  const sourceItem = sourceUrl ? { type: "video", url: sourceUrl, label: source?.label || d.sourceVideoName || "Source" } : null;
  const results = d.resultItems;
  const selectedIndex = Math.min(Math.max(Number(d.selectedResultIndex) || 0, 0), Math.max(0, results.length - 1));
  const selected = results[selectedIndex];
  const passItems = d.keyerView === "source" ? (sourceItem ? [sourceItem] : []) : results.map(item => d.keyerView === "cutout" ? item : item.keyer?.passes?.[d.keyerView]).filter(Boolean);
  const missing = keyerInputError({ sourceVideoUrl: sourceUrl, firstHintUrl: firstHint?.url, hintVideoUrl: hintVideo?.url, settings: keyerSettings(d) });
  const canRun = !busy && (engine?.ready || engine?.canInstall) && !missing;
  const inputPorts = config.input.map(port => ({ ...port, disabled: port.id === "firstHintIn" ? d.keyerMode !== "first" : port.id === "hintVideoIn" ? d.keyerMode !== "video" : false, disabledReason: "Select the matching hint mode" }));
  function toggleVideo(open) {
    if (open === d.keyerVideoOpen) return;
    patch({ keyerVideoOpen: open, ...(open
      ? { nodeHeight: d.keyerExpandedNodeHeight, keyerExpandedNodeHeight: undefined }
      : { keyerExpandedNodeHeight: d.nodeHeight, nodeHeight: undefined }) });
  }
  return <div className="node-body model-node-body keyer-node-body">
    {utilityModeControls}
    <details className="model-settings-drawer keyer-video-section" open={d.keyerVideoOpen} onToggle={event => toggleVideo(event.currentTarget.open)}>
      <summary>Video</summary>
      {d.keyerVideoOpen && <>
    {utilityControls}
    <div className="keyer-engine"><span>CorridorKey 2.0 · Local GPU</span><button type="button" disabled={busy} aria-label="Refresh Keyer engine" onClick={() => setRefresh(n => n + 1)}>↻</button></div>
    <div className="keyer-view-tabs" role="group" aria-label="Keyer viewer">
      {[["source", "Source"], ["checker", "Checker"], ["alpha", "Matte"], ["fg", "Foreground"], ["cutout", "Cutout"]].map(([value, label]) => <button type="button" key={value} aria-pressed={d.keyerView === value} onClick={() => patch({ keyerView: value })}>{label}</button>)}
    </div>
    <ResultPane label={d.keyerView === "source" ? "Connect a source video" : "Run Keyer to see this pass"} resultItems={passItems} selectedIndex={d.keyerView === "source" ? 0 : selectedIndex} type="video" status={d.status} error={d.error}
      onSelectResult={(index) => { const item = results[index]; patch({ selectedResultIndex: index, resultUrl: item?.url || "" }); }} onPreviewOpen={onPreviewOpen}
      sourceNodeId={d.keyerView === "source" || d.keyerView === "checker" ? "" : node.id} sourcePort={{ cutout: "cutoutOut", alpha: "matteOut", fg: "foregroundOut" }[d.keyerView] || ""} />
    <div role="status" className="keyer-status">{busy ? d.status === "uploading" ? "Uploading source…" : d.keyerProgress || "Loading model…" : statusError || engine?.message || "Checking local engine…"}</div>
    {inputPorts.map(p => <NodeRow key={p.id} label={p.label} node={node} inputPort={p} {...ports}>
      <span>{p.id === "videoIn" ? sourceConnected ? source?.label || "Connected video" : "Connect a video output" : p.id === "firstHintIn" ? firstHint?.label || "Optional matte image" : hintVideo?.label || "Optional matte video"}</span>
    </NodeRow>)}
    <details className="model-settings-drawer" open={d.settingsOpen} onToggle={event => { if (event.currentTarget.open !== d.settingsOpen) patch({ settingsOpen: event.currentTarget.open }); }}>
      <summary>Settings</summary>
      <fieldset disabled={busy}>
        <NodeRow label="Hint mode"><select aria-label="Keyer hint mode" value={d.keyerMode} onChange={event => patch({ keyerMode: event.target.value })}><option value="auto">Automatic · no hint</option><option value="first">First-frame matte</option><option value="video">Full matte video</option></select></NodeRow>
        <NodeRow label="Despill"><div className="keyer-number"><input aria-label="Keyer despill" type="range" min="0" max="1" step="0.05" value={d.keyerDespill} onChange={event => patch({ keyerDespill: Number(event.target.value) })} /><output>{d.keyerDespill.toFixed(2)}</output></div></NodeRow>
        {d.keyerMode !== "auto" && <><NodeRow label="Hint trust"><input aria-label="Keyer hint trust" type="number" min="0" max="1" step="0.05" value={d.keyerHintQuality} onChange={event => patch({ keyerHintQuality: event.target.value })} /></NodeRow>
          <NodeRow label="Carry matte through time"><input aria-label="Carry matte through time" type="checkbox" checked={d.keyerCarry} onChange={event => patch({ keyerCarry: event.target.checked })} /></NodeRow></>}
        <NodeRow label="GPU memory"><select aria-label="Keyer GPU memory" value={d.keyerMemory} onChange={event => patch({ keyerMemory: event.target.value })}><option value="auto">Auto · use available VRAM</option><option value="balanced">8-frame temporal window</option><option value="low">Low VRAM · 4-frame window</option></select></NodeRow>
        <NodeRow label="Test frames"><input aria-label="Keyer test frames" type="number" min="0" max="1000000" step="1" value={d.keyerFrameLimit} onChange={event => patch({ keyerFrameLimit: event.target.value })} /></NodeRow>
        <p className="utility-model-description">0 = full clip. Use sRGB/Rec.709 video. Cutout carries straight alpha; source audio is omitted.</p>
      </fieldset>
    </details>
    {selected?.keyer && <small className="keyer-status">Last key: {selected.keyer.settings.mode} · despill {selected.keyer.settings.despill} · {selected.keyer.settings.frameLimit ? `${selected.keyer.settings.frameLimit} frame limit` : "full clip"}</small>}
      </>}
    </details>
    {!d.keyerVideoOpen && <>
      <small className="keyer-status">CorridorKey 2.0 · {busy ? d.keyerProgress || "Processing…" : "Local GPU"}</small>
      {inputPorts.map(p => <NodeRow key={p.id} label={p.label} node={node} inputPort={p} {...ports}><span /></NodeRow>)}
      {d.error && <p className="utility-model-description" role="alert">{d.error}</p>}
    </>}
    {config.output.map(p => <OutputPortRow key={p.id} node={node} port={p} {...ports} />)}
    <button className="run-node-button" disabled={!canRun} title={missing || engine?.message || "Run local keying"} onClick={() => onRun({ ...node, data: { ...node.data, keyerAction: "run" } })}>{busy ? "Keying…" : engine?.canInstall && !engine?.ready ? "Install & Run Keyer" : d.keyerFrameLimit ? `Test key · first ${d.keyerFrameLimit} frames` : "Run Keyer"}</button>
    {!busy && d.keyerJobId && <button type="button" className="run-node-button" onClick={() => onRun({ ...node, data: { ...node.data, keyerAction: "reconnect" } })}>Reconnect to previous key</button>}
  </div>;
}
