import { useCallback, useSyncExternalStore } from "react";
import { formatGenerationElapsed, phaseLabel } from "../generationProgress.js";
import { generationProgressSnapshot, subscribeGenerationProgress } from "../generationProgressStore.js";

export function GenerationProgress({ nodeId }) {
  const subscribe = useCallback((listener) => subscribeGenerationProgress(nodeId, listener), [nodeId]);
  const getSnapshot = useCallback(() => generationProgressSnapshot(nodeId), [nodeId]);
  const progress = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (!progress) return null;

  const phase = phaseLabel(progress.phase);
  const batchDetail = progress.batchTotal > 1 ? `${progress.settledCount}/${progress.batchTotal}` : "";
  const queueDetail = progress.queuePosition !== null ? `Queue ${progress.queuePosition}` : "";
  const elapsed = formatGenerationElapsed(progress.elapsedMs);
  const percent = progress.determinate ? Math.round(progress.percent || 0) : null;
  const percentDetail = percent === null ? "" : `${progress.estimated ? "Est. " : ""}${percent}%`;
  const detail = [percentDetail, batchDetail, queueDetail, elapsed].filter(Boolean).join("  ");

  return (
    <div className={`generation-progress ${progress.status} ${progress.determinate ? "determinate" : "indeterminate"}`} title={progress.message || phase}>
      <div className="generation-progress-labels">
        <span>{phase}</span>
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
    </div>
  );
}
