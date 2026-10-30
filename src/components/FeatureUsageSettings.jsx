import React from "react";
import { featureUsageApi, statsApi } from "../api/newtApi.js";
import { usageRows, usageNodeCatalog, nodeUsageEvents, modelUsageEvents } from "../featureUsage.js";
import { uniqueRecords } from "../statsAnalytics.js";
import { imageModelOptions, videoModelOptions, utilityImageModelOptions, utilityVideoModelOptions, model3DOptions } from "../modelOptions.js";
import { textAgentModelOptions } from "../userPreferences.js";
import { featureUsageWarning } from "../recordFeatureUsage.js";
import { audioModels } from "../audioModel.js";
import "./featureUsage.css";

const modelCatalog = [...new Set([...imageModelOptions, ...videoModelOptions, ...utilityImageModelOptions,
  ...utilityVideoModelOptions, ...model3DOptions, ...textAgentModelOptions.map(row => row.label),
  ...Object.values(audioModels).flat().map(row => row.name)])].map(name => ({ id: name, name }));
const displayDate = value => value ? new Date(value).toLocaleString() : "Never recorded";

export function FeatureUsageSettings() {
  const [nodeData, setNodeData] = React.useState(null);
  const [modelData, setModelData] = React.useState(null);
  const [errors, setErrors] = React.useState([]);
  const [busy, setBusy] = React.useState(true);
  const [range, setRange] = React.useState("30");
  const [metric, setMetric] = React.useState("run");
  const [search, setSearch] = React.useState("");
  const [signal, setSignal] = React.useState("");
  const [warning, setWarning] = React.useState(featureUsageWarning);
  const mounted = React.useRef(false);
  const loading = React.useRef(false);
  async function refresh() {
    if (loading.current) return;
    loading.current = true; setBusy(true);
    const results = await Promise.allSettled([featureUsageApi.load(), statsApi.local()]);
    if (mounted.current) {
      if (results[0].status === "fulfilled") setNodeData(results[0].value); else setNodeData(null);
      if (results[1].status === "fulfilled") setModelData(results[1].value); else setModelData(null);
      setErrors(results.flatMap((result, index) => result.status === "rejected" ? [`${index ? "Model" : "Node"} usage: ${result.reason.message}`] : []));
      setBusy(false);
    }
    loading.current = false;
  }
  React.useEffect(() => {
    mounted.current = true; refresh();
    const warn = () => setWarning(featureUsageWarning());
    window.addEventListener("newtnode:feature-usage-warning", warn);
    return () => { mounted.current = false; window.removeEventListener("newtnode:feature-usage-warning", warn); };
  }, []);
  const models = metric === "model";
  const available = models ? modelData : nodeData;
  const allRows = available ? usageRows(models ? modelUsageEvents(uniqueRecords(modelData.history).rows) : nodeUsageEvents(nodeData.days, metric),
    models ? modelCatalog : usageNodeCatalog, { range }) : [];
  const rows = allRows.filter(row => (!signal || row.signal === signal) && row.name.toLowerCase().includes(search.toLowerCase()));
  const total = allRows.reduce((sum, row) => sum + row.count, 0);
  return <div className="feature-usage">
    <p>Local feature adoption on this installation. Node run attempts and palette additions track from this update; model operations use retained history and the durable accounting ledger. Other installations and earlier evicted history are excluded.</p>
    <div className="feature-usage-controls">
      <label>Measure<select aria-label="Measure" value={metric} onChange={event => setMetric(event.target.value)}>
        <option value="run">Node run attempts</option><option value="add">Node palette additions</option><option value="model">Recorded model operations</option>
      </select></label>
      <label>Usage period<select aria-label="Usage period" value={range} onChange={event => setRange(event.target.value)}>
        <option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All recorded time</option>
      </select></label>
      <label>Find feature<input aria-label="Find feature" value={search} onChange={event => setSearch(event.target.value)} placeholder="Node or model name" /></label>
      <label>Usage signal<select aria-label="Usage signal" value={signal} onChange={event => setSignal(event.target.value)}>
        <option value="">All signals</option>{["Active", "Niche", "Inactive in period", "No recorded use"].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <button type="button" onClick={refresh} disabled={busy}>{busy ? "Loading usage…" : "Refresh usage"}</button>
    </div>
    {errors.map(error => <p role="alert" key={error}>{error}</p>)}
    {warning && <p role="alert">{warning}</p>}
    {available && <>
      <p><strong>{total.toLocaleString()} {models ? "recorded model operations" : metric === "add" ? "palette additions" : "node run attempts"}</strong> · {allRows.filter(row => row.count).length} features used in this period. Node tracking since {nodeData ? displayDate(nodeData.startedAt) : "unavailable"}.</p>
      {!total && <p role="status">No recorded activity in this period. Try All recorded time, or use a feature and refresh.</p>}
      <div className="feature-usage-table"><table>
        <caption>{models ? "Model operation" : "Node"} usage ranked by count</caption>
        <thead><tr><th scope="col">Feature</th><th scope="col">Count</th><th scope="col">Share</th><th scope="col">Last used (all time)</th><th scope="col">Signal</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.count.toLocaleString()}</td>
          <td><div className="feature-usage-share"><meter min="0" max="1" value={row.share} aria-label={`${row.name} usage share`} /><span>{(row.share * 100).toFixed(1)}%</span></div></td>
          <td>{displayDate(row.lastUsed)}</td><td>{row.signal}</td></tr>)}</tbody>
      </table></div>
      {!rows.length && <p role="status">No features match these filters.</p>}
    </>}
    <p className="feature-usage-note">Share uses all counts for the selected measure and period, before search/signal filters. Niche means less than 5% of those counts; Active means 5% or more. These are review hints, not obsolescence decisions. Small samples can be misleading.</p>
    <p className="feature-usage-note">A node attempt counts one Run action, including validation failures, stops and batches; batch entries do not inflate it. Passive nodes have no Run action: use palette additions to inspect them. Loads, imports, copies and undo do not count as palette additions. Model counts deduplicate recorded run IDs and may include several operations per node run. Unrecorded failures are absent; historical labels remain separate. Known catalog models/tools appear even at zero; uncatalogued historical models appear when recorded.</p>
  </div>;
}
