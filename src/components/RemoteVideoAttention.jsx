import React from "react";
import { ExternalLink, Link2, Upload, X } from "lucide-react";
import { nodeApi, recoverRemoteVideoJob } from "../api/newtApi.js";

export function RemoteVideoAttention({ node, onUpdate }) {
  const jobs = node.data.remoteVideoAttention || [];
  return jobs.map((job) => <RecoveryRow key={job.runId} job={job} onRecovered={() => onUpdate(node.id, {
    remoteVideoAttention: jobs.filter((item) => item.runId !== job.runId)
  })} />);
}

function RecoveryRow({ job, onRecovered }) {
  const [requestId, setRequestId] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const fileInput = React.useRef(null);
  async function recover(action, file) {
    if (!confirmed || busy) return;
    setBusy(true); setError("");
    try {
      let assetUrl;
      if (file) {
        const form = new FormData(); form.append("asset", file);
        const upload = await nodeApi.uploadVideoAsset(form);
        if (!upload.response.ok) throw new Error(upload.data.error || "Video import failed.");
        assetUrl = upload.data.asset?.localUrl;
      }
      const result = await recoverRemoteVideoJob(job.runId, { action, requestId, assetUrl, scope: job.scope, acknowledged: true });
      if (!result.response.ok) throw new Error(result.data.error || "Could not recover this job.");
      onRecovered();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <details className="remote-video-attention nodrag nopan" onPointerDown={(event) => event.stopPropagation()}>
    <summary>Run {job.batchIndex}: Needs attention</summary>
    <a href={job.provider === "fal" ? "https://fal.ai/dashboard/requests" : "https://www.krea.ai/"} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open {job.provider === "fal" ? "Fal" : "Krea"}</a>
    <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I checked the original provider run.</label>
    <input aria-label="Original provider job ID" placeholder="Provider job ID" value={requestId} onChange={(event) => setRequestId(event.target.value)} />
    <div className="remote-video-recovery-actions">
      <button type="button" disabled={busy || !confirmed || !requestId.trim()} onClick={() => recover("attach")} title="Attach and verify original provider job" aria-label="Attach provider job"><Link2 size={14} /></button>
      <button type="button" disabled={busy || !confirmed} onClick={() => fileInput.current?.click()} title="Import the downloaded result of this run" aria-label="Import recovered video"><Upload size={14} /></button>
      <button type="button" disabled={busy || !confirmed} onClick={() => recover("dismiss")} title="Dismiss local tracking only. Does not cancel the provider job or refund charges." aria-label="Dismiss local tracking"><X size={14} /></button>
    </div>
    <small>Dismissal only stops local tracking. It does not cancel a remote job or refund charges.</small>
    <input ref={fileInput} type="file" accept="video/*,.mov,.mp4,.webm" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) recover("import", file); }} />
    {error && <small role="alert" className="upload-error">{error}</small>}
  </details>;
}
