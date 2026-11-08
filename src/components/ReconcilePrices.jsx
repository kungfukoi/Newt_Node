import React from "react";
import { pricingApi } from "../api/newtApi.js";

export function ReconcilePrices({ disabled, onComplete, className }) {
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  async function reconcile() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await pricingApi.reconcile();
      if (!Number.isInteger(result.updated) || !Number.isInteger(result.unpriced)) {
        throw new Error("Restart Newt Node to enable price reconciliation.");
      }
      setMessage(`Priced ${result.updated} of ${result.updated + result.unpriced} unpriced runs. ${result.unpriced} still unpriced in Local Stats.`);
      onComplete?.();
    } catch (failure) {
      setError(failure.message || "Price reconciliation failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button type="button" className={className} onClick={reconcile} disabled={disabled || busy}>
      {busy ? "Reconciling…" : "Reconcile unpriced runs"}
    </button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
