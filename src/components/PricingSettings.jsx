import React from "react";
import { RefreshCcw } from "lucide-react";
import { pricingApi } from "../api/newtApi.js";
import { setPricingCatalog } from "../pricingCatalog.js";

const providerLabels = { fal: "Fal", krea: "Krea", atlas: "Atlas Cloud", openai: "OpenAI", google: "Google" };
const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short"
}).format(new Date(value)) : "Not checked yet";

export function PricingSettings() {
  const [state, setState] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const mounted = React.useRef(false);
  const operation = React.useRef(false);
  const requestVersion = React.useRef(0);
  function apply(result) { setState(result); setPricingCatalog(result.catalog); }
  React.useEffect(() => {
    mounted.current = true;
    let pending = false;
    async function load() {
      if (pending || operation.current) return;
      pending = true;
      const version = ++requestVersion.current;
      try { const result = await pricingApi.load(); if (mounted.current && version === requestVersion.current) { apply(result); setError(""); } }
      catch (error) { if (mounted.current && version === requestVersion.current) setError(error.message); }
      finally { pending = false; }
    }
    load(); const timer = setInterval(load, 5000);
    return () => { mounted.current = false; requestVersion.current++; clearInterval(timer); };
  }, []);

  async function update(action) {
    if (operation.current) return;
    requestVersion.current++;
    operation.current = true; setBusy(true); setError("");
    try { const result = await action(); if (mounted.current) apply(result); }
    catch (error) { if (mounted.current) setError(error.message); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  }
  const working = busy || state?.running;
  const active = Object.entries(providerLabels).filter(([provider]) => state?.sources?.[provider]?.status !== "disabled");
  const verified = active.reduce((sum, [provider]) => sum + (state?.sources?.[provider]?.current || 0), 0);
  const older = active.reduce((sum, [provider]) => sum + (state?.sources?.[provider]?.stale || 0), 0);
  const unavailable = active.reduce((sum, [provider]) => sum + (state?.sources?.[provider]?.unavailable || 0), 0);
  return <section className="stats-panel settings-panel wide pricing-settings">
    <div className="pricing-settings-heading">
      <h2>API Pricing</h2>
      <div className="pricing-settings-actions">
        <button type="button" className={`settings-key-toggle ${state?.enabled ? "enabled" : ""}`} role="switch"
          aria-label="Automatic pricing refresh" aria-checked={Boolean(state?.enabled)} disabled={!state || busy}
          onClick={() => update(() => pricingApi.setEnabled(!state.enabled))}>
          <span className="settings-key-toggle-track" aria-hidden="true"><span /></span><em>Auto refresh</em>
        </button>
        <button type="button" className="settings-key-version-action" title="Check prices now" aria-label="Check prices now"
          disabled={!state || working} onClick={() => update(pricingApi.refresh)}>
          <RefreshCcw size={16} className={working ? "spin" : ""} />
        </button>
      </div>
    </div>
    <div className="pricing-settings-meta">
      <span>{verified} current rate tables{older ? ` / ${older} older` : ""}{unavailable ? ` / ${unavailable} unavailable` : ""}</span>
      <span>Checked: {date(state?.lastCheckAt)}</span>
      <span>{state?.enabled ? "Daily refresh" : "Auto refresh off"}</span>
    </div>
    <div role="status" className="pricing-settings-status">{working ? "Checking official prices..." : error || state?.error || ""}</div>
    <details className="pricing-change-log"><summary>Pricing details</summary>
    <div className="pricing-provider-list">
      {active.map(([provider, label]) => {
        const source = state?.sources?.[provider];
        const status = { current: "Current", checking: "Checking", stale: "Older estimates", partial: "Some rates unavailable", error: "Check unavailable", bundled: "Bundled estimates", pending: "Not checked" }[source?.status] || "Not checked";
        return <div key={provider} className="pricing-provider pricing-provider-row" title={source?.message || `Last checked: ${date(source?.checkedAt)}`}>
          <strong>{label}</strong><span>{source?.current ? `${source.current} current tables` : "Variable / bundled estimates"}</span>
          <span className={source?.status === "current" ? "pricing-current" : ["error", "stale", "partial"].includes(source?.status) ? "pricing-review" : ""}>{status}</span>
        </div>;
      })}
    </div>
    </details>
  </section>;
}
