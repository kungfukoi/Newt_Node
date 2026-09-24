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

test("Fal submission validation identifies the rejected input field", async () => {
  const client = await adapter([{
    status: 422,
    body: {
      detail: [{
        loc: ["body", "prompt"],
        msg: "String should have at most 4000 characters",
        type: "string_too_long"
      }]
    }
  }])(spec("fal"));
  await assert.rejects(client.submit(), (error) => {
    assert.equal(error.confirmedFailure, true);
    assert.equal(error.statusCode, 422);
    assert.equal(error.message, "prompt: String should have at most 4000 characters");
    return true;
  });
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

test("Krea preserves structured provider failure details", async () => {
  const client = await adapter([{
    body: {
      status: "failed",
      error: { code: "internal", message: "Webhook timed out after 3600000ms" }
    }
  }])(spec("krea"));
  await assert.rejects(client.poll({ requestId: "id" }), (error) => {
    assert.equal(error.confirmedFailure, true);
    assert.equal(error.providerStatus, "failed");
    assert.match(error.message, /internal: Webhook timed out after 3600000ms/);
    return true;
  });
});

test("switching provider keys pauses recovery instead of silently using another account", async () => {
  let called = false;
  const factory = createSeedanceJobAdapter({ getKey: async () => "different-key", fetchImpl: async () => { called = true; } });
  await assert.rejects(factory(spec("fal")), (error) => error.waitingForCredential);
  assert.equal(called, false);
});

const atlasSpec = () => ({ ...spec("atlas"), endpoint: "bytedance/seedance-2.5/text-to-video", input: { model: "bytedance/seedance-2.5/text-to-video", prompt: "test" } });

test("Atlas submits once, tracks its original prediction, and retrieves completed video", async () => {
  const calls = [];
  const client = await adapter([
    { body: { code: 200, data: { id: "atlas-original", status: "created" } } },
    { body: { data: { id: "atlas-original", status: "pending" } } },
    { body: { data: { id: "atlas-original", status: "processing", progress: 0.5 } } },
    { body: { data: { id: "atlas-original", status: "succeeded", outputs: ["https://example.test/out.mp4"] } } }
  ], calls)(atlasSpec());
  const job = await client.submit();
  assert.equal(job.requestId, "atlas-original");
  assert.equal((await client.poll(job)).state, "queued");
  assert.equal((await client.poll(job)).percent, 50);
  assert.equal((await client.poll(job)).remote.video.url, "https://example.test/out.mp4");
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.equal(calls[0].url, "https://api.atlascloud.ai/api/v1/model/generateVideo");
  assert.equal(calls[1].url, "https://api.atlascloud.ai/api/v1/model/prediction/atlas-original");
  assert.equal(calls[0].headers.Authorization, `Bearer ${key}`);
});

test("Atlas distinguishes provider rejection from unknown acceptance without retrying POST", async () => {
  for (const [response, confirmed] of [
    [{ body: { code: 422, message: "Invalid input" } }, true],
    [{ status: 402, body: { message: "Insufficient balance" } }, true],
    [{ body: { code: 402, message: "Insufficient balance" } }, true],
    [{ status: 503, body: {} }, false],
    [new Error("connection lost"), false]
  ]) {
    const calls = [];
    const client = await adapter([response], calls)(atlasSpec());
    await assert.rejects(client.submit(), (error) => Boolean(error.confirmedFailure) === confirmed);
    assert.equal(calls.length, 1);
  }
});

test("Atlas polling rejects mismatched jobs, preserves temporary failures, and recognizes terminal failure", async () => {
  const client = await adapter([
    { status: 404, body: {} },
    { body: { data: { id: "wrong-job", status: "processing" } } },
    { body: { data: { id: "original", status: "failed", error: { message: "Input rejected" } } } }
  ])(atlasSpec());
  await assert.rejects(client.poll({ requestId: "original" }), (error) => !error.confirmedFailure);
  await assert.rejects(client.poll({ requestId: "original" }), /mismatched/);
  await assert.rejects(client.poll({ requestId: "original" }), (error) => error.confirmedFailure && /Input rejected/.test(error.message));
  const wrongKey = createSeedanceJobAdapter({ getKey: async () => "other-key", fetchImpl: () => assert.fail("Must not access another account") });
  await assert.rejects(wrongKey(atlasSpec()), (error) => error.waitingForCredential);
});
