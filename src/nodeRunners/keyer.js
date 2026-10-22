import { keyerApi } from "../api/newtApi.js";
import { keyerInputError, keyerSettings } from "../keyer.js";
import { workflowContextPayload } from "../workflowContext.js";

export async function runKeyer({ node, sourceVideoUrl, firstHintUrl, hintVideoUrl, workflowContext, update, shouldTrack = () => true, api = keyerApi, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const settings = keyerSettings(node.data);
  const input = { sourceVideoUrl, firstHintUrl, hintVideoUrl, settings };
  const reconnect = node.data.keyerAction === "reconnect" && node.data.keyerJobId;
  const error = reconnect ? "" : keyerInputError(input);
  if (error) throw new Error(error);
  const { jobId } = reconnect ? { jobId: node.data.keyerJobId } : await api.start({ ...input, ...workflowContextPayload(workflowContext), nodeId: node.id, nodeTitle: node.data.title });
  update({ keyerJobId: jobId, keyerProgress: "Loading CorridorKey 2.0…" });
  for (;;) {
    if (!shouldTrack()) return null;
    const job = await api.job(jobId);
    if (!shouldTrack()) return null;
    update({ keyerProgress: job.message || "Processing…" });
    if (job.state === "complete") return job.item;
    if (job.state === "error") { update({ keyerJobId: "" }); throw new Error(job.error || "Keying failed. Previous results were kept."); }
    await wait(1500);
  }
}
