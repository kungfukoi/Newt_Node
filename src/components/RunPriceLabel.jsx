import React from "react";
import { BatchRunContext } from "./BatchRunContext.js";
import { refreshGenerationEstimate } from "../api/pricingEstimate.js";
import { generationEstimate, formatRunCost } from "../generationPricing.js";
import { generationQuoteKey } from "../pricingTrust.js";
import { getGenerationQuote } from "../pricingCatalog.js";
import { usePricingRevision } from "../usePricing.js";

export function RunPriceLabel({ label, options, visible = true }) {
  const multiplier = React.useContext(BatchRunContext);
  if (multiplier > 1) {
    options = { ...options, batchCount: (Number(options.batchCount) || 1) * multiplier };
    if (typeof label === "string" && !label.startsWith("Run Batch")) label = `${label} · ${multiplier} entries`;
  }
  const revision = usePricingRevision();
  const key = generationQuoteKey(options);
  const [result, setResult] = React.useState(null);
  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const update = async () => {
      const quote = await refreshGenerationEstimate(JSON.parse(key));
      if (!cancelled) setResult({ key, quote });
    };
    const timer = setTimeout(update, 500);
    const interval = setInterval(update, 60000);
    return () => { cancelled = true; clearTimeout(timer); clearInterval(interval); };
  }, [key, visible, revision]);
  if (!visible) return label;
  const quote = result?.key === key ? getGenerationQuote(options) || generationEstimate(options) : generationEstimate(options);
  const cost = formatRunCost(quote.amountUsd);
  const status = quote.pricingStatus === "stale" ? "Older est." : "Est.";
  const date = quote.pricingCheckedAt ? ` Last verified: ${new Date(quote.pricingCheckedAt).toLocaleDateString()}.` : "";
  return <span title={`${quote.pricingBasis || "Estimated cost; final charge may differ."}${date}`}>
    {label} ({cost ? `${status} ${cost}` : /OpenAI Image/.test(options.model) ? "Variable cost" : "Price unavailable"})
  </span>;
}
