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
