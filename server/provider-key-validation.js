const providerKeyValidationTimeoutMs = 8000;

export async function validateProviderKeys(keys = {}, { fetchImpl = fetch, timeoutMs = providerKeyValidationTimeoutMs } = {}) {
  const checkedAt = new Date().toISOString();
  const entries = await Promise.all(
    ["fal", "google", "krea", "openAi"].map(async (provider) => [
      provider,
      await validateProviderKey(provider, keys[provider], { fetchImpl, timeoutMs })
    ])
  );
  return { checkedAt, providers: Object.fromEntries(entries) };
}

export async function validateProviderKey(provider, key, { fetchImpl = fetch, timeoutMs = providerKeyValidationTimeoutMs } = {}) {
  const credential = String(key || "").trim();
  if (!credential) return { status: "missing" };

  const request = providerKeyValidationRequest(provider, credential);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || providerKeyValidationTimeoutMs));
  timeout.unref?.();
  try {
    const response = await fetchImpl(request.url, { ...request.options, signal: controller.signal });
    return providerKeyValidationResult(response.status);
  } catch (error) {
    return { status: "unverified", reason: error?.name === "AbortError" ? "timeout" : "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export function providerKeyValidationRequest(provider, key) {
  if (provider === "fal") {
    return {
      url: "https://api.fal.ai/v1/models?limit=1",
      options: { method: "GET", headers: { Authorization: `Key ${key}` } }
    };
  }
  if (provider === "google") {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      options: { method: "GET", headers: { "x-goog-api-key": key } }
    };
  }
  if (provider === "krea") {
    return {
      url: "https://api.krea.ai/jobs?limit=1",
      options: { method: "GET", headers: { Authorization: `Bearer ${key}` } }
    };
  }
  if (provider === "openAi") {
    return {
      url: "https://api.openai.com/v1/models?limit=1",
      options: { method: "GET", headers: { Authorization: `Bearer ${key}` } }
    };
  }
  throw new Error(`Unsupported API key provider: ${provider}`);
}

export function providerKeyValidationResult(statusCode) {
  const status = Number(statusCode);
  if (status >= 200 && status < 300) return { status: "valid" };
  if ([400, 401, 403].includes(status)) return { status: "invalid", reason: "rejected" };
  if (status === 429) return { status: "valid", reason: "rate-limited" };
  return { status: "unverified", reason: status >= 500 ? "provider-unavailable" : "unexpected-response" };
}
