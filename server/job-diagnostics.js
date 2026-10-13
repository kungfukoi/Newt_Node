const diagnosticCodes = new Set([
  "EACCES", "EPERM", "EBUSY", "ENOSPC", "ENOENT", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT",
  "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET"
]);

export function jobErrorDiagnostic(error) {
  const sourceCode = error?.code || error?.cause?.code;
  const code = diagnosticCodes.has(sourceCode) ? sourceCode : error?.waitingForCredential ? "CREDENTIAL_UNAVAILABLE"
    : error?.name === "TimeoutError" || error?.name === "AbortError" ? "REQUEST_TIMEOUT" : "REQUEST_ERROR";
  const status = Number(error?.statusCode || error?.status);
  // Allowlist metadata, never provider bodies, URLs, prompts, or arbitrary error text.
  return { code, ...(status >= 100 && status <= 599 ? { httpStatus: status } : {}) };
}

export function appendJobEvent(events = [], event) {
  return [...events, event].slice(-32);
}

// Local observed stages include polling/network delay. Provider latency is a
// separate reported measurement; neither identifies queue vs inference time.
export function jobTimingDiagnostic(job, now = Date.now()) {
  const timestamp = value => value == null || value === "" ? NaN : typeof value === "number" ? value : Date.parse(value);
  const elapsed = (start, end) => {
    const a = timestamp(start), b = timestamp(end);
    return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
  };
  const end = job.finishedAt || now;
  return {
    preparationMs: elapsed(job.spec?.body?.generationSubmittedAt, job.createdAt),
    admissionMs: elapsed(job.createdAt, job.submissionStartedAt),
    submissionMs: elapsed(job.submissionStartedAt, job.providerAcceptedAt),
    providerTrackingMs: elapsed(job.providerAcceptedAt, job.outputAvailableAt || (job.state === "completed" ? null : end)),
    localSaveMs: elapsed(job.outputAvailableAt, end),
    totalMs: elapsed(job.spec?.body?.generationSubmittedAt || job.createdAt, end),
    providerReportedLatencyMs: Number.isFinite(job.providerLatencyMs) && job.providerLatencyMs >= 0 ? job.providerLatencyMs : null
  };
}
