import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { registerImageBoxNameRoutes } from "../server/routes/imageBoxNames.js";
import { boxNameInputs, parseBoxName } from "../server/image-edit-box-names.js";

const region = { x: .5, y: .5, w: .25, h: .25, rotation: 0 };
test("box naming receives a crop and a bounded full-scene context without distorting aspect", async () => {
  const buffer = await sharp({ create: { width: 1600, height: 800, channels: 4, background: "#333333" } }).png().toBuffer();
  const inputs = await boxNameInputs(buffer, region);
  const crop = await sharp(inputs[0].asset.buffer).metadata(), scene = await sharp(inputs[1].asset.buffer).metadata();
  assert.equal(crop.width, 400); assert.equal(crop.height, 200);
  assert.equal(scene.width, 1024); assert.equal(scene.height, 512);
});
test("uncertain names remain Object and invalid model output is rejected", () => {
  assert.deepEqual(parseBoxName('{"label":"pickleball","confidence":0.9}'), { label: "pickleball", confidence: .9 });
  assert.equal(parseBoxName('{"label":"tennis ball","confidence":0.4}').label, "Object");
  for (const text of ['{"label":"ball","confidence":2}', '{"confidence":0.9}', "not JSON"]) assert.throws(() => parseBoxName(text));
});

async function withNames(run, text = '{"label":"pickleball","confidence":0.9}') {
  const source = await sharp({ create: { width: 80, height: 60, channels: 4, background: "#333333" } }).png().toBuffer();
  const calls = [], histories = [], app = express(); app.use(express.json());
  registerImageBoxNameRoutes(app, { limiter: (_req, _res, next) => next(), readSource: async () => ({ buffer: source }),
    describe: async request => { calls.push(request); return { text, provider: "Atlas Cloud", model: "vision-fixture", endpoint: "vision", usages: [{ input_tokens: 10, output_tokens: 4 }] }; },
    recordHistory: async item => histories.push(item), estimateCost: () => ({ amountUsd: .001 }), sendError: (res, error) => res.status(error.status || 500).json({ error: error.message }) });
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  const post = changes => fetch(`http://127.0.0.1:${server.address().port}/api/node/identify-image-box`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceUrl: "/uploads/source.png", region, requestId: randomUUID(), projectId: "project", ...changes }) });
  try { await run({ post, calls, histories }); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test("naming validates before inference, deduplicates requests and caches matching crops with honest usage", () => withNames(async ({ post, calls, histories }) => {
  assert.equal((await post({ region: { ...region, x: 2 } })).status, 400); assert.equal(calls.length, 0);
  const requestId = randomUUID();
  for (let i = 0; i < 2; i++) assert.equal((await (await post({ requestId })).json()).label, "pickleball");
  assert.equal((await (await post({})).json()).cached, true);
  assert.equal(calls.length, 1); assert.equal(calls[0].inputs.length, 2);
  assert.equal(histories.length, 1); assert.equal(histories[0].provider, "Atlas Cloud"); assert.equal(histories[0].cost.amountUsd, .001);
  assert.equal(histories[0].settings.sourceUrl, "/uploads/source.png");
  assert.equal((await post({ requestId, region: { ...region, x: .4 } })).status, 409);
}));
test("invalid completed responses are recorded and not replayed for the same request", () => withNames(async ({ post, calls, histories }) => {
  const requestId = randomUUID();
  assert.equal((await post({ requestId })).status, 500);
  assert.equal((await post({ requestId })).status, 500);
  assert.equal(calls.length, 1); assert.equal(histories.length, 1); assert.match(histories[0].error, /JSON/);
}, "invalid JSON"));
