export function createRemoteVideoRequests({ get, list, now = Date.now, freshMs = 2000 }) {
  const requests = new Map();
  const snapshots = new Map();
  const maximumSnapshots = 500;

  function remember(job) {
    if (!job?.runId) return;
    snapshots.delete(job.runId);
    snapshots.set(job.runId, { at: now(), job });
    if (snapshots.size > maximumSnapshots) snapshots.delete(snapshots.keys().next().value);
  }

  async function coalesce(key, request) {
    if (requests.has(key)) return requests.get(key);
    const pending = Promise.resolve().then(request);
    requests.set(key, pending);
    try { return await pending; }
    finally { if (requests.get(key) === pending) requests.delete(key); }
  }

  return {
    async get(runId) {
      const cached = snapshots.get(runId);
      if (cached && now() - cached.at < freshMs) return { response: { ok: true, status: 200 }, data: { job: cached.job } };
      const result = await coalesce(`job:${runId}`, () => get(runId));
      if (result.response.ok) remember(result.data.job);
      return result;
    },
    async list(scope, cursor = "") {
      const result = await coalesce(`scope:${scope}:${cursor}`, () => list(scope, cursor));
      if (result.response.ok) (result.data.jobs || []).forEach(remember);
      return result;
    }
  };
}
