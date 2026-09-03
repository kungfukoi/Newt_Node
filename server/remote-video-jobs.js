import { readFile } from "node:fs/promises";
import { writeJsonAtomic } from "./json-store.js";
import { remoteVideoScope, remoteVideoTerminal, remoteVideoWarningMs } from "../src/remoteVideoJobs.js";

// One worker per durable run. Provider submission is never retried after an
// ambiguous response; every subsequent attempt addresses the original job ID.
export async function createRemoteVideoJobs({ filePath, adapter, finalize, now = Date.now, autoStart = true, onError = console.error }) {
  let jobs = new Map();
  try {
    const data = JSON.parse(await readFile(filePath, "utf8"));
    if (data.version !== 1 || !Array.isArray(data.jobs) || data.jobs.some((job) => !job.runId || !job.spec)) {
      throw new Error("Invalid remote video job store. Restore the store before submitting generations.");
    }
    jobs = new Map(data.jobs.map((job) => [job.runId, job]));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let writes = Promise.resolve();
  let stopped = false;
  const workers = new Map();
  const timers = new Map();
  const creations = new Map();
  const iso = () => new Date(now()).toISOString();

  function commit(runId, patch) {
    const operation = writes.then(async () => {
      const next = { ...jobs.get(runId), ...patch, runId, updatedAt: iso() };
      const snapshot = new Map(jobs);
      snapshot.set(runId, next);
      await writeJsonAtomic(filePath, { version: 1, jobs: [...snapshot.values()] });
      jobs = snapshot;
      return next;
    });
    writes = operation.catch(() => {});
    return operation;
  }

  function schedule(runId, delay = 0) {
    if (!autoStart || stopped || timers.has(runId) || remoteVideoTerminal(jobs.get(runId))) return;
    const timer = setTimeout(() => {
      timers.delete(runId);
      step(runId).catch(onError);
    }, delay);
    timer.unref?.();
    timers.set(runId, timer);
  }

  async function advance(runId) {
    let job = jobs.get(runId);
    if (!job || stopped || remoteVideoTerminal(job)) return;
    // A process can die between acceptance and recording the provider's ID.
    if (!job.requestId && job.submissionStartedAt) {
      await commit(runId, { state: "uncertain", message: "Submission outcome unknown. Check the provider before starting another generation; no automatic resubmission." });
      return;
    }
    try {
      if (!job.remote) {
        const client = await adapter(job.spec);
        if (!job.requestId) {
          job = await commit(runId, { state: "submitting", submissionStartedAt: iso(), message: "Submitting to provider" });
          let accepted;
          try {
            accepted = await client.submit(job.spec);
          } catch (error) {
            await commit(runId, {
              state: error.confirmedFailure ? "failed" : "uncertain",
              message: error.confirmedFailure ? error.message : "Submission outcome unknown. Check the provider before starting another generation; no automatic resubmission."
            });
            return;
          }
          if (!accepted?.requestId) {
            await commit(runId, { state: "uncertain", message: "Provider returned no job ID. Check the provider; no automatic resubmission." });
            return;
          }
          job = await commit(runId, { requestId: accepted.requestId, state: "queued", message: "Queued with provider" });
        }
        const status = await client.poll(job);
        const delayed = now() - Date.parse(job.createdAt) >= remoteVideoWarningMs;
        const health = delayed ? "delayed" : "healthy";
        job = await commit(runId, {
          state: status.remote ? "downloading" : status.state || "running",
          remote: status.remote || null,
          providerStatus: status.providerStatus || "",
          percent: status.percent ?? null,
          queuePosition: status.queuePosition ?? null,
          lastContactAt: iso(), retryCount: 0, health,
          message: status.remote ? "Saving generated video" : delayed
            ? "Taking longer than 20 minutes; provider still reports " + (status.providerStatus || "pending") + ". Tracking original job."
            : status.message || "Generating with provider"
        });
      }
      if (job.remote) {
        const checkpoint = (patch) => commit(runId, patch);
        const result = await finalize(job, checkpoint);
        await commit(runId, { state: "completed", result, percent: 100, health: "healthy", message: "Complete" });
      }
    } catch (error) {
      job = jobs.get(runId);
      await commit(runId, {
        state: error.confirmedFailure ? "failed" : "recovering",
        health: "reconnecting", retryCount: (job.retryCount || 0) + 1,
        ...(error.refreshRemote ? { remote: null } : {}),
        message: error.confirmedFailure ? error.message : error.waitingForCredential
          ? "Waiting for the original provider key to be enabled and selected in Settings."
          : job.remote ? "Video generated; retrying local save. " + (error.safeMessage || "Check storage and network access.")
            : "Status temporarily unavailable; reconnecting to the original job."
      });
    }
  }

  function step(runId) {
    if (workers.has(runId)) return workers.get(runId);
    const work = advance(runId).finally(() => {
      workers.delete(runId);
      const job = jobs.get(runId);
      if (!job || job.state === "uncertain") return;
      const retryMs = job.retryCount ? Math.min(60000, 2000 * 2 ** Math.min(job.retryCount, 5)) : 0;
      const pollMs = now() - Date.parse(job.createdAt) >= remoteVideoWarningMs ? 15000 : 3000;
      schedule(runId, retryMs || pollMs);
    });
    workers.set(runId, work);
    return work;
  }

  function publicJob(job) {
    if (!job) return null;
    const body = job.spec.body;
    return {
      runId: job.runId, scope: remoteVideoScope(body), nodeId: body.nodeId,
      groupId: body.generationGroupId || job.runId,
      batchIndex: Number(body.generationBatchIndex) || 1, batchTotal: Number(body.generationBatchTotal) || 1,
      state: job.state, requestId: job.requestId || "", provider: job.spec.provider,
      model: job.spec.modelName, createdAt: job.createdAt, updatedAt: job.updatedAt,
      message: job.message, health: job.health || "healthy", lastContactAt: job.lastContactAt || null,
      result: job.result || null, outputTargetNodeId: body.outputTargetNodeId || ""
    };
  }

  const api = {
    async create(runId, spec, requestHash) {
      if (jobs.has(runId)) return api.get(runId);
      if (!creations.has(runId)) {
        const creation = commit(runId, { spec, requestHash, createdAt: iso(), state: "accepted", message: "Preparing provider submission" });
        creations.set(runId, creation);
        creation.finally(() => creations.delete(runId)).catch(() => {});
      }
      await creations.get(runId);
      if (!workers.has(runId)) schedule(runId);
      return api.get(runId);
    },
    get: (runId) => publicJob(jobs.get(runId)),
    matches: (runId, requestHash) => jobs.get(runId)?.requestHash === requestHash,
    list: (scope) => [...jobs.values()].filter((job) => remoteVideoScope(job.spec.body) === scope).map(publicJob),
    progress: () => {
      const activeGroups = new Set([...jobs.values()].filter((job) => !remoteVideoTerminal(job)).map((job) => job.spec.body.generationGroupId || job.runId));
      return [...jobs.values()].filter((job) => activeGroups.has(job.spec.body.generationGroupId || job.runId) || now() - Date.parse(job.updatedAt) < 5 * 60 * 1000).map((job) => ({
      runId: job.runId, nodeId: job.spec.body.nodeId, groupId: job.spec.body.generationGroupId || job.runId,
      batchIndex: Number(job.spec.body.generationBatchIndex) || 1, batchTotal: Number(job.spec.body.generationBatchTotal) || 1,
      message: job.message, updatedAt: job.updatedAt, requestId: job.requestId || "",
      kind: "video", label: job.spec.modelName, nodeTitle: job.spec.body.nodeTitle,
      status: job.state === "completed" ? "completed" : job.state === "failed" ? "failed" : job.state === "queued" ? "queued" : "running",
      phase: job.state === "completed" ? "complete" : job.state === "failed" ? "failed" : job.remote ? "downloading" : job.state === "queued" ? "queued" : "generating",
      percent: job.state === "completed" ? 100 : job.remote ? 95 : job.percent == null ? null : 10 + Math.min(100, job.percent) * 0.8,
      queuePosition: job.queuePosition ?? null, providerStatus: job.providerStatus || "",
      startedAt: job.createdAt, phaseStartedAt: job.createdAt
      }));
    },
    step,
    async close() {
      stopped = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      await Promise.allSettled([...workers.values()]);
      await writes;
    }
  };
  for (const runId of jobs.keys()) schedule(runId);
  return api;
}
