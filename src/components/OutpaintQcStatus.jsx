import { useCallback, useSyncExternalStore } from "react";
import { generationProgressSnapshot, subscribeGenerationProgress } from "../generationProgressStore.js";
import { outpaintQcStatus } from "../outpaintQcStatus.js";

export function OutpaintQcStatus({ scope = "", node, running, preparing, details }) {
  const subscribe = useCallback(listener => subscribeGenerationProgress(scope, node.id, listener), [scope, node.id]);
  const snapshot = useCallback(() => generationProgressSnapshot(scope, node.id), [scope, node.id]);
  const progress = useSyncExternalStore(subscribe, snapshot, () => null);
  const text = outpaintQcStatus({ running, preparing, stage: node.data.videoOutpaintStage, findings: node.data.videoOutpaintQcFindings, details, message: progress?.message });
  return <output aria-label="Outpaint QC Status" role="status" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere", fontSize: 12, lineHeight: 1.4 }}>{text}</output>;
}
