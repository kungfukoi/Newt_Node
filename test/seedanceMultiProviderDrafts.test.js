import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import * as seedance from "../src/seedance25.js";
import * as drafts from "../src/seedanceDraft.js";
import { buildAtlasVideoRequest, supportsAtlasVideoModel } from "../src/atlasMedia.js";
import { createAtlasMedia } from "../server/atlas-media.js";
import { createSeedanceDraftStore } from "../server/seedance-drafts.js";
import { createSeedanceJobAdapter, providerKeyFingerprint } from "../server/seedance-job-provider.js";
import { createRemoteVideoJobs } from "../server/remote-video-jobs.js";
import { resolveSeedanceRuntimeProvider, kreaSeedanceEndpoint, kreaSeedanceEditInput, compactKreaSeedancePrompt as compactSeedancePrompt, estimateKreaSeedanceCost } from "../src/kreaSeedance.js";
import { mergeSeedanceDirectorReferences } from "../src/seedanceDirectorReferences.js";
import { normalizeVideoGenerationResult } from "../src/nodeRunners/videoModels.js";
import { finishSeedanceDraft } from "../src/nodeRunners/seedanceDraft.js";
import { seedanceSubmittedPrompt } from "../src/seedancePrompt.js";
import { validateAtlasSeedanceDurations } from "../src/atlasSeedanceLimits.js";
import { saveGeneratedVideoWithFallback } from "../server/video-save-fallback.js";
import { prepareSeedanceOutpaint, finishSeedanceOutpaint } from "../server/seedance-outpaint.js";
import { planVideoOutpaint } from "../src/videoOutpaint.js";

const outpaintFixture = { sourceUrl: "/outputs/short.mp4", videoUrl: "/outputs/padded.mp4", maskVideoUrl: "/outputs/mask.mp4", plan: planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 2 }, { model: "seedance-2.5" }) };

// Execute the real route/finalizer with provider, storage and History boundaries mocked.
const source = await readFile(new URL("../server/index.js", import.meta.url), "utf8");
const routeSource = source.slice(source.indexOf('const handleVideoGeneration ='), source.indexOf("async function finalizeSeedanceVideo("));
const finalizerSource = source.slice(source.indexOf("async function finalizeSeedanceVideo("), source.indexOf("async function importSeedanceResult("));
function routeHarness(provider, { missingKey = false, rotateDuringUpload = false } = {}) {
  let handler, spec;
  const uploads = [];
  const env = { FAL_KEY: "fal-key", KREA_API_KEY: "krea-key", ATLAS_API_KEY: "atlas-key" };
  const keyName = { fal: "FAL_KEY", krea: "KREA_API_KEY", atlas: "ATLAS_API_KEY" }[provider];
  if (missingKey) env[keyName] = "";
  const upload = async (url, key) => {
    uploads.push({ url, key });
    if (rotateDuringUpload) env[keyName] = "changed-key";
    return "https://example.test/reference";
  };
  const deps = {
    ...seedance, ...drafts, resolveSeedanceRuntimeProvider, providerKeyFingerprint, kreaSeedanceEndpoint, kreaSeedanceEditInput, compactSeedancePrompt, estimateKreaSeedanceCost, mergeSeedanceDirectorReferences, supportsAtlasVideoModel,
    prepareSeedanceOutpaint, videoOutpaintService: { prepare: async () => outpaintFixture },
    console: { error: () => {} },
    path, rootDir: "/fixture", outputsDir: "/fixture/outputs", localWorkflowAssetDirName: () => "workflow", verifyVideoOutputDestination: async () => ({}),
    seedanceSubmittedPrompt, validateAtlasSeedanceDurations,
    app: { post: (_path, callback) => { handler = callback; } }, durableVideoRequestHandler: callback => callback,
    process: { env }, runtimeModelProviderPreferences: { seedance: provider },
    updateCurrentGenerationProgress: () => {}, resolveVideoModel: model => ({ displayName: model, provider: "fal-seedance-25" }),
    isLocalAssetUrl: url => url.startsWith("/outputs/"), httpError: (status, message) => Object.assign(Error(message), { status }),
    missingModelProviderApiKeyMessage: (model, provider) => `Enable the selected ${provider} key for ${model}.`,
    providerSupportedModels: () => [], filmDirectorUsesMusic: () => false,
    firstLocalOutput: urls => urls?.[0] || "", filterFilmDirectorReferencesForOutput: refs => refs,
    normalizeReferenceNames: (labels, count, prefix = "Image") => Array.from({ length: count }, (_, i) => labels[i] || `${prefix}${i + 1}`),
    rewriteReferenceMentions: prompt => prompt, optionalInteger: () => undefined, durationToSeconds: value => parseInt(value),
    resolveLocalAssetPathFromUrl: async url => ({ filePath: url }), probeVideoFile: async () => ({ duration: 10 }), localVideoDurations: async urls => urls.map(() => 10),
    resolveKreaSeedanceAspectRatio: async ({ value }) => value,
    uploadKreaReferenceImage: upload, uploadLocalOutputToKrea: upload,
    uploadLocalOutputToFal: upload,
    createSingleSubmissionFalClient: ({ credentials }) => ({ storage: { upload: file => upload(file.name, credentials) } }),
    readLocalAsset: async url => ({ buffer: Buffer.from("fake"), fileName: url, mimeType: "image/png" }),
    atlasMedia: createAtlasMedia({ readLocalAsset: async url => ({ source: url }), client: { upload: (asset, key) => upload(asset.source, key) } }),
    workflowContextPayload: body => ({ projectId: body.projectId }), listGenerationProgress: () => [],
    generationPricingScope: { getStore: () => ({}) }, pricingRefresh: { snapshot: () => ({}) },
    remoteVideoJobs: { create: async (runId, input) => { spec = input; return { runId, state: "accepted" }; } },
    sendApiError: (res, error) => res.status(error.status || 500).json({ error: error.message })
  };
  new Function(...Object.keys(deps), routeSource)(...Object.values(deps));
  return { uploads, get spec() { return spec; }, async run(body = {}) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ body: { model: "Seedance 2.5", prompt: "A scene", seedanceDraft: true, resolution: "1080p", duration: "12 seconds", aspectRatio: "16:9", generationRunId: "draft-run", ...body }, durableRequestHash: "hash" }, res);
    return res;
  } };
}

for (const provider of ["fal", "atlas", "krea"]) for (const mode of ["text", "image", "reference", "edit"]) {
  test(`${provider} ${mode} draft route uses captured credentials and 480p without a normal-price quote`, async () => {
    const h = routeHarness(provider, { rotateDuringUpload: true });
    const res = await h.run({ ...(mode === "image" ? { startFrameUrls: ["/outputs/frame.png"] } : {}),
      ...(["reference", "edit"].includes(mode) ? { referenceImageUrls: ["/outputs/ref.png"], referenceVideoUrls: ["/outputs/clip.mp4"] } : {}),
      ...(mode === "edit" ? { seedanceTask: "edit" } : {}) });
    assert.equal(res.statusCode, 202, JSON.stringify(res.body));
    assert.equal(h.spec.provider, provider); assert.equal(h.spec.input.draft, true); assert.equal(h.spec.input.resolution, "480p");
    assert.equal(h.spec.credentialFingerprint, providerKeyFingerprint(`${provider}-key`));
    assert.ok(h.uploads.every(upload => upload.key === `${provider}-key`));
    assert.equal(h.spec.cost.amountUsd, null); assert.match(h.spec.cost.pricingBasis, new RegExp(drafts.seedanceDraftProviderName(provider)));
    if (mode === "edit" && provider !== "krea") assert.equal(h.spec.input[provider === "atlas" ? "omni_reference_task_type" : "task"], provider === "atlas" ? "edit" : "editing");
    if (provider === "krea") {
      assert.equal(h.spec.input.generate_audio, undefined);
      if (mode === "edit") {
        assert.match(h.spec.input.prompt, /^Edit @Video1 in place/);
        assert.equal(h.spec.input.duration, 10);
        assert.equal(h.spec.input.enhance_prompt, false);
        assert.equal(h.spec.input.task, undefined);
        assert.equal(h.spec.submittedPrompt, h.spec.input.prompt);
      }
    }
  });
}

test("selected draft providers with missing keys never fall back", async () => {
  for (const provider of ["fal", "atlas", "krea"]) {
    const h = routeHarness(provider, { missingKey: true });
    assert.equal((await h.run()).statusCode, 400); assert.equal(h.spec, undefined); assert.equal(h.uploads.length, 0);
  }
  const h = routeHarness("krea", { missingKey: true });
  assert.equal((await h.run({ seedanceDraft: false, seedanceTask: "edit", referenceVideoUrls: ["/outputs/clip.mp4"] })).statusCode, 400);
  assert.equal(h.spec, undefined); assert.equal(h.uploads.length, 0);
});

function finalizerHarness() {
  const histories = [], receipts = [], checkpoints = [];
  const deps = { ...drafts, path, saveGeneratedVideoWithFallback, existsSync: () => true, enrichVideoMetadata: (video, metadata) => ({ ...video, ...metadata }),
    probeVideoFile: async () => ({ width: 854, height: 480, duration: 12 }), recordedCostAmount: cost => cost.amountUsd,
    process: { env: { ATLAS_API_KEY: "atlas-key" } }, providerKeyFingerprint,
    providerPricing: { atlasInput: () => assert.fail("Do not borrow normal quotes for drafts or completion") },
    seedanceDrafts: { recordDraft: async input => { receipts.push(input); return input.draftId ? { provider: input.provider, receiptId: "receipt", draftId: input.draftId } : null; } },
    finishSeedanceOutpaint, videoOutpaintService: { finish: async () => ({ filePath: "/finished.mp4", publicPath: "/outputs/finished.mp4", fileName: "finished.mp4", bytes: 100 }) },
    appendHistory: async (item, options) => histories.push({ item, options }), routeKindLabel: value => value,
    projectFromBody: () => ({}), nodeFromBody: () => ({}), jobTimingDiagnostic: () => ({ totalMs: 1000 }) };
  const finalize = new Function(...Object.keys(deps), `${finalizerSource}; return finalizeSeedanceVideo;`)(...Object.values(deps));
  return { histories, receipts, checkpoints, run: (provider, { missingId = false, completion = false, outpaint = false } = {}) => finalize({
    runId: "run", requestId: "request", remote: { video: { url: "https://example.test/draft.mp4" }, ...(missingId ? {} : { draft_id: "provider-draft" }) },
    target: {}, savedOutput: { filePath: "/saved.mp4", publicPath: "/outputs/saved.mp4" },
    spec: { provider, modelName: "Seedance 2.5", seedance25: true, body: outpaint ? { videoOutpaintContext: outpaintFixture } : {}, settings: { seedanceDraft: !completion && !outpaint, ...(outpaint ? { seedanceTask: "edit" } : {}), generateAudio: true, ...(completion ? { seedanceDraftSource: "receipt" } : {}) },
      endpoint: completion ? drafts.seedanceAtlasDraftCompletionEndpoint : "generation", routeKind: "text-to-video", cost: drafts.seedanceDraftCost(completion ? "completion" : "preview", provider), credentialFingerprint: providerKeyFingerprint("atlas-key") }
  }, async patch => checkpoints.push(patch)) };
}

test("older automatic QC retry requests are rejected before uploads or provider submission", async () => {
  const h = routeHarness("atlas");
  const res = await h.run({ videoOutpaintUtility: true, videoOutpaintRepair: true });
  assert.equal(res.statusCode, 400); assert.match(res.body.error, /QC fill generation is disabled/);
  assert.equal(h.uploads.length, 0); assert.equal(h.spec, undefined);
});

test("outpainting reuses Fal/Atlas/Krea editing acceptance with source canvas, scene instructions and durable context", async () => {
  for (const provider of ["fal", "atlas", "krea"]) {
    const h = routeHarness(provider);
    const res = await h.run({ videoOutpaintUtility: true, videoOutpaint: { model: "seedance-2.5" }, referenceVideoUrls: [outpaintFixture.sourceUrl], seedanceDraft: false, prompt: "Continue the floor" });
    assert.equal(res.statusCode, 202);
    assert.equal(h.spec.settings.seedanceTask, "edit"); assert.equal(h.spec.body.videoOutpaintContext.videoUrl, outpaintFixture.videoUrl);
    assert.equal(h.spec.prompt, "Continue the floor"); assert.match(h.spec.submittedPrompt, /Replace all black padding/);
    assert.match(h.spec.submittedPrompt, /starting at frame one/);
    assert.doesNotMatch(h.spec.submittedPrompt, /COMPOSITING OVERLAP|restoration rectangle/);
    assert.match(h.spec.submittedPrompt, /Edit @Video1/);
    assert.doesNotMatch(h.spec.submittedPrompt, /Director detail compacted/);
    assert.equal(h.spec.cost.amountUsd, null); assert.equal(h.spec.provider, provider);
    assert.ok(h.uploads.some(upload => upload.url === outpaintFixture.videoUrl));
    assert.ok(h.uploads.every(upload => upload.url !== outpaintFixture.maskVideoUrl));
    if (provider === "fal") assert.equal(h.spec.input.task, "editing");
    else if (provider === "atlas") assert.equal(h.spec.input.omni_reference_task_type, "edit");
    else {
      assert.match(h.spec.input.prompt, /^Edit @Video1 in place/);
      assert.ok(h.spec.input.reference_videos.length === 1);
      assert.equal(h.spec.input.generate_audio, undefined);
      assert.equal(h.spec.settings.seedanceTask, "edit");
    }
  }
});

test("Seedance outpaint finalization checkpoints restoration and records raw/source metadata with unknown cost", async () => {
  const h = finalizerHarness();
  const result = await h.run("atlas", { outpaint: true });
  assert.equal(result.video.localUrl, "/outputs/finished.mp4");
  assert.equal(result.videoOutpaint.rawVideoUrl, "/outputs/saved.mp4");
  assert.equal(result.videoOutpaint.restoredSource, true); assert.equal(result.cost.amountUsd, null);
  assert.equal(h.checkpoints.at(-1).outpaintFinished.output.publicPath, result.video.localUrl);
  assert.equal(h.histories.at(-1).item.mode, "Video outpainting");
  assert.equal(h.histories.at(-1).item.settings.videoOutpaint.model, "seedance-2.5");
});

test("Atlas finalization preserves draft ID, History provider, unknown costs and timing metadata", async () => {
  const h = finalizerHarness();
  const result = await h.run("atlas");
  assert.equal(result.seedanceDraft.provider, "atlas"); assert.equal(h.receipts[0].draftId, "provider-draft");
  assert.equal(h.histories[0].item.provider, "Atlas Cloud"); assert.equal(h.histories[0].item.settings.draft.receiptId, "receipt");
  assert.equal(h.histories[0].options.deduplicate, true); assert.equal(result.cost.amountUsd, null); assert.equal(result.generationTimings.totalMs, 1000);
  const completed = await h.run("atlas", { completion: true });
  assert.equal(completed.seedanceDraftSource, "receipt"); assert.equal(h.receipts.length, 1);
  const missing = await h.run("atlas", { missingId: true });
  assert.equal(missing.seedanceDraft, undefined); assert.match(missing.warning, /Atlas Cloud/); assert.equal(missing.video.localUrl, "/outputs/saved.mp4");
});

test("Krea finalization never creates a receipt and preview-only results survive save/load without Finish", async () => {
  const h = finalizerHarness();
  const result = await h.run("krea");
  assert.equal(h.receipts.length, 0); assert.equal(result.seedanceDraft.completionSupported, false);
  assert.equal(h.histories[0].item.provider, "Krea"); assert.equal(result.cost.amountUsd, null);
  const item = normalizeVideoGenerationResult(result, 0);
  const node = { data: JSON.parse(JSON.stringify({ resultItems: [item] })) };
  assert.equal(drafts.selectedSeedanceDraft(node.data), null);
  assert.equal((await finishSeedanceDraft({ node, complete: () => assert.fail("Preview cannot be finished") })).status, "skipped");
});

test("Atlas media draft generation never substitutes the regular 480p price", async () => {
  const media = createAtlasMedia({ quoteInput: () => assert.fail("Draft quote not verified"), client: { generate: async ({ input }) => {
    assert.equal(input.draft, true); assert.equal(input.resolution, "480p"); return { url: "https://example.test/draft.mp4" };
  } } });
  const result = await media.video({ model: "Seedance 2.5", prompt: "test", seedanceDraft: true, resolution: "1080p" }, "atlas-key");
  assert.equal(result.cost.amountUsd, null);
  assert.throws(() => buildAtlasVideoRequest({ model: "Seedance 2.0", prompt: "test", seedanceDraft: true }));
});

test("Atlas draft IDs from submission or polling survive worker restart without a second POST", async t => {
  const scratch = await mkdtemp(path.join(tmpdir(), "newt-multi-draft-"));
  t.after(() => { assert.equal(path.dirname(path.resolve(scratch)), path.resolve(tmpdir())); assert.ok(path.basename(scratch).startsWith("newt-multi-draft-")); return rm(scratch, { recursive: true, force: true }); });
  for (const origin of ["submit", "poll"]) {
    let posts = 0, polls = 0;
    const options = { filePath: path.join(scratch, `${origin}.json`), autoStart: false,
      adapter: createSeedanceJobAdapter({ getKey: () => "atlas-key", fetchImpl: async (_url, init) => {
        if (init.method === "POST") { posts++; return Response.json({ data: { id: "request", ...(origin === "submit" ? { draft_id: "saved-draft" } : {}) } }); }
        return Response.json({ data: { id: "request", status: ++polls === 1 ? "processing" : "completed", ...(origin === "poll" && polls === 1 ? { draft_id: "saved-draft" } : {}), outputs: ["https://example.test/draft.mp4"], latency_ms: 1234 } });
      } }), finalize: async job => ({ draftId: job.remote.draft_id, latencyMs: job.providerLatencyMs }) };
    let jobs = await createRemoteVideoJobs(options);
    await jobs.create("run", { provider: "atlas", endpoint: "model", input: { model: "model", draft: true }, credentialFingerprint: providerKeyFingerprint("atlas-key"), body: {}, modelName: "Seedance 2.5" }, "hash");
    await jobs.step("run"); await jobs.close();
    jobs = await createRemoteVideoJobs(options);
    await jobs.step("run");
    assert.equal(jobs.get("run").result.draftId, "saved-draft"); assert.equal(jobs.get("run").result.latencyMs, 1234); assert.equal(posts, 1);
    await jobs.close();
  }
});

test("receipts distinguish providers and require the original Atlas key even with Fal enabled", async t => {
  const scratch = await mkdtemp(path.join(tmpdir(), "newt-multi-receipt-"));
  t.after(() => { assert.equal(path.dirname(path.resolve(scratch)), path.resolve(tmpdir())); assert.ok(path.basename(scratch).startsWith("newt-multi-receipt-")); return rm(scratch, { recursive: true, force: true }); });
  let selectedProvider;
  const store = createSeedanceDraftStore({ directory: scratch, getKey: provider => { selectedProvider = provider; return "wrong-key"; }, jobs: { get: () => null } });
  const input = { draftId: "same-id", keyFingerprint: providerKeyFingerprint("same-key"), original: { settings: {}, body: {} } };
  const fal = await store.recordDraft(input), atlas = await store.recordDraft({ ...input, provider: "atlas" });
  assert.notEqual(fal.receiptId, atlas.receiptId);
  await assert.rejects(store.complete(atlas.receiptId), /original Atlas Cloud/); assert.equal(selectedProvider, "atlas");
  await assert.rejects(store.recordDraft({ ...input, provider: "krea" }), /does not support/);
});
