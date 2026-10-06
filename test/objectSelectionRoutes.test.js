import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { registerObjectSelectionRoutes } from "../server/routes/objectSelection.js";

async function fixture(run, overrides = {}) {
  const mask = await sharp({ create: { width: 16, height: 8, channels: 3, background: "white" } }).png().toBuffer();
  const calls = [], histories = [];
  const app = express(); app.use(express.json());
  registerObjectSelectionRoutes(app, {
    limiter: (_req, _res, next) => next(), available: () => true, readSource: async () => ({ buffer: mask }),
    upload: async () => "https://example.test/input", readMask: async () => mask,
    subscribe: async (endpoint, options) => { calls.push({ endpoint, ...options }); return { requestId: randomUUID(), data: { masks: [{ url: "mask" }], individual_masks: [{ url: "mask" }] } }; },
    recordHistory: async row => histories.push(row), sendError: (res, error) => res.status(error.status || 500).json({ error: error.message }), ...overrides
  });
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  const post = body => fetch(`http://127.0.0.1:${server.address().port}/api/node/image-objects`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceUrl: "/uploads/test.png", requestId: randomUUID(), ...body }) });
  try { await run({ post, calls, histories }); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test("object map and prompt/point selection use explicit Fal endpoints and record usage", () => fixture(async ({ post, calls, histories }) => {
  const result = await (await post({})).json();
  assert.equal(result.masks[0].area, 128);
  assert.match(calls[0].endpoint, /sam2\/auto-segment$/);
  await post({ prompt: "the jacket" }); await post({ point: { x: .5, y: .5 } });
  assert.match(calls[1].endpoint, /sam-3\/image$/);
  assert.equal(calls[1].input.prompt, "the jacket");
  assert.equal(histories.length, 3);
  assert.equal(histories[1].cost.amountUsd, .005);
  assert.equal(histories[0].localImage, "/uploads/test.png");
}));
test("concurrent duplicate selections share inference and reject conflicting payloads", () => fixture(async ({ post, calls }) => {
  const requestId = randomUUID();
  const responses = await Promise.all([post({ requestId }), post({ requestId })]);
  assert.deepEqual(await responses[0].json(), await responses[1].json());
  assert.equal(calls.length, 1);
  assert.equal((await post({ requestId, prompt: "other" })).status, 409);
}));
test("invalid prompts/points and missing Fal keys never submit paid work", async () => {
  await fixture(async ({ post, calls }) => {
    for (const body of [{ point: { x: -1, y: .5 } }, { prompt: " " }, { prompt: "x".repeat(301) }, { prompt: "person", point: { x: .5, y: .5 } }]) assert.equal((await post(body)).status, 400);
    assert.equal(calls.length, 0);
  });
  await fixture(async ({ post, calls }) => { assert.equal((await post({})).status, 400); assert.equal(calls.length, 0); }, { available: () => false });
});
test("completed inference is recorded even if mask download fails and is not replayed", () => fixture(async ({ post, calls, histories }) => {
  const requestId = randomUUID();
  assert.equal((await post({ requestId })).status, 502);
  assert.equal((await post({ requestId })).status, 502);
  assert.equal(histories.length, 1); assert.equal(calls.length, 1);
}, { readMask: async () => { throw new Error("unavailable"); } }));
