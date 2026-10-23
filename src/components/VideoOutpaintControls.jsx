import VideoOutpaintCanvasEditor from "./VideoOutpaintCanvasEditor.jsx";
import { outpaintRatio } from "../videoOutpaintFrame.js";
import React from "react";
import { OutpaintQcStatus } from "./OutpaintQcStatus.jsx";
import { displayMediaUrl } from "../mediaAssets.js";
import { NodeRow } from "./NodePorts.jsx";
import { VideoOutpaintPromptControls } from "./VideoOutpaintPromptControls.jsx";
import { outpaintReferenceRoles } from "../outpaintReferences.js";
import { outpaintCanRefinish, outpaintNeedsFinishing, outpaintOutputError } from "../outpaintQuality.js";
import { normalizeUtilityOutpaintSettings, videoOutpaintRatios, videoOutpaintFingerprint, videoOutpaintModels } from "../videoOutpaint.js";

export function VideoOutpaintModelControl({ node, running, onUpdate }) {
  const settings = normalizeUtilityOutpaintSettings(node.data.videoOutpaint);
  return <NodeRow label="Outpaint model"><select aria-label="Outpaint model" value={settings.model} disabled={running} onChange={e => onUpdate(node.id, { videoOutpaint: { ...settings, model: e.target.value }, videoOutpaintPrepared: null })}>{videoOutpaintModels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></NodeRow>;
}

export function VideoOutpaintControls({ node, sourceVideoUrl, canvasVideoUrl = "", canvasPort, referenceImageUrls = [], promptConnected, running, onUpdate, onPrepare, onAnalyze, referenceImagePort, settingsOpen, incoming, portProps, generationScope }) {
  const settings = normalizeUtilityOutpaintSettings(node.data.videoOutpaint);
  const seedance = settings.model === "seedance-2.5";
  const key = videoOutpaintFingerprint(sourceVideoUrl, settings, canvasVideoUrl);
  const prepared = node.data.videoOutpaintPrepared?.fingerprint === key ? node.data.videoOutpaintPrepared : null;
  const selected = (node.data.resultItems || []).at(node.data.selectedResultIndex || 0);
  const details = selected?.videoOutpaint;
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => setEditing(false), [sourceVideoUrl, canvasVideoUrl]);
  const [notice, setNotice] = React.useState("");
  const latestNode = React.useRef(node);
  latestNode.current = node;
  const current = React.useRef(key);
  current.current = key;
  React.useEffect(() => () => { current.current = null; }, []);
  const change = patch => {
    if (patch.aspectRatio && settings.frame) patch = { ...patch, frame: { ...settings.frame, y: settings.frame.y + settings.frame.width / outpaintRatio(settings.aspectRatio) / 2 - settings.frame.width / outpaintRatio(patch.aspectRatio) / 2 } };
    onUpdate(node.id, { videoOutpaint: { ...settings, ...patch }, videoOutpaintPrepared: null });
  };
  async function prepare(overrides) {
    if (busy || running || !(sourceVideoUrl || canvasVideoUrl)) return;
    const nextSettings = normalizeUtilityOutpaintSettings(overrides || settings);
    const snapshot = videoOutpaintFingerprint(sourceVideoUrl, nextSettings, canvasVideoUrl);
    current.current = snapshot;
    setBusy(true); setNotice("");
    try {
      const result = await onPrepare(node, { sourceVideoUrl, canvasVideoUrl, videoOutpaint: nextSettings });
      if (current.current === snapshot) onUpdate(node.id, { videoOutpaintPrepared: result });
      else if (current.current !== null) setNotice("Source or settings changed. Prepare the current canvas again.");
    } catch (error) { if (current.current !== null) setNotice(error.message); }
    finally { if (current.current !== null) setBusy(false); }
  }
  async function refinish() {
    if (busy || running || !onPrepare || !outpaintCanRefinish(selected, settings, canvasVideoUrl || sourceVideoUrl)) return;
    const snapshot = key, items = node.data.resultItems;
    setBusy(true); setNotice("");
    try {
      const item = await onPrepare(node, { rawVideoUrl: details.rawVideoUrl, prepared: details.prepared, videoOutpaint: settings });
      if (current.current !== snapshot || latestNode.current.data.resultItems !== items) {
        if (current.current !== null) setNotice("Inputs or results changed. Local finish is retained in History.");
        return;
      }
      const resultItems = [...(items || []), item];
      const rejected = outpaintNeedsFinishing(item);
      onUpdate(node.id, { resultItems, selectedResultIndex: resultItems.length - 1, resultUrl: item.url, resultType: "video", status: rejected ? "error" : "complete", error: rejected ? outpaintOutputError(item) : "" });
      setNotice(item.videoOutpaint?.matching?.colorMatching?.reason || (item.videoOutpaint?.matching?.applied ? "Extension color matched. No new generation submitted." : "Local finish complete. No new generation submitted."));
    } catch (error) { if (current.current !== null) setNotice(error.message); }
    finally { if (current.current !== null) setBusy(false); }
  }
  return <>
    <NodeRow label="Target ratio">{canvasVideoUrl ? <span>{prepared?.plan.settings.aspectRatio || "From connected canvas"}</span> : <select aria-label="Outpaint target ratio" value={settings.aspectRatio} disabled={busy || running || Boolean(canvasVideoUrl)} onChange={e => change({ aspectRatio: e.target.value })}>{videoOutpaintRatios.map(ratio => <option key={ratio}>{ratio}</option>)}</select>}</NodeRow>
    <NodeRow label="Start (sec)"><input aria-label="Outpaint start seconds" type="number" min="0" step="0.125" value={settings.start} disabled={busy || running} onChange={e => change({ start: e.target.value })} /></NodeRow>
    {prepared && <p className="utility-mini-note">{seedance ? `${prepared.plan.outputFrames} source frames per copy · ${(prepared.plan.sourceFps || prepared.plan.fps).toFixed(3)} fps · ${prepared.plan.outputDuration.toFixed(3)} seconds` : `${prepared.plan.frames} frames · ${prepared.plan.duration.toFixed(3)} seconds`}</p>}
    <NodeRow label="Framing"><button className="outpaint-user-action" type="button" disabled={busy || running || !sourceVideoUrl || Boolean(canvasVideoUrl)} onClick={() => setEditing(true)}>Canvas Edit</button></NodeRow>
    <NodeRow label="Canvas" inputPort={settingsOpen ? canvasPort : null} node={node} {...portProps}><button className="outpaint-user-action" type="button" title="Prepare the source canvas and black-and-white expansion mask locally. The selected outpaint model performs the fill." disabled={busy || running || !(sourceVideoUrl || canvasVideoUrl) || !onPrepare} onClick={() => prepare()}>{busy ? "Preparing canvas…" : canvasVideoUrl ? "Prepare supplied canvas & mask" : "Prepare canvas & mask"}</button></NodeRow>
    {canvasVideoUrl && <p className="utility-mini-note">Connected canvas supplies framing. Rectangular black outer borders define the fill.</p>}
    {editing && <VideoOutpaintCanvasEditor key={sourceVideoUrl} sourceUrl={sourceVideoUrl} settings={settings} snapEnabled={node.data.videoOutpaintSnap !== false} onSnapChange={value => onUpdate(node.id, { videoOutpaintSnap: value })} onClose={() => setEditing(false)} onApply={frame => { const next = { ...settings, frame }; change({ frame }); setEditing(false); prepare(next); }} />}
    {notice && <p className="utility-mini-note" role="alert">{notice}</p>}
    {prepared && <>
      <video aria-label="Prepared outpainting canvas" controls muted preload="metadata" poster={prepared.previewUrl} src={displayMediaUrl(prepared.generationVideoUrl || prepared.videoUrl)} style={{ width: "100%", maxHeight: 320, objectFit: "contain" }} />
      {!seedance && <a className="utility-mini-note" href={prepared.maskVideoUrl} target="_blank" rel="noreferrer">View expansion mask</a>}
    </>}
    {prepared?.plan.needsOutpaint !== false && <VideoOutpaintPromptControls node={{ ...node, data: { ...node.data, wanVaceAspectRatio: prepared?.plan.settings.aspectRatio || settings.aspectRatio } }} sourceVideoUrl={(seedance && ["gray", "green"].includes(prepared?.plan.generationPaddingColor) ? prepared.generationVideoUrl : prepared?.videoUrl) || ""} maskVideoUrl={prepared?.maskVideoUrl || ""} maskImageUrl={prepared?.maskImageUrl || ""} preparedPlan={prepared?.plan} referenceImageUrls={referenceImageUrls} promptConnected={promptConnected} running={running || busy} onUpdate={onUpdate} onAnalyze={onAnalyze} />}
    <NodeRow label="Reference image" inputPort={settingsOpen ? referenceImagePort : null} node={node} {...portProps}><span>{incoming.referenceImageIn?.length ? "Connected" : "Optional"}</span></NodeRow>
    {seedance && referenceImageUrls.slice(0, 30).map((url, index) => <NodeRow key={`${index}:${url}`} label={`Image ${index + 1} role`}>
      <select aria-label={`Outpaint image ${index + 1} role`} value={settings.referenceRoles[index] || "appearance"} disabled={busy || running} onChange={event => { const roles = referenceImageUrls.slice(0, 30).map((_, i) => settings.referenceRoles[i] || "appearance"); roles[index] = event.target.value; change({ referenceRoles: roles }); }}>
        {outpaintReferenceRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </NodeRow>)}
    {seedance && <p className="utility-mini-note">Reuse the same reference image nodes across takes. Environment guides the shared set; Wardrobe guides clothing. Source footage controls performance and camera. References improve consistency without guaranteeing identical geometry.</p>}
    {seedance && <>
      <NodeRow label="Canvas repeats"><input aria-label="Outpaint canvas repeats" title="Total copies of the selected shot submitted to Seedance. Longer inputs increase generation cost; maximum input is 30 seconds." type="number" min="1" max="30" step="1" value={settings.repeatCount} disabled={busy || running} onChange={e => change({ repeatCount: e.target.value })} /></NodeRow>
      {settings.repeatCount > 1 && <NodeRow label="Keep all repeats (debug)"><input aria-label="Keep all outpaint repeats for debugging" type="checkbox" checked={settings.keepAllRepeats} disabled={busy || running} onChange={e => change({ keepAllRepeats: e.target.checked })} /></NodeRow>}
      <p className="utility-mini-note">{settings.repeatCount === 1 ? "Submit once." : settings.keepAllRepeats ? `Debug: output all ${settings.repeatCount} copies in sequence.` : `Submit ${settings.repeatCount} copies; keep copy ${settings.repeatCount}.`} Longer inputs increase generation cost. Maximum 30 seconds.</p>
    </>}
    <NodeRow label="Restore source"><input aria-label="Restore original source footage" type="checkbox" checked={settings.restoreSource} disabled={busy || running} onChange={e => change({ restoreSource: e.target.checked })} /></NodeRow>
    {seedance && <NodeRow label="Match extension color"><input aria-label="Match outpaint extension color" title="Apply a bounded, shot-stable color correction using corresponding source boundary regions. Unreliable matches are skipped; the original core is preserved." type="checkbox" checked={settings.matchExtensionColor} disabled={busy || running || !settings.restoreSource} onChange={e => change({ matchExtensionColor: e.target.checked })} /></NodeRow>}
    {seedance && details?.rawVideoUrl && <NodeRow label="Local finish"><button type="button" className="outpaint-user-action" disabled={busy || running || !onPrepare || !outpaintCanRefinish(selected, settings, canvasVideoUrl || sourceVideoUrl)} onClick={refinish}>Refinish selected result</button></NodeRow>}
    {details?.matching?.colorMatching && <p className="utility-mini-note">Color match: {details.matching.colorMatching.applied ? "applied, stable through the shot" : details.matching.colorMatching.reason || "withheld: no reliable color difference"}.</p>}
    <NodeRow label="Blend width (px)"><input aria-label="Outpaint seam feather" title="Generated overlap inside the original edge. A smooth inward feather blends this ring and preserves the original core; generated pixels outside the source remain unchanged." type="number" min="0" max="128" step="1" value={settings.feather} disabled={busy || running || !settings.restoreSource} onChange={e => change({ feather: e.target.value })} /></NodeRow>
    {seedance ? <NodeRow label="Resolution"><select aria-label="Outpaint Seedance resolution" value={settings.seedanceResolution} disabled={busy || running} onChange={e => change({ seedanceResolution: e.target.value })}>{["480p", "720p", "1080p"].map(value => <option key={value}>{value}</option>)}</select></NodeRow> : <NodeRow label="Delivery size"><select aria-label="Outpaint delivery size" value={settings.outputSize} disabled={busy || running} onChange={e => change({ outputSize: e.target.value })}><option>720p</option><option>1080p</option></select></NodeRow>}
    <NodeRow label="QC Status"><OutpaintQcStatus scope={generationScope} node={node} running={running || busy} preparing={busy && !running} details={details} /></NodeRow>
    {!seedance && <>
      <NodeRow label="Steps"><input aria-label="Outpaint inference steps" type="number" min="1" max="60" value={node.data.wanVaceNumInferenceSteps ?? 30} onChange={e => onUpdate(node.id, { wanVaceNumInferenceSteps: e.target.value })} disabled={running} /></NodeRow>
      <NodeRow label="Guidance scale"><input aria-label="Outpaint guidance scale" type="number" min="0" max="20" step="0.5" value={node.data.wanVaceGuidanceScale ?? 5} onChange={e => onUpdate(node.id, { wanVaceGuidanceScale: e.target.value })} disabled={running} /></NodeRow>
    </>}
    {!seedance && <NodeRow label="Seed"><input aria-label="Outpaint seed" value={node.data.seed ?? ""} placeholder="Random" onChange={e => onUpdate(node.id, { seed: e.target.value })} disabled={running} /></NodeRow>}
    {!seedance && <NodeRow label="Negative"><textarea aria-label="Outpaint negative prompt" value={node.data.wanVaceNegativePrompt || ""} onChange={e => onUpdate(node.id, { wanVaceNegativePrompt: e.target.value })} disabled={running} /></NodeRow>}
  </>;
}
