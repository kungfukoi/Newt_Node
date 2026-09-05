import { useEffect, useRef } from "react";
import { remoteVideoJobsApi } from "./api/newtApi.js";
import { activeRemoteVideoNodeIds } from "./remoteVideoJobClient.js";
import { remoteVideoScope } from "./remoteVideoJobs.js";
import { recoveredVideoPatches } from "./remoteVideoRecovery.js";

export function useRemoteVideoRecovery({ context, nodesRef, edgesRef, updateNode, loadOutputHistory }) {
  const scope = remoteVideoScope(context);
  const callbacks = useRef({ updateNode, loadOutputHistory });
  callbacks.current = { updateNode, loadOutputHistory };
  useEffect(() => {
    let disposed = false;
    let timer;
    let cursor = "";
    let pollAfterMs = 3000;
    const knownJobs = new Map();
    async function poll() {
      try {
        const { response, data } = await remoteVideoJobsApi.list(scope, cursor);
        if (!disposed && response.ok) {
          if (data.reset) knownJobs.clear();
          (data.jobs || []).filter((job) => job.scope === scope).forEach((job) => knownJobs.set(job.runId, job));
          cursor = data.cursor || "";
          pollAfterMs = Math.min(15000, Math.max(3000, Number(data.pollAfterMs) || 3000));
          const jobs = [...knownJobs.values()];
          const patches = recoveredVideoPatches(nodesRef.current, jobs, activeRemoteVideoNodeIds(scope), edgesRef.current);
          patches.forEach(({ nodeId, patch }) => callbacks.current.updateNode(nodeId, patch));
          if (patches.some(({ patch }) => patch.resultItems)) callbacks.current.loadOutputHistory();
        }
      } catch {
        // The server may be restarting. Resume without discarding job ownership.
      } finally {
        if (!disposed) timer = setTimeout(poll, pollAfterMs);
      }
    }
    poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [scope, nodesRef, edgesRef]);
}
