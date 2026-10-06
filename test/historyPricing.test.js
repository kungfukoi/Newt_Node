import assert from "node:assert/strict";
import test from "node:test";
import { completeGenerationCost, createHistoryPricing } from "../server/history-pricing.js";
import { catalogTokenCost } from "../src/pricingCatalog.js";
import { atlasSeedanceEstimateEntry } from "../src/atlasPricing.js";
const endpoint = "bytedance/seedance-2.5/reference-to-video";
const video = { id: "video", provider: "Atlas Cloud", mediaType: "video", modelName: "Seedance 2.5", endpoint,
  settings: { duration: "8", resolution: "1080p", referenceImageCount: 1, referenceVideoCount: 0, startFrameCount: 0 }, cost: { amountUsd: null } };
const snapshot = { version: 1, revision: "test", entries: { ["atlas:" + endpoint]: { ...atlasSeedanceEstimateEntry(), checkedAt: new Date().toISOString() } } };
test("final pricing preserves recorded zero and settled charges", () => {
  for (const amountUsd of [0, 12]) { const cost = { amountUsd, pricingStatus: "actual" }; assert.equal(completeGenerationCost({ ...video, cost }, snapshot), cost); }
});
test("legacy Atlas endpoint and saved integer duration yield an estimate", () => {
  const cost = completeGenerationCost(video, snapshot);
  assert.ok(cost.amountUsd > 0); assert.equal(cost.endpoint, endpoint); assert.equal(cost.estimated, true);
});
test("reference video and missing reference metadata cannot use no-reference prices", () => {
  for (const referenceVideoCount of [1, undefined]) assert.equal(completeGenerationCost({ ...video, settings: { ...video.settings, referenceVideoCount } }, snapshot).amountUsd, null);
});
test("only known local Director records without provider usage become free", () => {
  const local = { provider: "local", modelName: "NewtNode Director", mediaType: "text", usage: null };
  assert.equal(completeGenerationCost(local).amountUsd, 0);
  assert.equal(completeGenerationCost({ ...local, usage: { request: { input_tokens: 1 } } }).amountUsd, null);
  assert.equal(completeGenerationCost({ ...local, modelName: "unknown" }).amountUsd, null);
});
test("Atlas includes exactly 272000 input tokens in its long context tier", () => {
  const prices = { version: 1, revision: "tokens", entries: { "atlas:openai/gpt-5.6-sol": { currency: "USD", checkedAt: new Date().toISOString(),
    points: ["short", "long"].flatMap(context => ["input", "output", "cached", "writes"].map(metric => ({ dimensions: { context, metric }, amount: context === "long" ? 10 : 5 }))) } } };
  assert.equal(catalogTokenCost("Atlas Cloud", "openai/gpt-5.6-sol", { input_tokens: 272000, output_tokens: 0 }, prices).amountUsd, 2.72);
  const item = { provider: "Atlas Cloud", modelName: "openai/gpt-5.6-sol", mediaType: "text", usage: { request: { input_tokens: 272000, output_tokens: 0 }, helpers: [] } };
  assert.equal(completeGenerationCost(item, prices).amountUsd, 2.72);
});
test("reconciliation coalesces, preserves priced records and labels account quotes as historical estimates", async () => {
  let saved = [{ ...video, settings: { ...video.settings, referenceVideoCount: 1 } }, { ...video, id: "priced", cost: { amountUsd: 3 } }];
  let quotes = 0;
  const service = createHistoryPricing({ snapshot: () => snapshot, store: { read: async () => saved, updateCosts: async updates => saved = saved.map(i => updates.has(i.id) ? { ...i, cost: updates.get(i.id) } : i) },
    quoteAtlas: async () => { quotes++; return { amountUsd: 8, estimated: true, pricingBasis: "Account estimate" }; } });
  const first = service.reconcile(); assert.equal(service.reconcile(), first);
  assert.deepEqual(await first, { updated: 1, unpriced: 0, total: 2 }); assert.equal(quotes, 1);
  assert.equal(saved[0].cost.estimated, true); assert.ok(saved[0].cost.reconciledAt); assert.equal(saved[0].cost.previousCost.amountUsd, null);
  assert.equal(saved[1].cost.amountUsd, 3);
});
test("failed account lookup retains a valid catalog estimate, without generating", async () => {
  let saved = [video];
  const service = createHistoryPricing({ snapshot: () => snapshot, store: { read: async () => saved, updateCosts: async updates => saved = saved.map(i => ({ ...i, cost: updates.get(i.id) || i.cost })) }, quoteAtlas: async () => { throw Error("offline"); } });
  assert.equal((await service.reconcile()).updated, 1);
});

test("Seedance 2.0 historical native-resolution estimates retain source and reject reference video", () => {
  const legacy = { ...video, modelName: "Seedance 2.0", endpoint: "bytedance/seedance-2.0/reference-to-video",
    settings: { ...video.settings, duration: "15" } };
  assert.equal(completeGenerationCost(legacy, { version: 1, entries: {} }).amountUsd, 8.1648);
  assert.equal(completeGenerationCost({ ...legacy, settings: { ...legacy.settings, referenceVideoCount: 1 } }).amountUsd, null);
});
