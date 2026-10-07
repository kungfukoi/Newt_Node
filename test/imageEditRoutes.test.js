import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import sharp from "sharp";
import { registerImageEditRoutes } from "../server/routes/imageEdit.js";

async function withEditor(run, overrides = {}) {
  const source = await sharp({ create: { width: 64, height: 96, channels: 4, background: "#123456" } }).png().toBuffer();
  const calls = [];
  const saves = [];
  const histories = [];
  const app = express();
  registerImageEditRoutes(app, {
    limiter: (_req, _res, next) => next(),
    getProvider: (_req, requested) => requested === "atlas" ? "atlas" : requested === "fal" ? "fal" : "",
    readSource: async () => ({ buffer: source }),
    generate: async (request) => {
      calls.push(request);
      return { endpoint: "openai/gpt-image-2.5/sunburst/edit", provider: request.provider === "atlas" ? "Atlas Cloud" : "fal.ai", remoteImage: { url: "mock-result" } };
    },
    readGenerated: async () => source,
    save: async (req, buffer) => {
      saves.push({ body: req.body, buffer });
      return { url: "/workflow-assets/test/outputs/edit.png", fileName: "edit.png" };
    },
    recordHistory: async (item) => histories.push(item),
    estimateCost: ({ provider }) => ({ amountUsd: null, provider }),
    sendError: (res, error) => res.status(error.status || 500).json({ error: error.message }),
    ...overrides
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const post = (changes = {}, layers = {}) => {
    const form = new FormData();
    const body = {
      sourceUrl: "/uploads/source.png",
      requestId: randomUUID(),
      prompt: "Make the jacket blue",
      provider: "fal",
      projectId: "project",
      projectName: "Edit QA",
      workflowName: "Edit QA",
      workflowPackageId: "package",
      workflowPackagePath: "/fixture/project",
      outputTargetPath: "/fixture/project/outputs",
      outputTargetFileName: "edit.png",
      outputTargetNodeId: "output1",
      outputTargetNodeTitle: "Output",
      outputTargetSourceNodeId: "image1",
      outputTargetSourceNodeTitle: "Image",
      outputTargetIndex: "1",
      nodeId: "image1",
      nodeTitle: "Image",
      mode: "edit",
      quality: "high",
      blank: "false",
      ...changes
    };
    Object.entries(body).forEach(([key, value]) => form.append(key, value));
    Object.entries(layers).forEach(([key, value]) => form.append(key, new Blob([value], { type: "image/png" }), `${key}.png`));
    return fetch(`http://127.0.0.1:${server.address().port}/api/node/edit-image`, { method: "POST", body: form });
  };
  try {
    await run({ post, source, calls, saves, histories });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("image edits use OpenAI Image 2.5 Sunburst and retain workflow context", () => withEditor(async ({ post, calls, saves, histories }) => {
  const response = await post();
  assert.equal(response.status, 200);
  const { item } = await response.json();
  assert.equal(item.width, 64);
  assert.equal(item.height, 96);
  assert.equal(calls[0].model, "OpenAI Image 2.5 Sunburst");
  assert.equal(calls[0].variant, "sunburst");
  assert.equal(saves[0].body.workflowPackagePath, "/fixture/project");
  assert.equal(histories[0].localImage, item.url);
}));

test("image edits preserve the explicitly selected supported provider", () => withEditor(async ({ post, calls }) => {
  assert.equal((await post({ provider: "atlas" })).status, 200);
  assert.equal(calls[0].provider, "atlas");
}));

test("Ideogram editor requests retain their model and history and reject unsupported routes", () => withEditor(async ({ post, calls, histories }) => {
  const response = await post({ model: "Ideogram 4.5", quality: "medium" });
  assert.equal(response.status, 200);
  assert.equal(calls[0].model, "Ideogram 4.5");
  assert.equal(calls[0].variant, undefined);
  assert.equal(histories[0].modelName, "Ideogram 4.5");
  assert.equal(histories[0].settings.editPrecision, "high");
  for (const changes of [{ provider: "atlas" }, { quality: "xhigh" }, { model: "made up" }]) {
    assert.equal((await post({ model: "Ideogram 4.5", ...changes })).status, 400);
  }
  assert.equal(calls.length, 1);
}));

test("duplicate edit IDs share one paid generation and reject changed payloads", () => withEditor(async ({ post, calls, saves }) => {
  const requestId = randomUUID();
  const first = await post({ requestId });
  const second = await post({ requestId });
  assert.deepEqual(await first.json(), await second.json());
  assert.equal(calls.length, 1);
  assert.equal(saves.length, 1);
  assert.equal((await post({ requestId, prompt: "Different request" })).status, 409);
}));

test("invalid edits never reach the provider", () => withEditor(async ({ post, calls }) => {
  for (const changes of [{ provider: "google" }, { quality: "invented" }, { requestId: "bad" }, { prompt: "" }, { mode: "remove" }]) {
    assert.equal((await post(changes)).status, 400);
  }
  assert.equal(calls.length, 0);
}));

test("provider failures are cached and never automatically retried", async () => {
  let runs = 0;
  await withEditor(async ({ post }) => {
    const requestId = randomUUID();
    for (let index = 0; index < 2; index += 1) {
      const response = await post({ requestId });
      assert.equal(response.status, 422);
    }
    assert.equal(runs, 1);
  }, { generate: async () => { runs += 1; throw Object.assign(new Error("Provider content policy rejection"), { status: 422 }); } });
});

test("history failures do not lose a generated and saved edit", () => withEditor(async ({ post, saves }) => {
  const response = await post();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.item.url);
  assert.match(data.warning, /History/);
  assert.equal(saves.length, 1);
}, { recordHistory: async () => { throw new Error("history unavailable"); } }));

test("Flux editor uses saved model and resolution, rejects unsupported providers before generation", async () => {
  await withEditor(async ({ post, calls, histories }) => {
    assert.equal((await post({ model: "Flux 3", provider: "atlas" })).status, 400);
    assert.equal((await post({ model: "Flux 3", resolution: "8K" })).status, 400);
    assert.equal(calls.length, 0);
    const response = await post({ model: "Flux 3", resolution: "4K" });
    assert.equal(response.status, 200); assert.equal(calls.length, 1);
    assert.equal(calls[0].model, "Flux 3"); assert.equal(calls[0].resolution, "4K");
    assert.equal(calls[0].variant, undefined); assert.equal(histories[0].settings.resolution, "4K");
  });
});

test("Nano Banana 2.1 editor preserves routing, resolution and history", () => withEditor(async ({ post, calls, histories }) => {
  const model = "Nano Banana 2.1";
  for (const changes of [{ provider: "atlas" }, { resolution: "0.5K" }, { resolution: "8K" }]) {
    assert.equal((await post({ model, ...changes })).status, 400);
  }
  assert.equal(calls.length, 0);
  const requestId = randomUUID();
  assert.equal((await post({ model, resolution: "4K", requestId })).status, 200);
  assert.equal((await post({ model, resolution: "4K", requestId })).status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, model);
  assert.equal(calls[0].variant, undefined);
  assert.equal(calls[0].resolution, "4K");
  assert.equal(histories[0].modelName, model);
  assert.equal(histories[0].settings.thinkingLevel, "high");
  assert.equal(histories[0].settings.enableWebSearch, false);
}));


test("boxes retain preferred model, reference image, workflow context and history", () => withEditor(async ({ post, calls, saves, histories }) => {
  const rect = { x: .3, y: .3, w: .2, h: .2, rotation: 0 };
  const box = { id: "reference", mode: "reference", label: "cat", referenceUrl: "/uploads/cat.jpg", source: rect, target: { ...rect, x: .7, rotation: 20 } };
  const response = await post({ model: "OpenAI Image 2.5 Flare", provider: "atlas", boxes: JSON.stringify([box]) });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal(calls[0].model, "OpenAI Image 2.5 Flare"); assert.equal(calls[0].provider, "atlas");
  assert.equal(calls[0].images.length, 3); assert.match(calls[0].prompt, /reference image 3/);
  assert.equal(histories[0].settings.boxes[0].target.rotation, 20);
  assert.equal(saves[0].body.workflowPackageId, "package");
  for (const boxes of ["broken", JSON.stringify([{ ...box, referenceUrl: "" }]), JSON.stringify([box, { ...box, id: "second", referenceUrl: "/uploads/different.jpg" }])]) {
    assert.equal((await post({ boxes })).status, 400);
  }
  assert.equal(calls.length, 1);
}));


test("image edit exposes provider billing detail instead of bare Forbidden and never retries", () => withEditor(async ({ post, calls }) => {
  const requestId = randomUUID();
  for (let i = 0; i < 2; i++) {
    const response = await post({ requestId, model: "Nano Banana 2.1" });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.match(body.error, /Fal rejected the Nano Banana 2.1 edit/);
    assert.match(body.error, /Exhausted balance/);
  }
}, { generate: async () => { throw Object.assign(new Error("Forbidden"), { status: 403, body: { detail: "User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing" } }); } }));


test("cutout edit masks participate in deduplication and preserve selected provider", () => withEditor(async ({ post, calls, histories }) => {
  const rect = { x: .2, y: .2, w: .2, h: .2, rotation: 0 };
  const boxes = JSON.stringify([{ id: "cat", mode: "move", label: "cat", source: rect, target: { ...rect, x: .7 } }]);
  const body = { requestId: randomUUID(), boxes, provider: "atlas" };
  const masks = { boxObjects: Buffer.from(JSON.stringify({ cat: { width: 10, height: 10, runs: [11, 2, 21, 2] } })) };
  assert.equal((await post(body, masks)).status, 200);
  assert.equal(calls[0].provider, "atlas"); assert.equal(histories[0].settings.boxStrategy, "cutout-cleanup");
  assert.equal((await post(body, masks)).status, 200); assert.equal(calls.length, 1);
  assert.equal((await post(body, { boxObjects: Buffer.from("{}") })).status, 409);
  assert.equal((await post({ boxes })).status, 400); assert.equal(calls.length, 1);
}));
