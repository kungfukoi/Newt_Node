import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { formatGenerationElapsed, isTerminalProgressStatus, liveGenerationElapsed, phaseLabel, shouldRenderGenerationProgress } from "../generationProgress.js";
import { generationProgressSnapshot, subscribeGenerationProgress } from "../generationProgressStore.js";

export function GenerationProgress({ scope = "", nodeId, nodeStatus = "" }) {
  const subscribe = useCallback((listener) => subscribeGenerationProgress(scope, nodeId, listener), [scope, nodeId]);
  const getSnapshot = useCallback(() => generationProgressSnapshot(scope, nodeId), [scope, nodeId]);
  const progress = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const active = Boolean(progress && !isTerminalProgressStatus(progress.status));
  const [clock, setClock] = useState(Date.now);

  useEffect(() => {
    setClock(Date.now());
    if (!active) return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, progress?.groupId]);

  if (!shouldRenderGenerationProgress(progress, nodeStatus)) return null;

  const phase = phaseLabel(progress.phase);
  const batchDetail = progress.batchTotal > 1 ? `${progress.settledCount}/${progress.batchTotal}` : "";
  const queueDetail = progress.queuePosition !== null ? `Queue ${progress.queuePosition}` : "";
  const elapsed = formatGenerationElapsed(liveGenerationElapsed(progress, clock));
  const percent = progress.determinate ? Math.round(progress.percent || 0) : null;
  const percentDetail = percent === null ? "" : `${progress.estimated ? "Est. " : ""}${percent}%`;
  const providerDetail = progress.provider
    ? `${providerName(progress.provider)} ${progress.providerStatus || (progress.phase === "queued" ? "waiting" : "live")}`
    : "";
  const heartbeatDetail = providerContactLabel(progress.lastContactAt);
  const detail = [providerDetail, heartbeatDetail, percentDetail, batchDetail, queueDetail, elapsed].filter(Boolean).join("  ");
  const healthLabel = progress.health === "stalled"
    ? "Possibly stalled"
    : progress.health === "delayed"
      ? "Delayed"
      : progress.health === "reconnecting"
        ? "Reconnecting"
        : phase;
  const showHealthMessage = ["delayed", "stalled", "reconnecting"].includes(progress.health);

  return (
    <div className={`generation-progress ${progress.status} ${progress.health || "healthy"} ${progress.determinate ? "determinate" : "indeterminate"}`} title={progress.message || phase}>
      <div className="generation-progress-labels">
        <span>{healthLabel}</span>
        <span>{detail}</span>
      </div>
      <div
        className="generation-progress-track"
        role="progressbar"
        aria-label={`${progress.label} ${phase}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? phase : `${progress.estimated ? "Estimated " : ""}${percent}%`}
      >
        <span className="generation-progress-fill" style={percent === null ? undefined : { width: `${percent}%` }} />
      </div>
      {showHealthMessage && <small className="generation-progress-health">{progress.message}</small>}
    </div>
  );
}

function providerName(provider) {
  if (provider === "krea") return "Krea";
  if (provider === "fal") return "Fal";
  if (provider === "atlas") return "Atlas Cloud";
  return String(provider || "");
}

function providerContactLabel(lastContactAt, now = Date.now()) {
  const contactAt = Date.parse(lastContactAt || "");
  if (!Number.isFinite(contactAt)) return "";
  const seconds = Math.max(0, Math.floor((now - contactAt) / 1000));
  if (seconds < 10) return "checked now";
  if (seconds < 60) return `checked ${seconds}s ago`;
  return `checked ${Math.floor(seconds / 60)}m ago`;
}
