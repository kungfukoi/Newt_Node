export function atlasTokenCount(value) {
  const count = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function billingId(value) {
  return typeof value === "string" && /^[a-z0-9_-]{1,128}$/i.test(value)
    && !/^(?:sk-|apikey-|key-|bearer|AIza)/i.test(value) ? value : "";
}

export function atlasTextUsage(usage, { requestId, responseId, model } = {}) {
  const atlasRequestId = billingId(requestId ?? usage?.atlasRequestId);
  const atlasResponseId = billingId(responseId ?? usage?.atlasResponseId);
  const modelId = model ?? usage?.atlasModel;
  const atlasModel = typeof modelId === "string" && /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(modelId)
    && !/(?:sk-|apikey-|key-|AIza)/i.test(modelId) && modelId.length <= 128 ? modelId : "";
  const input = atlasTokenCount(usage?.input_tokens ?? usage?.prompt_tokens);
  const output = atlasTokenCount(usage?.output_tokens ?? usage?.completion_tokens);
  const details = usage?.input_tokens_details ?? usage?.prompt_tokens_details;
  const cached = atlasTokenCount(details?.cached_tokens ?? usage?.prompt_cache_hit_tokens ?? 0);
  const writes = atlasTokenCount(details?.cache_write_tokens ?? usage?.cache_write_tokens ?? 0);
  const measured = input !== null && output !== null && cached !== null && writes !== null && cached + writes <= input;
  if (!measured && !atlasRequestId && !atlasResponseId && !atlasModel) return null;
  return { atlasRequestId, atlasResponseId, atlasModel, ...(measured ? { input_tokens: input, output_tokens: output,
    input_tokens_details: { cached_tokens: cached, cache_write_tokens: writes } } : {}) };
}

export function atlasTextUsageRecords(usage) {
  const rows = Array.isArray(usage) ? usage : usage && Object.hasOwn(usage, "request")
    ? [usage.request, ...(Array.isArray(usage.helpers) ? usage.helpers : [])] : [usage];
  return rows.slice(0, 50).map(row => atlasTextUsage(row)).filter(Boolean);
}
