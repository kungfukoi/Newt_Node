import { createHash } from "node:crypto";
import { providerProgressPercent } from "./generation-progress.js";
import { kreaApiBaseUrl } from "../src/kreaApi.js";

export function providerKeyFingerprint(key) {
  return createHash("sha256").update(String(key || "")).digest("hex");
}

export function confirmedProviderFailure(message) {
  return Object.assign(new Error(message), { confirmedFailure: true });
}

function providerErrorText(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    return [...new Set(value.map(providerErrorText).filter(Boolean))].slice(0, 4).join("; ");
  }
  const location = Array.isArray(value.loc)
    ? value.loc.map(String).filter((part, index) => !(index === 0 && part === "body")).join(".")
    : typeof value.loc === "string" ? value.loc.trim() : "";
  const message = [value.msg, value.message]
    .find((item) => typeof item === "string" && item.trim())
    || providerErrorText(value.detail)
    || providerErrorText(value.error);
  const code = typeof value.code === "string" ? value.code.trim() : "";
  const detail = code && message ? `${code}: ${message.trim()}` : message?.trim() || code;
  return location && detail ? `${location}: ${detail}` : detail;
}

function providerFailureText(body, fallback) {
  return providerErrorText(body?.detail)
    || providerErrorText(body?.error)
    || providerErrorText(body?.message)
    || fallback;
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
        const detail = providerFailureText(body, `Provider returned HTTP ${response.status}.`);
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
          throw Object.assign(
            confirmedProviderFailure(safeMessage(providerFailureText(data, `Provider ${status} this generation.`))),
            { providerStatus: status }
          );
        }
        if (status === "completed") {
          const result = falProvider ? await request(`${queueRoot}/requests/${id}`, { result: true }) : data;
          if (result.error) {
            throw Object.assign(
              confirmedProviderFailure(safeMessage(providerFailureText(result, "Provider reported generation failure."))),
              { providerStatus: "failed" }
            );
          }
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
