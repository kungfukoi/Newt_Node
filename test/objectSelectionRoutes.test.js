import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { registerObjectSelectionRoutes } from "../server/routes/objectSelection.js";
import { mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createObjectSelectionCache } from "../server/object-selection-cache.js";

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
  const cachePost = body => fetch(`http://127.0.0.1:${server.address().port}/api/node/image-object-cache`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try { await run({ post, cachePost, calls, histories }); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
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

test("custom SAM 2 controls reach Fal and History; invalid values fail before submission", () => fixture(async ({ post, calls, histories }) => {
  const sam2 = { pointsPerSide: 64, confidence: .7, stability: .8, minRegionArea: 20 };
  assert.equal((await post({ sam2 })).status, 200);
  assert.equal(calls[0].input.points_per_side, 64);
  assert.equal(calls[0].input.pred_iou_thresh, .7);
  assert.equal(calls[0].input.stability_score_thresh, .8);
  assert.equal(calls[0].input.min_mask_region_area, 20);
  assert.deepEqual(histories[0].settings.sam2, sam2);
  for (const invalid of [{ pointsPerSide: 1000 }, { confidence: -1 }, { stability: "0.8" }, { minRegionArea: .5 }, null]) assert.equal((await post({ sam2: invalid })).status, 400);
  assert.equal(calls.length, 1);
}));

test("box object identification stays within SAM 3's mask limit", () => fixture(async ({ post, histories }) => {
  const response = await post({ prompt: "the object to move and rotate" });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.model, "SAM 3");
  assert.equal(result.masks[0].area, 128);
  assert.equal(histories.length, 1);
}, {
  subscribe: async (endpoint, { input }) => {
    assert.equal(endpoint, "fal-ai/sam-3/image");
    if (!Number.isInteger(input.max_masks) || input.max_masks < 1 || input.max_masks > 32) {
      throw Object.assign(new Error("max_masks: Input should be less than or equal to 32"), { status: 422 });
    }
    return { data: { masks: [{ url: "mask" }] } };
  }
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

test("scans persist across route/store recreation and URL changes without credentials or new usage", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-object-scans-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await fixture(async ({ post, calls }) => {
    assert.equal((await post({})).status, 200);
    assert.equal((await (await post({ sourceUrl: "/outputs/renamed.png" })).json()).cached, true);
    assert.equal(calls.length, 1);
  }, { cache: createObjectSelectionCache(directory) });
  await fixture(async ({ post, cachePost, calls, histories }) => {
    const restored = await (await cachePost({ sourceUrl: "/uploads/test.png" })).json();
    assert.equal(restored.entries.length, 1);
    assert.equal(restored.entries[0].data.masks[0].area, 128);
    assert.equal((await (await post({})).json()).cached, true);
    assert.equal((await post({ rescan: true })).status, 400);
    assert.equal((await post({ sam2: { confidence: .5 } })).status, 400);
    assert.equal(calls.length, 0); assert.equal(histories.length, 0);
  }, { cache: createObjectSelectionCache(directory), available: () => false });
});

test("edited images inherit reusable masks, changed settings miss, and rescan replaces only the current image", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-object-scans-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const image = async (color, width = 16) => sharp({ create: { width, height: 8, channels: 3, background: color } }).png().toBuffer();
  const assets = { original: await image("red"), edited: await image("blue"), cropped: await image("green", 8) };
  const overrides = { cache: createObjectSelectionCache(directory), readSource: async url => ({ buffer: assets[url] }) };
  await fixture(async ({ post, cachePost, calls, histories }) => {
    const original = await (await post({ sourceUrl: "original" })).json();
    assert.equal((await (await cachePost({ sourceUrl: "original", targetUrl: "edited" })).json()).inherited, true);
    const inherited = await (await post({ sourceUrl: "edited" })).json();
    assert.deepEqual(inherited.masks, original.masks); assert.equal(inherited.inherited, true);
    assert.equal(calls.length, 1); assert.equal(histories.length, 1);
    assert.equal((await (await cachePost({ sourceUrl: "original", targetUrl: "cropped" })).json()).inherited, false);
    assert.deepEqual((await (await cachePost({ sourceUrl: "cropped" })).json()).entries, []);
    const fresh = await (await post({ sourceUrl: "edited", rescan: true })).json();
    assert.equal(fresh.inherited, false); assert.notDeepEqual(fresh.masks[0].id, original.masks[0].id);
    // Linking the earlier scan again must not overwrite the target's fresh scan.
    await cachePost({ sourceUrl: "original", targetUrl: "edited" });
    assert.equal((await (await post({ sourceUrl: "edited" })).json()).inherited, false);
    assert.deepEqual((await (await post({ sourceUrl: "original" })).json()).masks, original.masks);
    await post({ sourceUrl: "edited", sam2: { confidence: .7 } });
    assert.equal(calls.length, 3); assert.equal(histories.length, 3);
  }, overrides);
});

test("cache persistence failure preserves completed inference and never retries it", () => fixture(async ({ post, calls, histories }) => {
  const requestId = randomUUID();
  const result = await (await post({ requestId })).json();
  assert.equal(result.masks[0].area, 128);
  assert.match(result.warning, /could not be saved/);
  assert.deepEqual(await (await post({ requestId })).json(), result);
  assert.equal(calls.length, 1); assert.equal(histories.length, 1);
}, { cache: { get: async () => [], put: async () => { throw new Error("disk full"); } } }));

test("changed bytes at the same URL never reuse an unrelated scan, and corrupt cache records recover", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-object-scans-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let color = "red";
  await fixture(async ({ post, calls }) => {
    const original = await (await post({})).json();
    color = "blue";
    const changed = await (await post({})).json();
    assert.notEqual(changed.masks[0].id, original.masks[0].id);
    assert.equal(calls.length, 2);
    for (const name of await readdir(directory)) await writeFile(path.join(directory, name), "{broken");
    assert.equal((await post({})).status, 200);
    assert.equal(calls.length, 3);
    assert.equal((await (await post({})).json()).cached, true);
    assert.equal(calls.length, 3);
  }, {
    cache: createObjectSelectionCache(directory),
    readSource: async () => ({ buffer: await sharp({ create: { width: 16, height: 8, channels: 3, background: color } }).png().toBuffer() })
  });
});
