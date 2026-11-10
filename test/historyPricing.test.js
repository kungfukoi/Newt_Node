import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { completeGenerationCost, createHistoryPricing } from "../server/history-pricing.js";
import { createHistoryStore } from "../server/history-store.js";
import { createStatsLedger } from "../server/stats-ledger.js";
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
test("Atlas 1080p draft completion uses measured duration for automatic runs", () => {
  const cost = completeGenerationCost({ ...video, endpoint: "bytedance/seedance-2.5/draft-complete",
    settings: { duration: "auto" }, remoteVideo: { duration: 10 } }, snapshot);
  assert.equal(cost.amountUsd, 5.92);
  assert.equal(cost.unitRateUsd, 0.592);
  assert.equal(cost.estimated, true);
});
test("Atlas edits use native outpaint duration and dimensions instead of the finished cut", () => {
  const cost = completeGenerationCost({ ...video, settings: { ...video.settings, duration: "auto", referenceVideoCount: 1,
    seedanceTask: "edit", sourceDurationSeconds: 5, videoOutpaint: { nativeWidth: 1920, nativeHeight: 1080, nativeDuration: 5 } },
    remoteVideo: { width: 1280, height: 720, duration: 2, fps: 24 } }, snapshot);
  assert.equal(cost.amountUsd, 5.0544);
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
async function pricingFixture(t, history, quoteAtlas) {
  const dir = await mkdtemp(join(tmpdir(), "newt-reconcile-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = join(dir, "ledger.json");
  const ledger = createStatsLedger({ filePath });
  const store = createHistoryStore({ filePath: join(dir, "history.json") });
  for (const row of history) await store.append(row);
  return { service: createHistoryPricing({ snapshot: () => snapshot, store, ledger, atlasJobsDirectory: dir, quoteAtlas }), store, ledger, filePath, dir };
}

test("ledger-only Atlas runs recover billing settings from the completed job once", async t => {
  const { service, ledger, dir } = await pricingFixture(t, [], () => assert.fail("No account quote needed"));
  const generationRunId = "seedance-run";
  const item = { ...video, generationRunId, settings: undefined };
  await ledger.append(item);
  const name = createHash("sha256").update(generationRunId).digest("hex");
  await writeFile(join(dir, name + ".spec.json"), JSON.stringify({ provider: "atlas", input: { model: endpoint }, settings: video.settings }));
  await writeFile(join(dir, name + ".state.json"), JSON.stringify({ state: "completed", runId: generationRunId, result: { video: { duration: 8 } } }));
  assert.deepEqual(await service.reconcile(), { updated: 1, unpriced: 0, total: 1 });
  assert.equal((await ledger.snapshot([])).records[0].cost.amountUsd, 5.913646);
  assert.deepEqual(await service.reconcile(), { updated: 0, unpriced: 0, total: 1 });
});

test("Atlas token counts and billing IDs survive History eviction and reconcile once", async t => {
  const { service, ledger } = await pricingFixture(t, []);
  await ledger.append({ ...video, id: "text", mediaType: "text", modelName: "openai/gpt-6-astra", usage: {
    request: { atlasRequestId: "req_provider", input_tokens: 100, output_tokens: 20, prompt: "private prompt" },
    helpers: [{ atlasRequestId: "apikey-private-credential", atlasModel: "openai/gpt-5.6-luna", input_tokens: 200, output_tokens: 30 }]
  } });
  assert.deepEqual(await service.reconcile(), { updated: 1, unpriced: 0, total: 1 });
  const [row] = (await ledger.snapshot([])).records;
  assert.ok(Math.abs(row.cost.amountUsd - 0.002076) < 1e-12);
  assert.equal(row.atlasUsage[0].atlasRequestId, "req_provider");
  assert.equal(row.atlasUsage[1].atlasRequestId, "");
  assert.ok(!JSON.stringify(row).includes("private prompt"));
  assert.deepEqual(await service.reconcile(), { updated: 0, unpriced: 0, total: 1 });
});

test("reconciliation coalesces, preserves priced records and labels account quotes as historical estimates", async t => {
  const history = [{ ...video, settings: { ...video.settings, referenceVideoCount: 1 } }, { ...video, id: "priced", cost: { amountUsd: 3 } }];
  let quotes = 0;
  const { service, store, ledger } = await pricingFixture(t, history, async () => {
    quotes++;
    return { amountUsd: 8, estimated: true, pricingBasis: "Account estimate" };
  });
  const first = service.reconcile(); assert.equal(service.reconcile(), first);
  assert.deepEqual(await first, { updated: 1, unpriced: 0, total: 2 }); assert.equal(quotes, 1);
  const saved = new Map((await store.read()).map(row => [row.id, row.cost]));
  assert.equal(saved.get("video").estimated, true);
  assert.ok(saved.get("video").reconciledAt);
  assert.equal(saved.get("video").previousCost.amountUsd, null);
  assert.equal(saved.get("priced").amountUsd, 3);
  assert.equal((await ledger.snapshot([])).records.find(row => row.id === "video").cost.amountUsd, 8);
});
test("catalog estimates need no quote and unsupported rows remain unpriced", async t => {
  const { service } = await pricingFixture(t, [video, { ...video, id: "unknown", provider: "fal" }], () => assert.fail("No quote needed"));
  assert.deepEqual(await service.reconcile(), { updated: 1, unpriced: 1, total: 2 });
});
test("manual charges survive eviction and cannot overwrite a priced run or another provider", async t => {
  const history = [video, { ...video, provider: "fal", cost: { amountUsd: 7 } }];
  const { service, ledger, filePath } = await pricingFixture(t, history);
  await ledger.snapshot([ { ...video, id: "evicted" } ]);
  const input = { provider: "atlas", runId: "evicted", amountUsd: 0 };
  assert.equal((await service.recordCharge(input)).cost.amountUsd, 0);
  assert.equal((await service.recordCharge(input)).cost.pricingSource, "manual-provider-billing");
  await assert.rejects(service.recordCharge({ ...input, amountUsd: 1 }), { status: 409 });
  await assert.rejects(service.recordCharge({ ...input, provider: "fal", runId: "video" }), { status: 409 });
  await assert.rejects(service.recordCharge({ ...input, amountUsd: "" }), { status: 400 });
  assert.equal((await createStatsLedger({ filePath }).snapshot([])).records.find(row => row.id === "evicted").cost.amountUsd, 0);
});

test("Seedance 2.0 historical native-resolution estimates retain source and reject reference video", () => {
  const legacy = { ...video, modelName: "Seedance 2.0", endpoint: "bytedance/seedance-2.0/reference-to-video",
    settings: { ...video.settings, duration: "15" } };
  assert.equal(completeGenerationCost(legacy, { version: 1, entries: {} }).amountUsd, 8.1648);
  assert.equal(completeGenerationCost({ ...legacy, settings: { ...legacy.settings, referenceVideoCount: 1 } }).amountUsd, null);
});
