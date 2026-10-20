import VideoOutpaintCanvasEditor from "./VideoOutpaintCanvasEditor.jsx";
import { outpaintRatio } from "../videoOutpaintFrame.js";
import React from "react";
import { NodeRow } from "./NodePorts.jsx";
import { VideoOutpaintPromptControls } from "./VideoOutpaintPromptControls.jsx";
import { normalizeVideoOutpaintSettings, videoOutpaintRatios, videoOutpaintFingerprint } from "../videoOutpaint.js";

export function VideoOutpaintControls({ node, sourceVideoUrl, promptConnected, running, onUpdate, onPrepare, onAnalyze, referenceImagePort, settingsOpen, incoming, portProps }) {
  const settings = normalizeVideoOutpaintSettings(node.data.videoOutpaint);
  const key = videoOutpaintFingerprint(sourceVideoUrl, settings);
  const prepared = node.data.videoOutpaintPrepared?.fingerprint === key ? node.data.videoOutpaintPrepared : null;
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => setEditing(false), [sourceVideoUrl]);
  const [notice, setNotice] = React.useState("");
  const current = React.useRef(key);
  current.current = key;
  React.useEffect(() => () => { current.current = null; }, []);
  const change = patch => {
    if (patch.aspectRatio && settings.frame) patch = { ...patch, frame: { ...settings.frame, y: settings.frame.y + settings.frame.width / outpaintRatio(settings.aspectRatio) / 2 - settings.frame.width / outpaintRatio(patch.aspectRatio) / 2 } };
    onUpdate(node.id, { videoOutpaint: { ...settings, ...patch }, videoOutpaintPrepared: null });
  };
  async function prepare(overrides) {
    if (busy || running || !sourceVideoUrl) return;
    const nextSettings = normalizeVideoOutpaintSettings(overrides || settings);
    const snapshot = videoOutpaintFingerprint(sourceVideoUrl, nextSettings);
    current.current = snapshot;
    setBusy(true); setNotice("");
    try {
      const result = await onPrepare(node, { sourceVideoUrl, videoOutpaint: nextSettings });
      if (current.current === snapshot) onUpdate(node.id, { videoOutpaintPrepared: result });
      else if (current.current !== null) setNotice("Source or settings changed. Prepare the current canvas again.");
    } catch (error) { if (current.current !== null) setNotice(error.message); }
    finally { if (current.current !== null) setBusy(false); }
  }
  return <>
    <p className="utility-mini-note">Fal Wan VACE · edit the output frame, prepare the canvas, refine the prompt, then Run.</p>
    <NodeRow label="Target ratio"><select aria-label="Outpaint target ratio" value={settings.aspectRatio} disabled={busy || running} onChange={e => change({ aspectRatio: e.target.value })}>{videoOutpaintRatios.map(ratio => <option key={ratio}>{ratio}</option>)}</select></NodeRow>
    <NodeRow label="Start (sec)"><input aria-label="Outpaint start seconds" type="number" min="0" step="0.125" value={settings.start} disabled={busy || running} onChange={e => change({ start: e.target.value })} /></NodeRow>
    <NodeRow label="Duration (sec)"><input aria-label="Outpaint duration seconds" type="number" min="2.7" max="10.05" step="0.125" value={settings.duration} disabled={busy || running} onChange={e => change({ duration: e.target.value })} /></NodeRow>
    <NodeRow label="Canvas"><button type="button" disabled={busy || running || !sourceVideoUrl || !onPrepare} onClick={() => prepare()}>{busy ? "Preparing canvas…" : "Prepare canvas & mask"}</button></NodeRow>
    <NodeRow label="Framing"><button type="button" disabled={busy || running || !sourceVideoUrl} onClick={() => setEditing(true)}>Canvas Edit</button></NodeRow>
    {editing && <VideoOutpaintCanvasEditor key={sourceVideoUrl} sourceUrl={sourceVideoUrl} settings={settings} snapEnabled={node.data.videoOutpaintSnap !== false} onSnapChange={value => onUpdate(node.id, { videoOutpaintSnap: value })} onClose={() => setEditing(false)} onApply={frame => { const next = { ...settings, frame }; change({ frame }); setEditing(false); prepare(next); }} />}
    {notice && <p className="utility-mini-note" role="status">{notice}</p>}
    {prepared && <>
      <video aria-label="Prepared outpainting canvas" controls muted preload="metadata" poster={prepared.previewUrl} src={prepared.videoUrl} style={{ width: "100%", maxHeight: 320, objectFit: "contain" }} />
      <p className="utility-mini-note">{prepared.plan.needsOutpaint === false ? "Frame covered by source: Run exports this crop locally without paid video generation." : "Black canvas areas will be generated."} {prepared.plan.frames} frames at {prepared.plan.fps} fps ({prepared.plan.duration.toFixed(3)} sec). <a href={prepared.maskVideoUrl} target="_blank" rel="noreferrer">View expansion mask</a></p>
    </>}
    {prepared?.plan.needsOutpaint !== false && <VideoOutpaintPromptControls node={{ ...node, data: { ...node.data, wanVaceAspectRatio: settings.aspectRatio } }} sourceVideoUrl={prepared?.videoUrl || ""} maskVideoUrl={prepared?.maskVideoUrl || ""} promptConnected={promptConnected} running={running || busy} onUpdate={onUpdate} onAnalyze={onAnalyze} />}
    {!prepared && <p className="utility-mini-note">Prepare the canvas to enable automatic prompt analysis. Manual prompts can Run directly; canvas and mask are prepared automatically.</p>}
    <NodeRow label="Reference image" inputPort={settingsOpen ? referenceImagePort : null} node={node} {...portProps}><span className="utility-mini-note">{incoming.referenceImageIn?.length ? "Reference connected" : "Optional composition / person reference"}</span></NodeRow>
    <NodeRow label="Restore source"><input aria-label="Restore original source footage" type="checkbox" checked={settings.restoreSource} disabled={busy || running} onChange={e => change({ restoreSource: e.target.checked })} /></NodeRow>
    <NodeRow label="Seam feather"><input aria-label="Outpaint seam feather" type="number" min="0" max="32" step="1" value={settings.feather} disabled={busy || running} onChange={e => change({ feather: e.target.value })} /></NodeRow>
    <NodeRow label="Delivery size"><select aria-label="Outpaint delivery size" value={settings.outputSize} disabled={busy || running} onChange={e => change({ outputSize: e.target.value })}><option>720p</option><option>1080p</option></select></NodeRow>
    <NodeRow label="Steps"><input aria-label="Outpaint inference steps" type="number" min="1" max="60" value={node.data.wanVaceNumInferenceSteps ?? 30} onChange={e => onUpdate(node.id, { wanVaceNumInferenceSteps: e.target.value })} disabled={running} /></NodeRow>
    <NodeRow label="Guidance scale"><input aria-label="Outpaint guidance scale" type="number" min="0" max="20" step="0.5" value={node.data.wanVaceGuidanceScale ?? 5} onChange={e => onUpdate(node.id, { wanVaceGuidanceScale: e.target.value })} disabled={running} /></NodeRow>
    <NodeRow label="Seed"><input aria-label="Outpaint seed" value={node.data.seed ?? ""} placeholder="Random" onChange={e => onUpdate(node.id, { seed: e.target.value })} disabled={running} /></NodeRow>
    <NodeRow label="Negative"><textarea aria-label="Outpaint negative prompt" value={node.data.wanVaceNegativePrompt || ""} onChange={e => onUpdate(node.id, { wanVaceNegativePrompt: e.target.value })} disabled={running} /></NodeRow>
    <p className="utility-mini-note">8-bit SDR output. Generated borders may be upscaled for delivery. Outpainting and prompt analysis are paid actions; crop-only export is local. Existing results stay available while you refine.</p>
    {(node.data.resultItems || []).at(node.data.selectedResultIndex || 0)?.videoOutpaint?.rawVideoUrl && <a className="utility-mini-note" href={node.data.resultItems[node.data.selectedResultIndex || 0].videoOutpaint.rawVideoUrl} target="_blank" rel="noreferrer">{node.data.resultItems[node.data.selectedResultIndex || 0].videoOutpaint.localCrop ? "View prepared crop" : "View raw generated result"}</a>}
    {(node.data.resultItems || []).at(node.data.selectedResultIndex || 0)?.warning && <p className="utility-mini-note" role="alert">{node.data.resultItems[node.data.selectedResultIndex || 0].warning}</p>}
  </>;
}
