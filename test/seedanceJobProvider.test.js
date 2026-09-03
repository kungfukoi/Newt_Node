import assert from "node:assert/strict";
import test from "node:test";
import { createSeedanceJobAdapter, providerKeyFingerprint } from "../server/seedance-job-provider.js";

const key = "test-only-not-a-real-key";
function spec(provider) { return { provider, credentialFingerprint: providerKeyFingerprint(key), endpoint: provider === "fal" ? "bytedance/seedance-2.5/reference-to-video" : "/generate/video/bytedance/seedance-2-5", input: { prompt: "test" } }; }
function adapter(responses, calls = []) {
  return createSeedanceJobAdapter({
    getKey: async () => key,
    extractKreaVideo: (data) => data.result?.url,
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return new Response(JSON.stringify(response.body), { status: response.status || 200 });
    }
  });
}

test("Fal submits once and uses model-root status/result endpoints with original ID", async () => {
  const calls = [];
  const client = await adapter([
    { body: { request_id: "original" } }, { body: { status: "IN_QUEUE", queue_position: 4 } },
    { body: { status: "COMPLETED" } }, { body: { video: { url: "https://example.test/out.mp4" }, seed: 42 } }
  ], calls)(spec("fal"));
  assert.equal((await client.submit()).requestId, "original");
  assert.equal((await client.poll({ requestId: "original" })).queuePosition, 4);
  assert.equal((await client.poll({ requestId: "original" })).remote.seed, 42);
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(calls[1].url, "https://queue.fal.run/bytedance/seedance-2.5/requests/original/status?logs=1");
  assert.equal(calls[3].url, "https://queue.fal.run/bytedance/seedance-2.5/requests/original");
  assert.ok(calls.every((call) => call.signal instanceof AbortSignal));
});

test("Fal COMPLETED can contain a failed result", async () => {
  const client = await adapter([{ body: { status: "COMPLETED" } }, { status: 422, body: { detail: "Invalid reference" } }])(spec("fal"));
  await assert.rejects(client.poll({ requestId: "id" }), (error) => error.confirmedFailure && /Invalid reference/.test(error.message));
});

test("network/5xx/404 status errors never prove provider failure or retry POST", async () => {
  for (const response of [new Error("fetch failed"), { status: 503, body: {} }]) {
    const calls = [];
    const client = await adapter([response], calls)(spec("fal"));
    await assert.rejects(client.submit(), (error) => !error.confirmedFailure);
    assert.equal(calls.length, 1);
  }
  const client = await adapter([{ status: 404, body: {} }])(spec("krea"));
  await assert.rejects(client.poll({ requestId: "id" }), (error) => !error.confirmedFailure);
});

test("Krea reads original jobs, processes completion, and recognizes cancellation", async () => {
  const calls = [];
  const client = await adapter([
    { body: { job_id: "krea-id" } }, { body: { status: "processing" } },
    { body: { status: "completed", result: { url: "https://example.test/out.mp4" } } },
    { body: { status: "cancelled" } }
  ], calls)(spec("krea"));
  assert.equal((await client.submit()).requestId, "krea-id");
  assert.equal((await client.poll({ requestId: "krea-id" })).state, "running");
  assert.equal((await client.poll({ requestId: "krea-id" })).remote.video.url, "https://example.test/out.mp4");
  await assert.rejects(client.poll({ requestId: "krea-id" }), (error) => error.confirmedFailure);
  assert.equal(calls[1].url, "https://api.krea.ai/jobs/krea-id");
  assert.equal(calls[0].headers.Authorization, `Bearer ${key}`);
});

test("switching provider keys pauses recovery instead of silently using another account", async () => {
  let called = false;
  const factory = createSeedanceJobAdapter({ getKey: async () => "different-key", fetchImpl: async () => { called = true; } });
  await assert.rejects(factory(spec("fal")), (error) => error.waitingForCredential);
  assert.equal(called, false);
});
