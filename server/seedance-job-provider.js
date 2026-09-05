import { createHash } from "node:crypto";
import { providerProgressPercent } from "./generation-progress.js";
import { kreaApiBaseUrl } from "../src/kreaApi.js";

export function providerKeyFingerprint(key) {
  return createHash("sha256").update(String(key || "")).digest("hex");
}

export function confirmedProviderFailure(message) {
  return Object.assign(new Error(message), { confirmedFailure: true });
}

export function createSeedanceJobAdapter({ getKey, fetchImpl = fetch, extractKreaVideo }) {
  return async (spec) => {
    const key = await getKey(spec.provider);
    if (!key || providerKeyFingerprint(key) !== spec.credentialFingerprint) {
      throw Object.assign(new Error("Original credential unavailable"), { waitingForCredential: true });
    }
    const falProvider = spec.provider === "fal";
    const headers = { Authorization: `${falProvider ? "Key" : "Bearer"} ${key}`, "Content-Type": "application/json" };
    const safeMessage = (value) => String(value).replaceAll(key, "[redacted]").replace(/https?:\/\/[^\s]+/gi, "[provider URL]").slice(0, 600);
    // Direct queue HTTP avoids the SDK's automatic retries of paid POSTs.
    async function request(url, { submit = false, input, result = false } = {}) {
      const response = await fetchImpl(url, {
        method: submit ? "POST" : "GET", headers,
        ...(submit ? { body: JSON.stringify(input) } : {}),
        signal: AbortSignal.timeout(60000)
      });
      const body = await response.json();
      if (!response.ok) {
        const detail = typeof body?.detail === "string" ? body.detail : typeof body?.error === "string" ? body.error : typeof body?.message === "string" ? body.message : `Provider returned HTTP ${response.status}.`;
        const message = safeMessage(detail);
        // A missing status/result, auth problem or 5xx is not proof the render failed.
        if ((submit && [400, 401, 403, 404, 422].includes(response.status)) || (result && [400, 422].includes(response.status))) {
          throw Object.assign(confirmedProviderFailure(message), { statusCode: response.status });
        }
        throw Object.assign(new Error(message), { statusCode: response.status });
      }
      return body;
    }
    const queueRoot = `https://queue.fal.run/${spec.endpoint.split("/").slice(0, 2).join("/")}`;
    return {
      async submit() {
        const data = await request(falProvider ? `https://queue.fal.run/${spec.endpoint}` : `${kreaApiBaseUrl}${spec.endpoint}`, { submit: true, input: spec.input });
        return { requestId: falProvider ? data.request_id : data.job_id };
      },
      async poll(job) {
        const id = encodeURIComponent(job.requestId);
        const data = await request(falProvider ? `${queueRoot}/requests/${id}/status?logs=1` : `${kreaApiBaseUrl}/jobs/${id}`);
        const status = String(data.status || "").toLowerCase();
        if (["failed", "cancelled", "canceled"].includes(status)) {
          throw confirmedProviderFailure(safeMessage(typeof data.error === "string" ? data.error : `Provider ${status} this generation.`));
        }
        if (status === "completed") {
          const result = falProvider ? await request(`${queueRoot}/requests/${id}`, { result: true }) : data;
          if (result.error) throw confirmedProviderFailure(safeMessage(typeof result.error === "string" ? result.error : "Provider reported generation failure."));
          const video = falProvider ? result.video : { url: extractKreaVideo(result), content_type: "video/mp4", file_name: "video.mp4" };
          if (!video?.url) throw new Error("Completed job has no downloadable video yet.");
          return { providerStatus: data.status, remote: { video, seed: result.seed ?? null } };
        }
        const queued = ["queued", "pending", "in_queue"].includes(status);
        return {
          state: queued ? "queued" : "running", providerStatus: data.status,
          percent: providerProgressPercent(data), queuePosition: data.queue_position ?? null,
          message: queued ? "Queued with provider" : status === "processing" || status === "in_progress" ? "Generating with provider" : "Waiting for provider status"
        };
      }
    };
  };
}
