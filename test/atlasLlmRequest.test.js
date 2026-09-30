import test from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createAtlasLlmRequest } from "../server/atlas-llm-request.js";
import { atlasError } from "../server/atlas.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
const endpoint = "https://api.atlascloud.ai/v1/responses";
const options = { method: "POST", body: JSON.stringify({ model: "selected-model", input: "Test" }) };

test("Atlas retries HTTP and envelope rate limits without changing the request", async () => {
  const calls = [], waits = [], progress = [];
  const responses = [json({ msg: "too many requests" }, 429), json({ code: 429 }), json({ output_text: "OK" })];
  const request = createAtlasLlmRequest({
    fetchImpl: async (url, init) => { calls.push({ url, body: init.body }); return responses.shift(); },
    wait: async (ms) => { waits.push(ms); }, random: () => 0
  });
  const result = await request(endpoint, options, (entry) => progress.push(entry));
  assert.equal(result.data.output_text, "OK");
  assert.deepEqual(waits, [3000, 6000]);
  assert.deepEqual(calls, Array(3).fill({ url: endpoint, body: options.body }));
  assert.equal(progress.filter((entry) => /rate limit/.test(entry.message)).length, 2);
});

test("Atlas bounds repeated rate-limit retries and surfaces an actionable error", async () => {
  let calls = 0;
  const request = createAtlasLlmRequest({ fetchImpl: async () => { calls++; return json({ code: 429 }); }, wait: async () => {}, random: () => 0 });
  const result = await request(endpoint, options);
  assert.equal(calls, 4);
  assert.equal(result.errorStatus, 429);
  assert.match(atlasError(result.data, result.errorStatus), /rate limiting.*429/);
});

test("Atlas does not retry billing, authentication, invalid or uncertain responses", async () => {
  for (const status of [400, 401, 402, 403, 413, 500, 504]) {
    let calls = 0;
    const request = createAtlasLlmRequest({ fetchImpl: async () => { calls++; return json({ msg: "Rejected" }, status); } });
    assert.equal((await request(endpoint, options)).errorStatus, status);
    assert.equal(calls, 1);
  }
  let calls = 0;
  const request = createAtlasLlmRequest({ fetchImpl: async () => { calls++; throw new TypeError("connection lost"); } });
  await assert.rejects(request(endpoint, options), /connection lost/);
  assert.equal(calls, 1);
});

test("Atlas honors Retry-After and does not shorten excessive provider delays", async () => {
  for (const header of ["10", "Wed, 30 Sep 2026 12:00:10 GMT", "90"]) {
    let calls = 0;
    const waits = [];
    const request = createAtlasLlmRequest({
      fetchImpl: async () => ++calls === 1 ? json({}, 429, { "Retry-After": header }) : json({ output_text: "OK" }),
      wait: async (ms) => { waits.push(ms); }, random: () => 0, now: () => Date.parse("2026-09-30T12:00:00Z")
    });
    await request(endpoint, options);
    assert.deepEqual(waits, header === "90" ? [] : [10000]);
  }
});

test("Atlas serializes text and vision requests while waiting to retry", async () => {
  let release, waiting;
  const waitStarted = new Promise((resolve) => { waiting = resolve; });
  const calls = [];
  const request = createAtlasLlmRequest({
    fetchImpl: async (_url, init) => { calls.push(init.body); return calls.length === 1 ? json({}, 429) : json({ output_text: "OK" }); },
    wait: async () => { waiting(); await new Promise((resolve) => { release = resolve; }); }
  });
  const first = request(endpoint, { body: "vision" });
  await waitStarted;
  const second = request(endpoint, { body: "text" });
  await Promise.resolve();
  assert.deepEqual(calls, ["vision"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(calls, ["vision", "vision", "text"]);
});

test("Atlas cancellation stops retries and releases the queue", async () => {
  const controller = new AbortController();
  let calls = 0;
  const request = createAtlasLlmRequest({
    fetchImpl: async () => ++calls === 1 ? json({}, 429) : json({ output_text: "OK" }),
    wait: async () => { controller.abort(new Error("Cancelled")); }
  });
  await assert.rejects(request(endpoint, { ...options, signal: controller.signal }), /Cancelled/);
  assert.equal((await request(endpoint, options)).data.output_text, "OK");
  assert.equal(calls, 2);
});

test("Atlas queued progress retains each caller's generation context", async () => {
  const context = new AsyncLocalStorage();
  const request = createAtlasLlmRequest({ fetchImpl: async () => json({ output_text: "OK" }) });
  const seen = [];
  await Promise.all(["first", "second"].map((id) => context.run(id, () => request(endpoint, options, (entry) => {
    if (entry.phase === "generating") seen.push([id, context.getStore()]);
  }))));
  assert.deepEqual(seen, [["first", "first"], ["second", "second"]]);
});

test("Atlas reports malformed successful bodies as upstream errors instead of empty text", async () => {
  const request = createAtlasLlmRequest({ fetchImpl: async () => new Response("not json") });
  assert.equal((await request(endpoint, options)).errorStatus, 502);
});

test("Atlas detects upstream credit errors embedded in HTTP 200 without retrying", async () => {
  let calls = 0;
  const request = createAtlasLlmRequest({ fetchImpl: async () => {
    calls++;
    return json({ code: 500, msg: "You have no credits remaining.", request_id: "test-request" });
  } });
  const result = await request(endpoint, options);
  assert.equal(result.errorStatus, 500);
  assert.match(atlasError(result.data, result.errorStatus), /no credits remaining/);
  assert.equal(calls, 1);
});
