import React from "react";
import { Download, RefreshCw } from "lucide-react";
import { getJson, postJson } from "../api/newtApi.js";
import { clientDiagnosticsSnapshot, setClientDiagnosticsEnabled } from "../clientDiagnostics.js";

export function DiagnosticsPanel() {
  const [client, setClient] = React.useState(clientDiagnosticsSnapshot);
  const [server, setServer] = React.useState(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function refresh() {
    setBusy(true);
    try {
      setServer(await getJson("/api/system/performance-diagnostics", "Diagnostics unavailable."));
      setClient(clientDiagnosticsSnapshot());
      setError("");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  React.useEffect(() => { refresh(); }, []);
  async function toggle(enabled) {
    setBusy(true);
    try {
      const result = await postJson("/api/system/performance-diagnostics", { enabled }, "Could not change diagnostics.");
      setClientDiagnosticsEnabled(enabled);
      setClient(clientDiagnosticsSnapshot());
      setServer(result);
      setError("");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, server, client: clientDiagnosticsSnapshot() }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "newtnode-diagnostics.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="runtime-diagnostics">
    <label><input type="checkbox" checked={Boolean(client.enabled && server?.enabled)} disabled={busy} onChange={(event) => toggle(event.target.checked)} /> Collect diagnostics (10 minutes)</label>
    <dl>
      <div><dt>Build</dt><dd>{server?.version || "-"} / {server?.commit?.slice(0, 12) || "-"}</dd></div>
      <div><dt>API uptime</dt><dd>{server ? `${Math.round(server.uptimeSeconds)} s` : "-"}</dd></div>
      <div><dt>Production supervisor</dt><dd>{server?.supervisor?.enabled ? `${server.supervisor.restarts} restarts` : "Not active in this session"}</dd></div>
      <div><dt>Event loop p95</dt><dd>{server?.eventLoop ? `${server.eventLoop.p95Ms} ms` : "-"}</dd></div>
      <div><dt>Browser long tasks</dt><dd>{client.enabled ? client.longTasksSupported ? `${client.longTasks} / ${client.longTaskMs} ms` : "Unavailable in this browser" : "-"}</dd></div>
      <div><dt>Video frames decoded / dropped</dt><dd>{client.enabled ? `${client.decodedFrames} / ${client.droppedFrames}` : "-"}</dd></div>
      <div><dt>Failed media loads</dt><dd>{client.enabled ? client.failedAssets : "-"}</dd></div>
    </dl>
    <div className="settings-actions">
      <button type="button" disabled={busy} onClick={refresh} title="Refresh diagnostics" aria-label="Refresh diagnostics"><RefreshCw size={16} /></button>
      <button type="button" disabled={!server} onClick={download}><Download size={16} /> Export diagnostics</button>
    </div>
    {error && <p role="alert" className="settings-message">{error}</p>}
  </div>;
}
