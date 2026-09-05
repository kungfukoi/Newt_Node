export function restartDelay({ failures, uptimeMs, requested = false }) {
  if (requested) return { failures: 0, delayMs: 250 };
  const count = uptimeMs >= 60000 ? 1 : failures + 1;
  return { failures: count, delayMs: Math.min(30000, 1000 * 2 ** Math.min(5, count - 1)) };
}

export function redactRuntimeLog(value) {
  return String(value)
    .replace(/(Bearer\s+)[^\s"']+/gi, "$1[redacted]")
    .replace(/((?:api[_-]?key|access[_-]?token|authorization)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, "$1[redacted]")
    .replace(/([?&](?:key|token|signature|sig|credential)=)[^&\s"']+/gi, "$1[redacted]");
}
