export function concurrencyLimit(value, fallback = 2) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.max(1, Math.min(32, Math.floor(number))) : fallback;
}

export function createWorkScheduler({ maxConcurrent = 4, limits = {}, defaultLimit = 2 } = {}) {
  const maximum = concurrencyLimit(maxConcurrent, 4);
  const queue = [];
  const activeByKey = new Map();
  let active = 0;
  function drain() {
    while (active < maximum) {
      const index = queue.findIndex((job) => (activeByKey.get(job.key) || 0) < concurrencyLimit(limits[job.key], defaultLimit));
      if (index < 0) return;
      const job = queue.splice(index, 1)[0];
      job.signal?.removeEventListener("abort", job.abort);
      if (job.signal?.aborted) { job.reject(job.signal.reason || new Error("Cancelled")); continue; }
      active++;
      activeByKey.set(job.key, (activeByKey.get(job.key) || 0) + 1);
      Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
        active--;
        activeByKey.set(job.key, activeByKey.get(job.key) - 1);
        drain();
      });
    }
  }
  return {
    run(task, { key = "default", signal } = {}) {
      return new Promise((resolve, reject) => {
        const job = { task, key, signal, resolve, reject };
        job.abort = () => {
          const index = queue.indexOf(job);
          if (index >= 0) { queue.splice(index, 1); reject(signal.reason || new Error("Cancelled")); }
        };
        if (signal?.aborted) { reject(signal.reason || new Error("Cancelled")); return; }
        signal?.addEventListener("abort", job.abort, { once: true });
        queue.push(job);
        drain();
      });
    },
    snapshot: () => ({ active, queued: queue.length, maxConcurrent: maximum, activeByKey: Object.fromEntries(activeByKey) })
  };
}
