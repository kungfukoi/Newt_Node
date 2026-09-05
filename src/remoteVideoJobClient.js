import { remoteVideoScope, remoteVideoTerminal, remoteVideoNeedsAttention } from "./remoteVideoJobs.js";

const activeRuns = new Map();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function activeRemoteVideoNodeIds(scope) {
  return new Set([...activeRuns.values()].filter((run) => run.scope === scope).map((run) => run.nodeId));
}

export async function waitForRemoteVideo(body, { submit, get, delay = sleep }) {
  const runId = body.generationRunId;
  activeRuns.set(runId, { scope: remoteVideoScope(body), nodeId: body.nodeId });
  let job = null;
  let failures = 0;
  let needsSubmit = true;
  let preparationError = null;
  try {
    for (;;) {
      try {
        let result;
        if (needsSubmit) {
          // Reuse the run ID even if the HTTP acceptance response is lost.
          needsSubmit = false;
          result = await submit(body);
          if (result.response.ok && result.response.status !== 202) return result;
          if (!result.response.ok && result.response.status < 500) return result;
          if (!result.response.ok) preparationError = result;
        } else {
          result = await get(runId);
          if (result.response.status === 404 && !job) {
            if (preparationError) return preparationError;
            needsSubmit = true;
          }
        }
        if (result?.data?.job) job = result.data.job;
        if (remoteVideoNeedsAttention(job)) {
          return { response: { ok: false, status: 409 }, data: {
            error: job.message, code: "SUBMISSION_UNCERTAIN", generationRunId: job.runId,
            needsAttention: true
          } };
        }
        if (remoteVideoTerminal(job)) {
          return job.state === "completed"
            ? { response: { ok: true, status: 200 }, data: job.result }
            : { response: { ok: false, status: 502 }, data: { error: job.message, generationRunId: job.runId } };
        }
        failures = result.response.ok ? 0 : failures + 1;
      } catch {
        // A disconnected browser does not cancel or re-submit a provider job.
        failures += 1;
      }
      await delay(failures ? Math.min(30000, 2000 * 2 ** Math.min(failures, 4)) : 2500);
    }
  } finally {
    activeRuns.delete(runId);
  }
}
