import assert from "node:assert/strict";
import test from "node:test";
import {
  providerKeyValidationRequest,
  providerKeyValidationResult,
  validateProviderKey,
  validateProviderKeys
} from "../server/provider-key-validation.js";

test("provider key checks use authenticated no-generation endpoints", () => {
  const fal = providerKeyValidationRequest("fal", "fal-secret");
  assert.equal(fal.url, "https://api.fal.ai/v1/models?limit=1");
  assert.equal(fal.options.headers.Authorization, "Key fal-secret");

  const google = providerKeyValidationRequest("google", "google-secret");
  assert.equal(google.url, "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1");
  assert.equal(google.options.headers["x-goog-api-key"], "google-secret");

  const krea = providerKeyValidationRequest("krea", "krea-secret");
  assert.equal(krea.url, "https://api.krea.ai/jobs?limit=1");
  assert.equal(krea.options.headers.Authorization, "Bearer krea-secret");

  const openAi = providerKeyValidationRequest("openAi", "openai-secret");
  assert.equal(openAi.url, "https://api.openai.com/v1/models?limit=1");
  assert.equal(openAi.options.headers.Authorization, "Bearer openai-secret");
});

test("provider key response statuses distinguish valid, invalid, and unavailable checks", () => {
  assert.deepEqual(providerKeyValidationResult(200), { status: "valid" });
  assert.deepEqual(providerKeyValidationResult(401), { status: "invalid", reason: "rejected" });
  assert.deepEqual(providerKeyValidationResult(403), { status: "invalid", reason: "rejected" });
  assert.deepEqual(providerKeyValidationResult(429), { status: "valid", reason: "rate-limited" });
  assert.deepEqual(providerKeyValidationResult(503), { status: "unverified", reason: "provider-unavailable" });
});

test("provider key validation does not send missing keys or return secret values", async () => {
  let calls = 0;
  const missing = await validateProviderKey("fal", "", {
    fetchImpl: async () => {
      calls += 1;
      return { status: 200 };
    }
  });
  assert.deepEqual(missing, { status: "missing" });
  assert.equal(calls, 0);

  const validation = await validateProviderKeys({ fal: "secret", openAi: "bad-secret" }, {
    fetchImpl: async (url) => ({ status: url.includes("openai.com") ? 401 : 200 })
  });
  assert.equal(validation.providers.fal.status, "valid");
  assert.equal(validation.providers.google.status, "missing");
  assert.equal(validation.providers.krea.status, "missing");
  assert.equal(validation.providers.openAi.status, "invalid");
  assert.equal(JSON.stringify(validation).includes("secret"), false);
});
