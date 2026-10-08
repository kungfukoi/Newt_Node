import React from "react";
import { Activity, ArrowDownToLine, BarChart3, DollarSign, Globe2, HardDrive, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { statsApi } from "./api/newtApi.js";
import { buildAnalytics, dateKey, defaultFilters, formatMoney, providerLabels, resolveDateRange } from "./statsAnalytics.js";
import "./stats.css";

const readableDate = value => value ? new Date(value).toLocaleString() : "Not checked";
const labels = { provider: "Provider", model: "Model", workflow: "Workflow / JSON file", key: "API-key identity" };

export default function StatsDashboard({ api = statsApi, demo = false } = {}) {
  const [scope, setScope] = React.useState("local");
  const [filters, setFilters] = React.useState(defaultFilters);
  const [data, setData] = React.useState(null);
  const [status, setStatus] = React.useState("loading");
  const [error, setError] = React.useState("");
  const [globalFilters, setGlobalFilters] = React.useState({ provider: "", model: "", key: "", atlasScope: "account" });
  const [accounts, setAccounts] = React.useState(null);
  const [accountStatus, setAccountStatus] = React.useState("idle");
  const [accountError, setAccountError] = React.useState("");
  const [dimension, setDimension] = React.useState("provider");
  const [limit, setLimit] = React.useState(25);
  const [transferStatus, setTransferStatus] = React.useState("");
  const [comparison, setComparison] = React.useState(null);
  const mounted = React.useRef(false), request = React.useRef(0), busy = React.useRef(false);
  const importInput = React.useRef(null);
  const refresh = React.useCallback(async () => {
    if (busy.current) return;
    busy.current = true; const id = ++request.current;
    setStatus(current => current === "loading" ? "loading" : "refreshing");
    try {
      const result = await api.local();
      if (!mounted.current || id !== request.current) return;
      if (!Array.isArray(result.history)) throw new Error("Invalid stats response");
      setData(result); setStatus("ready"); setError("");
    } catch {
      if (mounted.current && id === request.current) { setStatus("error"); setError("Local accounting could not refresh. Existing data may be stale. Records are preserved; retry when the server is available."); }
    } finally { busy.current = false; }
  }, [api]);
  React.useEffect(() => {
    mounted.current = true; refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => { mounted.current = false; request.current++; window.clearInterval(interval); };
  }, [refresh]);
  React.useEffect(() => { setLimit(25); }, [filters]);
  const analytics = React.useMemo(() => buildAnalytics(data?.history || [], filters, new Date(), data?.keyIdentities || []), [data, filters]);
  const now = new Date();
  const range = scope === "local" ? analytics.range : filters.range === "all"
    ? { error: "All Time covers this installation's recorded runs. Choose a date range of up to 180 days for provider billing." }
    : resolveDateRange(filters, new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const query = { ...globalFilters, start: range.start ? dateKey(range.start) : "", end: range.end ? dateKey(range.end) : "" };
  const queryId = JSON.stringify(query), queryCurrent = accounts?.queryId === queryId;
  const [activeQuery, setActiveQuery] = React.useState("");
  const queryAccounts = async () => {
    if (range.error || accountStatus === "loading") return;
    const id = queryId; setActiveQuery(id); setAccountStatus("loading"); setAccountError("");
    try {
      const result = await api.accounts(query);
      if (!mounted.current) return;
      if (!Array.isArray(result.providers)) throw new Error("Invalid provider response");
      setAccounts({ ...result, queryId: id }); setAccountStatus("ready");
    } catch (failure) {
      if (mounted.current) { setAccountStatus("error"); setAccountError(failure.message || "Provider query unavailable. Retry later."); }
    }
  };
  const change = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const reset = () => { setFilters(defaultFilters()); setGlobalFilters({ provider: "", model: "", key: "", atlasScope: "account" }); setComparison(null); setTransferStatus(""); };
  const exportRecords = async () => {
    try {
      const exported = await api.export();
      const url = URL.createObjectURL(new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `newt-accounting-${dateKey(new Date())}.json`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setTransferStatus("Local accounting exported without prompts or secret credentials.");
    } catch { setTransferStatus("Export unavailable. Retry after local accounting loads."); }
  };
  const previewImport = async event => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 4e6) { setTransferStatus("Choose an accounting JSON export smaller than 4 MB."); return; }
    try {
      const result = await api.previewImport(JSON.parse(await file.text()));
      setComparison(result); setTransferStatus(`${result.duplicates} overlapping records excluded. Read-only comparison; Local accounting is unchanged.`);
    } catch { setTransferStatus("Import preview unavailable. Use a Newt accounting JSON export; nothing was changed."); }
  };
  const count = [filters.workflow, filters.provider, filters.model, filters.key, filters.status, filters.search].filter(Boolean).length;

  return <section className="stats-page analytics-page" aria-label="Spend analytics">
    <header className="stats-hero analytics-hero">
      <div><span className="stats-kicker">Know where your budget goes</span><h1>Stats</h1><p>Follow the cost of a run, a workflow, or your provider account.</p></div>
      <div className="analytics-hero-actions"><div className="analytics-scope" role="group" aria-label="Accounting scope">
        <button aria-pressed={scope === "local"} onClick={() => setScope("local")}><HardDrive size={16}/>Local</button>
        <button aria-pressed={scope === "global"} onClick={() => setScope("global")}><Globe2 size={16}/>Global</button>
      </div><button onClick={scope === "local" ? refresh : queryAccounts} disabled={scope === "local" ? ["loading", "refreshing"].includes(status) : accountStatus === "loading" || !!range.error}><RefreshCcw size={16}/>{scope === "local" ? "Refresh records" : "Query providers"}</button></div>
    </header>
    <div className="analytics-context"><span className="analytics-source">{scope === "local" ? "LOCAL RECORDS" : "PROVIDER BILLING"}</span><p>{scope === "local" ? "This installation only. Recorded charges and estimates; shared keys do not synchronize records." : "Across machines and apps within the provider's permitted billing scope. Separate from Newt's local records."}</p><small>{scope === "local" ? `Last refresh: ${readableDate(data?.fetchedAt)}` : `Last query: ${readableDate(accounts?.fetchedAt)}`}</small></div>
    <section className="analytics-filters" aria-label="Analytics filters">
      <div className="analytics-filter-heading"><span><SlidersHorizontal size={16}/>Filter your view</span><button onClick={reset}>Reset all filters</button></div>
      <div className="analytics-filter-grid">
        <label>Date range<select aria-label="Date range" value={filters.range} onChange={e => change("range", e.target.value)}><option value="5">Last 5 days</option><option value="30">Last 30 days</option><option value="all" disabled={scope === "global"}>All Time</option><option value="custom">Custom range</option></select></label>
        {filters.range === "custom" && <><label>Start date<input type="date" value={filters.start} onChange={e => change("start", e.target.value)}/></label><label>End date (inclusive)<input type="date" value={filters.end} onChange={e => change("end", e.target.value)}/></label></>}
        {scope === "local" ? <>
          {["workflow", "provider", "model", "key"].map(key => <label key={key}>{labels[key]}<select aria-label={labels[key]} value={filters[key]} onChange={e => change(key, e.target.value)}><option value="">All {key === "key" ? "key identities" : key === "workflow" ? "workflows" : `${key}s`}</option>{analytics.options[key].map(row => <option key={row.id} value={row.id}>{row.name}{key === "workflow" ? ` [${row.id}]` : ""}</option>)}</select></label>)}
          <label>Cost / run state<select value={filters.status} onChange={e => change("status", e.target.value)}><option value="">All recorded runs</option><option value="completed">Completed</option><option value="unpriced">Unpriced</option><option value="failed">Failed (if recorded)</option></select></label>
          <label className="analytics-search">Find run / job / JSON file<input type="search" value={filters.search} onChange={e => change("search", e.target.value)} placeholder="Run ID, model or workflow"/></label>
        </> : <>
          <label>Provider<select aria-label="Provider" value={globalFilters.provider} onChange={e => setGlobalFilters(current => ({ ...current, provider: e.target.value, model: "", key: "" }))}><option value="">All providers</option>{["atlas", "fal", "krea", "openai", "google", "elevenlabs"].map(id => <option key={id} value={id}>{providerLabels[id]}</option>)}</select></label>
          <label>Public model / endpoint ID<input value={globalFilters.model} disabled={!["atlas", "fal"].includes(globalFilters.provider)} onChange={e => setGlobalFilters(current => ({ ...current, model: e.target.value }))} placeholder="Select Atlas or Fal"/></label>
          <label>Public provider key ID<input value={globalFilters.key} disabled={!["atlas", "fal", "openai"].includes(globalFilters.provider)} onChange={e => setGlobalFilters(current => ({ ...current, key: e.target.value }))} placeholder="Public ID, never the secret key" autoComplete="off"/></label>
          <label>Atlas billing scope<select value={globalFilters.atlasScope} onChange={e => setGlobalFilters(current => ({ ...current, atlasScope: e.target.value }))}><option value="account">Entire account (billing permission)</option><option value="self">Authenticated user's keys</option></select></label>
        </>}
      </div>
      <div className="analytics-filter-summary" role="status">{range.error || <>{range.label} · {scope === "local" ? `Calendar days in ${Intl.DateTimeFormat().resolvedOptions().timeZone}; ${count} additional filters; ${analytics.rows.length} matching records` : "UTC calendar days; click Query providers to apply"}</>}</div>
      {scope === "global" && <p className="analytics-note">Workflow, local run search and local hashed key filters are paused: providers cannot attribute account charges to Newt JSON files. A key filter needs the provider's public ID. Balance always covers the account regardless of these filters.</p>}
    </section>
    {scope === "local" ? <>
      {error && <div role="alert" className="analytics-alert">{error}<button onClick={refresh}>Retry local records</button></div>}
      {status === "loading" ? <div className="analytics-empty" role="status">Loading recorded usage…</div> : <>
        <div className="stats-metrics analytics-metrics">
          <Metric icon={<DollarSign size={18}/>} label="Recorded spend" value={formatMoney(analytics.total)} detail={`${analytics.pricedCount} priced · ${analytics.unpricedCount} unpriced`}/>
          <Metric icon={<Activity size={18}/>} label="Runs / jobs" value={analytics.rows.length} detail="Recorded operations in this view"/>
          <Metric icon={<BarChart3 size={18}/>} label="Average / priced run" value={formatMoney(analytics.average)} detail="Unpriced records excluded"/>
          <Metric icon={<DollarSign size={18}/>} label="Charge confidence" value={analytics.pricedCount ? `${formatMoney(analytics.actual)} reported` : "No priced records"} detail={`${formatMoney(analytics.estimated)} estimated or unverified`}/>
        </div>
        {!analytics.rows.length && <div className="analytics-empty"><h2>{data?.history?.length ? "No runs match this view" : "Your first recorded run starts the story"}</h2><p>{data?.history?.length ? "Broaden a filter or change the date range." : "Records appear after generation. Missing historical amounts remain unpriced."}</p><button onClick={reset}>Reset all filters</button></div>}
        <div className="analytics-grid">
          <section className="stats-panel analytics-trend"><Panel title="Spend over time" aside="USD · recorded amounts"/><Trend days={analytics.days}/></section>
          <section className="stats-panel analytics-breakdown"><Panel title="Where it went" aside="Click a row to filter"/><div className="analytics-tabs" role="group" aria-label="Breakdown dimension">{["provider", "model", "workflow", "key"].map(id => <button key={id} aria-pressed={dimension === id} onClick={() => setDimension(id)}>{id === "key" ? "Keys" : id === "workflow" ? "Workflows" : `${labels[id]}s`}</button>)}</div><Breakdown rows={analytics.breakdowns[dimension]} onSelect={id => change(dimension, id)}/></section>
        </div>
        <section className="stats-panel analytics-ledger"><Panel title="Run ledger" aside={`${Math.min(limit, analytics.rows.length)} of ${analytics.rows.length} matching records`}/><RunLedger rows={analytics.rows.slice(0, limit)}/>{limit < analytics.rows.length && <button className="analytics-load" onClick={() => setLimit(current => current + 25)}>Show 25 more runs</button>}</section>
        <details className="analytics-coverage"><summary>Coverage & portable accounting</summary><p>{data?.coverage?.note || "Retained history only; complete past billing cannot be reconstructed locally."}</p><p>Durable tracking began {readableDate(data?.coverage?.trackingStartedAt)}. {analytics.duplicates} duplicate records excluded; {analytics.invalidDates} records with invalid dates excluded from date views. Deleted recent history does not delete accounting records.</p><p>Workflow IDs distinguish same-named JSON files. Renames retain existing identity; Save As uses the app's new package identity. Legacy records without file/key attribution remain unknown.</p><div className="analytics-transfer"><button disabled={demo} onClick={exportRecords}><ArrowDownToLine size={15}/>Export local accounting</button><button disabled={demo} onClick={() => importInput.current?.click()}>Preview another machine's export</button><input ref={importInput} hidden type="file" accept=".json,application/json" onChange={previewImport}/></div><p role="status">{transferStatus}</p>{comparison && <ImportComparison comparison={comparison}/>}</details>
      </>}
    </> : <>
      {accountError && activeQuery === queryId && <div role="alert" className="analytics-alert">{accountError} {queryCurrent ? "Previous query shown with original timestamp." : "No provider totals substituted."}</div>}
      {accountStatus === "loading" && <div role="status" className="analytics-empty">Querying supported billing APIs… no generation requests are submitted.</div>}
      {!queryCurrent && accountStatus !== "loading" && <div className="analytics-empty"><h2>{accounts ? "Filters changed — ready for a new query" : "See beyond this machine"}</h2><p>Query official billing APIs with existing local credentials. Unsupported providers and permission limits remain visible.</p><button onClick={queryAccounts} disabled={!!range.error}>Apply & query providers</button></div>}
      {queryCurrent && <GlobalAccounts data={accounts} stale={accountStatus === "error"}/>}
      <section className="stats-panel analytics-capabilities"><Panel title="Provider coverage" aside="Official API capabilities"/>{(data?.capabilities || []).map(capability => <article key={capability.provider}><strong>{providerLabels[capability.provider]}</strong><span>{capability.note}</span><a href={capability.docs} target="_blank" rel="noreferrer">API documentation ↗</a></article>)}</section>
    </>}
  </section>;
}
function Metric({ icon, label, value, detail }) { return <article className="metric-card"><span className="metric-icon">{icon}</span><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>; }
function Panel({ title, aside }) { return <div className="panel-title"><h2>{title}</h2><small>{aside}</small></div>; }
function Trend({ days }) {
  const max = Math.max(0.000001, ...days.map(day => day.cost));
  const points = days.map((day, index) => `${20 + index / Math.max(1, days.length - 1) * 640},${190 - day.cost / max * 155}`).join(" ");
  return <div className="analytics-chart"><div className="analytics-chart-ceiling">{formatMoney(max === 0.000001 ? 0 : max)}</div><svg viewBox="0 0 680 220" role="img" aria-label={`Daily recorded spend for ${days.length} calendar days; exact values in daily data table`}><line x1="20" y1="190" x2="660" y2="190" className="analytics-chart-grid"/><line x1="20" y1="112" x2="660" y2="112" className="analytics-chart-grid"/>{days.length > 1 && <polygon points={`20,190 ${points} 660,190`} fill="rgba(221,198,49,.12)"/>}<polyline points={points} fill="none" stroke="#ddc631" strokeWidth="3"/>{days.map((day, index) => day.count ? <circle key={day.key} cx={20 + index / Math.max(1, days.length - 1) * 640} cy={190 - day.cost / max * 155} r="3" fill="#ddc631"><title>{day.key}: {day.pricedCount ? formatMoney(day.cost) : "Unpriced"}, {day.count} records</title></circle> : null)}</svg><div className="chart-axis"><span>{days[0]?.key}</span><span>{days.at(-1)?.key}</span></div><details><summary>Daily spend & record counts</summary><div className="analytics-table-scroll"><table><caption>Exact chart data; empty days have no recorded runs</caption><thead><tr><th>Date</th><th>Spend</th><th>Records</th><th>Unpriced</th></tr></thead><tbody>{days.map(day => <tr key={day.key}><td>{day.key}</td><td>{day.pricedCount ? formatMoney(day.cost) : day.count ? "Unpriced" : "No records"}</td><td>{day.count}</td><td>{day.count - day.pricedCount}</td></tr>)}</tbody></table></div></details></div>;
}
function Breakdown({ rows, onSelect }) {
  const max = Math.max(0.000001, ...rows.map(row => row.cost));
  return rows.length ? <div className="analytics-ranked">{rows.map(row => <button key={row.id} onClick={() => onSelect(row.id)}><span><strong>{row.name}</strong><small>{row.count} runs · {row.unpricedCount} unpriced</small></span><b>{row.pricedCount ? formatMoney(row.cost) : "Unpriced"}</b><i style={{ width: `${row.cost / max * 100}%` }}/></button>)}</div> : <p className="analytics-note">No spend breakdown in this view.</p>;
}
function RunLedger({ rows }) {
  if (!rows.length) return <p className="analytics-note">No matching recorded runs.</p>;
  return <div className="analytics-table-scroll"><table><caption className="analytics-sr-only">Recorded runs. Expand Details for attribution and pricing.</caption><thead><tr><th>Run / job</th><th>Workflow / file</th><th>Provider / key</th><th>Date</th><th>Recorded cost</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.provider}:${row.generationRunId || row.id}:${index}`}><td><details><summary><strong>{row.modelName}</strong><small>{row.mediaType} · {row.status} · Details</small></summary><dl><dt>Run ID</dt><dd>{row.generationRunId || "Not recorded"}</dd><dt>Request / record ID</dt><dd>{row.id || "Not recorded"}</dd><dt>Endpoint</dt><dd>{row.endpoint || "Not recorded"}</dd><dt>Workflow ID</dt><dd>{row.project.id}</dd><dt>Pricing basis</dt><dd>{row.cost.pricingBasis || "No verified basis recorded"}</dd><dt>Pricing source</dt><dd>{row.cost.pricingSource || "Unknown"}</dd><dt>Price checked</dt><dd>{row.cost.pricingCheckedAt ? readableDate(row.cost.pricingCheckedAt) : "Not recorded"}</dd></dl></details></td><td>{row.project.name}<small>{row.project.fileName || "JSON filename not recorded"}</small></td><td>{providerLabels[row.provider]}<small>{row.keyLabel}</small></td><td><time dateTime={row.createdAt}>{readableDate(row.createdAt)}</time></td><td><strong>{row.cost.amountUsd === null ? "Unpriced" : formatMoney(row.cost.amountUsd)}</strong><small>{row.cost.amountUsd === null ? "Billing details missing" : row.cost.estimated ? "Estimate / unverified" : "Provider reported"}</small></td></tr>)}</tbody></table></div>;
}
function GlobalAccounts({ data, stale }) {
  const ready = data.providers.filter(row => row.spend.status === "ready");
  const total = ready.length ? ready.reduce((sum, row) => sum + row.spend.amount, 0) : null;
  const bucketMap = new Map();
  for (const provider of ready) for (const row of provider.spend.rows) { const day = bucketMap.get(row.date) || { key: row.date, cost: 0, count: 0, pricedCount: 0 }; day.cost += row.amount; day.count++; day.pricedCount++; bucketMap.set(row.date, day); }
  return <><div className="stats-metrics analytics-metrics"><Metric icon={<Globe2 size={18}/>} label="Provider-reported spend" value={formatMoney(total)} detail={`${ready.length} of ${data.providers.length} providers returned costs; incomplete coverage`}/><Metric icon={<Activity size={18}/>} label="Query period (UTC)" value={`${data.query.start} → ${data.query.end}`} detail="Start inclusive · end exclusive"/><Metric icon={<RefreshCcw size={18}/>} label="Billing freshness" value={stale ? "Stale · retry required" : "Provider snapshot"} detail={readableDate(data.fetchedAt)}/><Metric icon={<BarChart3 size={18}/>} label="Coverage" value="Provider scope" detail="No Newt workflow or local job attribution"/></div>
    <div className="analytics-accounts">{data.providers.map(provider => <section className="stats-panel" key={provider.provider}><Panel title={providerLabels[provider.provider]} aside={provider.scope}/><div className="analytics-account-numbers"><div><small>Spend in queried period</small><strong>{formatMoney(provider.spend.amount)}</strong><span className="analytics-badge">{provider.spend.status}</span><p>{provider.spend.scope || provider.spend.message}</p></div><div><small>Current remaining balance</small><strong>{provider.balance.unit === "characters" && provider.balance.amount !== null ? `${provider.balance.amount.toLocaleString()} characters` : formatMoney(provider.balance.amount)}</strong><span className="analytics-badge">{provider.balance.status}</span><p>{provider.balance.scope || provider.balance.message}</p></div></div><p className="analytics-note">{provider.note}</p>{provider.spend.status === "ready" && <><p className="analytics-note">{provider.spend.message} {provider.spend.partial && "Includes partial daily buckets; billing still accruing."}</p><details><summary>Daily provider costs · {provider.spend.rows.length} buckets</summary><div className="analytics-table-scroll"><table><thead><tr><th>Date (UTC)</th><th>Model / endpoint</th><th>Public key ID</th><th>Cost</th><th>Coverage</th></tr></thead><tbody>{provider.spend.rows.map((row, index) => <tr key={index}><td>{row.date}</td><td>{row.model}</td><td>{row.key}</td><td>{formatMoney(row.amount)}</td><td>{row.partial ? "Partial" : "Reported"}{row.coveredUntil && <small>Through {readableDate(row.coveredUntil)}</small>}</td></tr>)}</tbody></table></div></details></>}<small>Retrieved {readableDate(provider.fetchedAt)} · Balance ignores date/model/key filters</small></section>)}</div>
    {!!bucketMap.size && <section className="stats-panel analytics-trend"><Panel title="Reported spend over time" aside="Available providers only · USD"/><Trend days={[...bucketMap.values()].sort((a, b) => a.key.localeCompare(b.key))}/></section>}
  </>;
}
function ImportComparison({ comparison }) {
  const result = buildAnalytics(comparison.records, defaultFilters());
  return <div className="analytics-import"><strong>Read-only combined comparison · last 30 days</strong><p>{comparison.scope}</p><p>{result.rows.length} distinct records · {formatMoney(result.total)} recorded spend · {result.unpricedCount} unpriced. Provider and local totals are never added together.</p><RunLedger rows={result.rows.slice(0, 25)}/></div>;
}
