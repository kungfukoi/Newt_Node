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
    async function poll() {
      try {
        const { response, data } = await remoteVideoJobsApi.list(scope);
        if (!disposed && response.ok) {
          const jobs = (data.jobs || []).filter((job) => job.scope === scope);
          const patches = recoveredVideoPatches(nodesRef.current, jobs, activeRemoteVideoNodeIds(scope), edgesRef.current);
          patches.forEach(({ nodeId, patch }) => callbacks.current.updateNode(nodeId, patch));
          if (patches.some(({ patch }) => patch.resultItems)) callbacks.current.loadOutputHistory();
        }
      } catch {
        // The server may be restarting. Resume without discarding job ownership.
      } finally {
        if (!disposed) timer = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [scope, nodesRef, edgesRef]);
}
