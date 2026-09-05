import { openRemoteJobStore } from "./remote-job-store.js";
import { randomUUID } from "node:crypto";
import { appendJobEvent, jobErrorDiagnostic } from "./job-diagnostics.js";
import { concurrencyLimit } from "../src/workScheduler.js";
import { remoteVideoScope, remoteVideoTerminal, remoteVideoNeedsAttention, remoteVideoWarningMs } from "../src/remoteVideoJobs.js";

// One worker per durable run. Provider submission is never retried after an
// ambiguous response; every subsequent attempt addresses the original job ID.
export async function createRemoteVideoJobs({ filePath, adapter, finalize, importResult, now = Date.now, autoStart = true, onError = console.error, providerLimits = { fal: 2, krea: 2 } }) {
  const store = await openRemoteJobStore(filePath);
  const jobs = store.jobs;
  const persistedAt = new Map();
  const epoch = randomUUID();
  let revision = 0;
  const revisions = new Map();
  let writes = Promise.resolve();
  let stopped = false;
  const workers = new Map();
  const timers = new Map();
  const creations = new Map();
  const submissionReservations = new Set();
  const recoveryActions = new Map();
  const recoveryIds = new Set();
  const iso = () => new Date(now()).toISOString();

  function commit(runId, patch, { heartbeat = false } = {}) {
    const operation = writes.then(async () => {
      const previous = jobs.get(runId);
      const next = { ...previous, ...patch, runId, updatedAt: iso() };
      const transitioned = next.state !== previous?.state || next.providerStatus !== previous?.providerStatus;
      if (transitioned || patch.lastError) {
        next.events = appendJobEvent(previous?.events, { at: next.updatedAt, state: next.state, ...(patch.lastError ? { error: patch.lastError } : {}) });
      }
      if (!heartbeat || transitioned || now() - (persistedAt.get(runId) || 0) >= 30000) {
        await store.save(next);
        persistedAt.set(runId, now());
      }
      jobs.set(runId, next);
      revisions.set(runId, ++revision);
      return next;
    });
    writes = operation.catch(() => {});
    return operation;
  }

  function schedule(runId, delay = 0) {
    if (!autoStart || stopped || timers.has(runId) || remoteVideoTerminal(jobs.get(runId)) || remoteVideoNeedsAttention(jobs.get(runId))) return;
    const timer = setTimeout(() => {
      timers.delete(runId);
      step(runId).catch(onError);
    }, delay);
    timer.unref?.();
    timers.set(runId, timer);
  }

  async function advance(runId) {
    let job = jobs.get(runId);
    if (!job || stopped || remoteVideoTerminal(job) || remoteVideoNeedsAttention(job)) return;
    // A process can die between acceptance and recording the provider's ID.
    if (!job.requestId && job.submissionStartedAt && !job.remote) {
      await commit(runId, { state: "uncertain", health: "attention", message: "Needs attention: submission acceptance is unknown after a restart. Check the provider before starting another generation; no automatic resubmission." });
      return;
    }
    if (!job.requestId && !job.remote) {
      const provider = job.spec.provider;
      const activeJobs = [...jobs.values()].filter((entry) => entry.spec.provider === provider && !remoteVideoTerminal(entry) && !remoteVideoNeedsAttention(entry) && !entry.remote);
      const occupied = activeJobs.filter((entry) => entry.requestId || entry.submissionStartedAt || submissionReservations.has(entry.runId)).length;
      const waiting = activeJobs.filter((entry) => !entry.requestId && !entry.submissionStartedAt && !submissionReservations.has(entry.runId))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.runId.localeCompare(b.runId));
      if (waiting.findIndex((entry) => entry.runId === runId) >= concurrencyLimit(providerLimits[provider], 2) - occupied) {
        if (job.message !== "Waiting for a provider slot") await commit(runId, { state: "accepted", message: "Waiting for a provider slot" });
        return;
      }
      submissionReservations.add(runId);
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
              health: error.confirmedFailure ? "failed" : "attention",
              lastError: jobErrorDiagnostic(error),
              message: error.confirmedFailure ? error.message : "Needs attention: submission acceptance is unknown. Check the provider before starting another generation; no automatic resubmission."
            });
            return;
          }
          if (!accepted?.requestId) {
            await commit(runId, { state: "uncertain", health: "attention", message: "Needs attention: provider returned no job ID. Check the provider; no automatic resubmission." });
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
          lastContactAt: iso(), retryCount: 0, health, lastError: null,
          message: status.remote ? "Saving generated video" : delayed
            ? "Taking longer than 20 minutes; provider still reports " + (status.providerStatus || "pending") + ". Tracking original job."
            : status.message || "Generating with provider"
        }, { heartbeat: !status.remote });
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
        lastError: jobErrorDiagnostic(error),
        ...(error.refreshRemote ? { remote: null } : {}),
        message: error.confirmedFailure ? error.message : error.waitingForCredential
          ? "Waiting for the original provider key to be enabled and selected in Settings."
          : job.remote ? "Video generated; retrying local save. " + (error.safeMessage || "Check storage and network access.")
            : "Status temporarily unavailable; reconnecting to the original job."
      });
    } finally {
      submissionReservations.delete(runId);
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
      needsAttention: remoteVideoNeedsAttention(job), retryCount: job.retryCount || 0,
      lastError: job.lastError || null, events: job.events || [],
      result: job.result || null, outputTargetNodeId: body.outputTargetNodeId || ""
    };
  }

  const api = {
    recover(runId, input = {}) {
      const job = jobs.get(runId);
      const reject = (message, statusCode = 409) => Promise.reject(Object.assign(new Error(message), { statusCode }));
      if (!job) return reject("Job not found.", 404);
      if (input.scope !== remoteVideoScope(job.spec.body)) return reject("The job belongs to a different workflow.", 403);
      if (!input.acknowledged) return reject("Confirm that this action matches the original provider job.", 400);
      if (!remoteVideoNeedsAttention(job) || workers.has(runId) || recoveryActions.has(runId)) return reject("Only an idle, uncertain submission can be recovered here.");
      const operation = Promise.resolve().then(async () => {
        if (input.action === "dismiss") {
          await commit(runId, { state: "dismissed", health: "attention", message: "Local tracking dismissed. This does not cancel a remote generation or refund a charge." });
        } else if (input.action === "attach") {
          const requestId = String(input.requestId || "").trim();
          if (!/^[a-zA-Z0-9_-]{8,180}$/.test(requestId)) throw Object.assign(new Error("Enter a valid provider job ID, not a URL."), { statusCode: 400 });
          const reservation = `${job.spec.provider}:${requestId}`;
          if (recoveryIds.has(reservation) || [...jobs.values()].some((entry) => entry.runId !== runId && entry.spec.provider === job.spec.provider && entry.requestId === requestId)) {
            throw Object.assign(new Error("That provider job is already tracked by another run."), { statusCode: 409 });
          }
          recoveryIds.add(reservation);
          try {
            const client = await adapter(job.spec);
            // Validate against the original provider, model endpoint and credential.
            // Never call submit during recovery.
            await client.poll({ ...job, requestId });
            await commit(runId, { requestId, state: "queued", health: "healthy", lastError: null, message: "Provider job attached; resuming original job tracking." });
          } finally { recoveryIds.delete(reservation); }
        } else if (input.action === "import" && importResult) {
          const patch = await importResult(job, input.assetUrl);
          await commit(runId, { ...patch, state: "downloading", health: "healthy", message: "Saving manually recovered result." });
        } else throw Object.assign(new Error("Unsupported recovery action."), { statusCode: 400 });
        schedule(runId);
        return api.get(runId);
      }).catch(async (error) => {
        if (remoteVideoNeedsAttention(jobs.get(runId))) await commit(runId, { lastError: jobErrorDiagnostic(error) });
        throw error;
      }).finally(() => recoveryActions.delete(runId));
      recoveryActions.set(runId, operation);
      return operation;
    },
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
    diagnostics: () => [...jobs.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).slice(-50).map(publicJob),
    matches: (runId, requestHash) => jobs.get(runId)?.requestHash === requestHash,
    list: (scope) => [...jobs.values()].filter((job) => remoteVideoScope(job.spec.body) === scope).map(publicJob),
    changes(scope, cursor = "") {
      const [oldEpoch, oldRevision] = String(cursor).split(":");
      const incremental = oldEpoch === epoch && /^\d+$/.test(oldRevision) && Number(oldRevision) <= revision;
      const owned = [...jobs.values()].filter((job) => remoteVideoScope(job.spec.body) === scope);
      const active = owned.some((job) => !remoteVideoTerminal(job) && !remoteVideoNeedsAttention(job));
      return {
        jobs: owned.filter((job) => !incremental || (revisions.get(job.runId) || 0) > Number(oldRevision)).map((job) => {
          const { events, ...summary } = publicJob(job);
          return summary;
        }),
        cursor: `${epoch}:${revision}`, reset: !incremental, pollAfterMs: active ? 3000 : 15000
      };
    },
    progress: () => {
      const activeGroups = new Set([...jobs.values()].filter((job) => !remoteVideoTerminal(job) && !remoteVideoNeedsAttention(job)).map((job) => job.spec.body.generationGroupId || job.runId));
      return [...jobs.values()].filter((job) => activeGroups.has(job.spec.body.generationGroupId || job.runId) || now() - Date.parse(job.updatedAt) < 5 * 60 * 1000).map((job) => ({
      runId: job.runId, nodeId: job.spec.body.nodeId, groupId: job.spec.body.generationGroupId || job.runId,
      batchIndex: Number(job.spec.body.generationBatchIndex) || 1, batchTotal: Number(job.spec.body.generationBatchTotal) || 1,
      message: job.message, updatedAt: job.updatedAt, requestId: job.requestId || "",
      kind: "video", label: job.spec.modelName, nodeTitle: job.spec.body.nodeTitle,
      status: remoteVideoNeedsAttention(job) ? "attention" : job.state === "completed" ? "completed" : remoteVideoTerminal(job) ? "failed" : job.state === "queued" ? "queued" : "running",
      phase: remoteVideoNeedsAttention(job) ? "attention" : job.state === "completed" ? "complete" : remoteVideoTerminal(job) ? "failed" : job.remote ? "downloading" : job.state === "queued" ? "queued" : "generating",
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
      await Promise.allSettled([...recoveryActions.values()]);
      await writes;
    }
  };
  for (const runId of jobs.keys()) schedule(runId);
  return api;
}
