import { monitorEventLoopDelay } from "node:perf_hooks";

const number = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) / 100 : 0;
const states = new Set(["accepted", "submitting", "queued", "running", "recovering", "downloading", "completed", "failed", "uncertain", "dismissed"]);
const safeCode = (value) => /^[A-Z][A-Z0-9_]{1,48}$/.test(String(value || "")) ? value : "UNKNOWN";

export function safeJobDiagnostic(job) {
  const error = (value) => value ? { code: safeCode(value.code), ...(Number(value.httpStatus) >= 100 && Number(value.httpStatus) <= 599 ? { httpStatus: Number(value.httpStatus) } : {}) } : null;
  return {
    runId: /^[a-zA-Z0-9:_-]{1,160}$/.test(String(job.runId)) ? job.runId : "redacted",
    provider: ["fal", "krea"].includes(job.provider) ? job.provider : "other",
    state: states.has(job.state) ? job.state : "unknown",
    retryCount: number(job.retryCount), lastError: error(job.lastError),
    events: (job.events || []).slice(-32).map((entry) => ({ at: Number.isFinite(Date.parse(entry.at)) ? new Date(entry.at).toISOString() : null, state: states.has(entry.state) ? entry.state : "unknown", error: error(entry.error) }))
  };
}

export function createRuntimeDiagnostics({ version, getCommit = async () => "", getJobs = () => [], getWork = () => ({}), monitor = monitorEventLoopDelay } = {}) {
  let histogram;
  let expires;
  let commit;
  const stop = () => { histogram?.disable(); histogram = null; clearTimeout(expires); };
  return {
    setEnabled(enabled) {
      if (!enabled) { stop(); return; }
      if (!histogram) { histogram = monitor({ resolution: 20 }); histogram.enable(); }
      clearTimeout(expires);
      expires = setTimeout(stop, 10 * 60 * 1000);
      expires.unref?.();
    },
    async snapshot() {
      if (!commit) commit = Promise.resolve().then(getCommit).catch(() => "");
      const hash = String(await commit);
      return {
        enabled: Boolean(histogram), version, commit: /^[a-f0-9]{7,40}$/i.test(hash) ? hash : "unavailable",
        capturedAt: new Date().toISOString(), uptimeSeconds: number(process.uptime()), platform: process.platform,
        supervisor: { enabled: process.env.NEWTNODE_SUPERVISED === "1", restarts: number(process.env.NEWTNODE_SUPERVISOR_RESTARTS) },
        ...(histogram ? {
          eventLoop: { meanMs: number(histogram.mean / 1e6), p95Ms: number(histogram.percentile(95) / 1e6), maxMs: number(histogram.max / 1e6) },
          memory: { rssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed },
          work: getWork(), jobs: getJobs().slice(-50).map(safeJobDiagnostic)
        } : {})
      };
    },
    close: stop
  };
}
