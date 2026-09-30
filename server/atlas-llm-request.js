import { setTimeout as sleep } from "node:timers/promises";
import { AsyncResource } from "node:async_hooks";
import { createWorkScheduler } from "../src/workScheduler.js";

// Share admission across text and image analysis, including rate-limit backoff.
// Only explicit rejections are retried; an interrupted paid request is uncertain.
export function createAtlasLlmRequest({ fetchImpl = fetch, wait = sleep, random = Math.random, now = Date.now } = {}) {
  const scheduler = createWorkScheduler({ maxConcurrent: 1 });
  return async function request(endpoint, options, onProgress = () => {}) {
    const signal = options.signal || AbortSignal.timeout(300000);
    const report = AsyncResource.bind(onProgress);
    report({ status: "running", phase: "queued", message: "Waiting for Atlas Cloud" });
    return scheduler.run(async () => {
      for (let attempt = 0; ; attempt++) {
        signal.throwIfAborted();
        report({ status: "running", phase: "generating", message: "Processing with Atlas Cloud" });
        const response = await fetchImpl(endpoint, { ...options, signal });
        let data;
        try { data = await response.json(); }
        catch { signal.throwIfAborted(); data = null; }
        const providerCode = Number(data?.code || data?.error?.code);
        const errorStatus = !response.ok ? response.status
          : providerCode >= 400 && providerCode <= 599 ? providerCode
          : !data || data.error ? 502 : 0;
        const result = { response, data: data || {}, errorStatus };
        if (errorStatus !== 429 || attempt >= 3) return result;

        const retryAfter = response.headers.get("retry-after");
        const requestedDelay = retryAfter === null ? 0
          : /^\d+(\.\d+)?$/.test(retryAfter.trim()) ? Number(retryAfter) * 1000
          : Math.max(0, Date.parse(retryAfter) - now()) || 0;
        // Do not ignore a provider delay that exceeds this bounded retry window.
        if (requestedDelay > 60000) return result;
        const delayMs = Math.max(requestedDelay, 3000 * 2 ** attempt + Math.floor(random() * 1000));
        report({ status: "running", phase: "queued", message: `Atlas Cloud rate limit; retrying in ${Math.ceil(delayMs / 1000)}s (${attempt + 1}/3)` });
        await wait(delayMs, undefined, { signal });
      }
    }, { signal });
  };
}
