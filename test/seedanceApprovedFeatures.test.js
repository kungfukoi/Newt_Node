import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createSeedanceDraftStore } from "../server/seedance-drafts.js";
import { createRemoteVideoJobs } from "../server/remote-video-jobs.js";
import { previewOutputTargetAsset } from "../server/outputTargets.js";
import { providerKeyFingerprint, createSeedanceJobAdapter } from "../server/seedance-job-provider.js";
import { validateSeedanceDraft, seedanceDraftLifetimeMs, seedanceAtlasDraftCompletionEndpoint } from "../src/seedanceDraft.js";
import { validateSeedance25Task, validateSeedance25EditDuration, validateSeedance25ReferenceTags } from "../src/seedance25.js";
import { buildVideoGenerationRequest } from "../src/nodeRunners/videoModels.js";
import { buildAtlasVideoRequest } from "../src/atlasMedia.js";
import { finishSeedanceDraft } from "../src/nodeRunners/seedanceDraft.js";
import { generationQuoteSettings } from "../src/pricingTrust.js";
import { estimateVideoRunCost } from "../src/generationPricing.js";
import { resetCopiedNodeRuntime, clearStaleRunningState } from "../src/workflowState.js";

test("draft and edit contracts preserve normal saved settings and reject incompatible requests", () => {
  const node = { id: "video", data: { model: "Seedance 2.5", duration: "12 seconds", resolution: "1080p", aspectRatio: "21:9", seedanceDraft: true } };
  const before = structuredClone(node);
  const draft = buildVideoGenerationRequest({ node, prompt: "A room" });
  assert.equal(draft.resolution, "480p"); assert.equal(draft.seedanceDraft, true);
  const edit = buildVideoGenerationRequest({ node: { ...node, data: { ...node.data, seedanceDraft: false, seedanceTask: "edit" } }, prompt: "Repaint the room", referenceVideoUrls: ["/outputs/room.mp4"] });
  assert.equal(edit.duration, "auto"); assert.equal(edit.aspectRatio, "auto");
  assert.deepEqual(node, before);
  for (const provider of ["fal", "krea", "atlas"]) assert.equal(validateSeedanceDraft({ model: node.data.model, seedanceDraft: true, provider }), true);
  for (const provider of ["", "google"]) assert.throws(() => validateSeedanceDraft({ model: node.data.model, seedanceDraft: true, provider }), /Draft mode requires/);
  for (const provider of ["fal", "atlas", "krea"]) assert.equal(validateSeedance25Task({ model: node.data.model, seedanceTask: "edit", videos: ["video"], provider }), true);
  for (const patch of [{ provider: "google" }, { videos: [] }, { startFrames: ["frame"] }, { filmDirector: {} }, { model: "Seedance 2.0" }]) assert.throws(() => validateSeedance25Task({ model: node.data.model, seedanceTask: "edit", videos: ["video"], ...patch }));
  for (const duration of [3.9, 30.1, NaN]) assert.throws(() => validateSeedance25EditDuration(duration));
  assert.equal(validateSeedance25EditDuration(30), 30);
  const atlas = buildAtlasVideoRequest({ model: node.data.model, prompt: "Repaint", seedanceTask: "edit", videos: ["https://example.com/room.mp4"], duration: "12 seconds", aspectRatio: "21:9" });
  assert.equal(atlas.omni_reference_task_type, "edit"); assert.equal(atlas.duration, -1); assert.equal(atlas.ratio, "adaptive");
  assert.throws(() => validateSeedance25ReferenceTags("Use @Missing", { images: 1 }), /Unmatched/);
  assert.throws(() => validateSeedance25ReferenceTags("Use @Video2", { videos: 1 }), /Unmatched/);
  assert.doesNotThrow(() => validateSeedance25ReferenceTags("@Image1 @Video1 @Audio1 contact@example.com", { images: 1, videos: 1, audio: 1 }));
  assert.equal(estimateVideoRunCost({ model: node.data.model, seedanceDraft: true }), null);
  assert.equal(estimateVideoRunCost({ model: node.data.model, seedanceTask: "edit" }), null);
  assert.notDeepEqual(generationQuoteSettings({ kind: "video", seedanceDraft: true }), generationQuoteSettings({ kind: "video" }));
});

for (const provider of ["fal", "atlas"]) test(`${provider} durable receipts deduplicate completion across copies, local failures and restart`, async t => {
  const scratch = await mkdtemp(path.join(tmpdir(), "newt-seedance-approved-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(scratch)), path.resolve(tmpdir()));
    assert(path.basename(scratch).startsWith("newt-seedance-approved-"));
    return rm(scratch, { recursive: true, force: true });
  });
  let key = "fake-original", submits = 0, saves = 0, now = Date.parse("2026-10-13T00:00:00Z"), failSave = true;
  const calls = [];
  const options = { filePath: path.join(scratch, "jobs.json"), autoStart: false,
    adapter: async spec => ({ submit: async () => { submits++; calls.push(spec); return { requestId: "provider-complete" }; }, poll: async () => ({ remote: { video: { url: "https://example.com/finished.mp4" } } }) }),
    finalize: async job => { saves++; if (failSave) throw Error("Local download interrupted"); return { generationRunId: job.runId, video: { localUrl: "/outputs/finished.mp4" }, seedanceDraftSource: job.spec.settings.seedanceDraftSource }; }
  };
  let jobs = await createRemoteVideoJobs(options);
  let store = createSeedanceDraftStore({ directory: path.join(scratch, "receipts"), jobs, getKey: () => key, now: () => now });
  const original = { body: { projectId: "project", nodeId: "video" }, settings: { generateAudio: true, resolution: "480p", seedanceDraft: true }, prompt: "original prompt", submittedPrompt: "original prompt" };
  const input = { provider, draftId: "provider-draft", keyFingerprint: providerKeyFingerprint(key), startedAt: now, original, previewFileName: "shot-03-draft.mp4" };
  const receipt = await store.recordDraft(input);
  assert.deepEqual(await store.recordDraft({ ...input, startedAt: now + 1000 }), receipt);
  assert.equal(receipt.provider, provider);
  if (provider === "fal") {
    // Simulate an existing receipt written before provider metadata was added.
    const receiptPath = path.join(scratch, "receipts", receipt.receiptId + ".json");
    const legacy = JSON.parse(await readFile(receiptPath, "utf8"));
    delete legacy.provider;
    delete legacy.previewFileName;
    await writeFile(receiptPath, JSON.stringify(legacy));
    assert.deepEqual(await store.recordDraft(input), receipt);
  }
  assert(!(await readFile(path.join(scratch, "receipts", receipt.receiptId + ".json"), "utf8")).includes(key));
  key = "other-account";
  await assert.rejects(store.complete(receipt.receiptId), /original (Fal|Atlas Cloud)/); assert.equal(submits, 0);
  key = "fake-original";
  assert.deepEqual(await Promise.all([store.rememberOutput(receipt.receiptId, "Cartoon Subway_03_draft.mp4"),
    store.rememberOutput(receipt.receiptId, "another-name_draft.mp4")]), Array(2).fill("Cartoon Subway_03_draft.mp4"));
  store = createSeedanceDraftStore({ directory: path.join(scratch, "receipts"), jobs, getKey: () => key, now: () => now });
  const destination = { draftCompletionDestination: true, projectId: "project", nodeId: "video", previewFileName: "shot-03-draft.mp4",
    outputTargetPath: "current-delivery", outputTargetFileName: "regular-output-template", outputTargetNodeId: "output", generationGroupId: "finish-batch", generationBatchIndex: 2, generationBatchTotal: 3 };
  const [a,b] = await Promise.all([store.complete(receipt.receiptId, destination), store.complete(receipt.receiptId)]);
  assert.equal(a.runId, b.runId);
  await jobs.step(a.runId);
  assert.equal(submits, 1); assert.equal(saves, 1);
  assert.deepEqual(calls[0].input, provider === "atlas" ? { model: seedanceAtlasDraftCompletionEndpoint, draft_id: "provider-draft" } : { draft_id: "provider-draft", resolution: "1080p", codec: "auto" });
  assert.equal(calls[0].provider, provider);
  assert.equal(calls[0].body.outputTargetPath, "current-delivery");
  const target = await previewOutputTargetAsset(calls[0].body, "video", ".mp4", { rootDir: scratch });
  assert.equal(target.fileName, "Cartoon Subway_03.mp4");
  assert.equal(calls[0].body.seedanceFinishedFileName, "Cartoon Subway_03.mp4");
  assert.equal(calls[0].body.generationGroupId, "finish-batch");
  assert.equal(calls[0].body.generationBatchIndex, 2);
  assert.equal(calls[0].settings.seedanceDraftPreviewFileName, "Cartoon Subway_03_draft.mp4");
  assert.equal(calls[0].prompt, "original prompt"); assert.equal(calls[0].cost.amountUsd, null);
  await jobs.close();
  now += seedanceDraftLifetimeMs + 1000; failSave = false;
  jobs = await createRemoteVideoJobs(options);
  store = createSeedanceDraftStore({ directory: path.join(scratch, "receipts"), jobs, getKey: () => key, now: () => now });
  await store.complete(receipt.receiptId); await jobs.step(a.runId);
  assert.equal(jobs.get(a.runId).state, "completed"); assert.equal(submits, 1);
  key = "";
  assert.equal((await store.complete(receipt.receiptId)).result.video.localUrl, "/outputs/finished.mp4");
  const expired = await store.recordDraft({ ...input, draftId: "another-draft" });
  key = "fake-original";
  await assert.rejects(store.complete(expired.receiptId), /expired/);
  await assert.rejects(store.complete("../invalid"), /Invalid/);
  await jobs.close();
});

test("Fal polling retains the draft ID required for finalization", async () => {
  const key = "fake-key";
  const factory = createSeedanceJobAdapter({ getKey: () => key, fetchImpl: async url => Response.json(String(url).includes("/status") ? { status: "COMPLETED" } : { video: { url: "https://example.com/preview.mp4" }, draft_id: "draft-id" }) });
  const client = await factory({ provider: "fal", endpoint: "bytedance/seedance-2.5/text-to-video", credentialFingerprint: providerKeyFingerprint(key) });
  assert.equal((await client.poll({ requestId: "request" })).remote.draft_id, "draft-id");
});

test("finishing preserves the draft after prompt changes and selects a saved completion without another call", async () => {
  const node = { id: "video", data: { model: "MiniMax H3", prompt: "Changed", resultItems: [{ type: "video", url: "/outputs/draft.mp4", seedanceDraft: { receiptId: "receipt" } }], selectedResultIndex: 0 } };
  let calls = 0;
  const update = patch => Object.assign(node.data, patch);
  const deps = { node, workflowContext: {}, getCurrent: () => node, update, complete: async () => { calls++; return { video: { localUrl: "/outputs/finished.mp4" }, seedanceDraftSource: "receipt" }; } };
  await finishSeedanceDraft(deps);
  assert.equal(node.data.resultItems.length, 2); assert.equal(node.data.resultItems[0].url, "/outputs/draft.mp4");
  assert.equal(node.data.selectedResultIndex, 1);
  node.data.selectedResultIndex = 0;
  await finishSeedanceDraft(deps); assert.equal(calls, 1);
});

test("batch finishing keeps successful 1080p siblings and reports each failed draft by name", async () => {
  const drafts = ["one", "two", "three"].map(name => ({
    type: "video", url: `/outputs/${name}.mp4`, fileName: `${name}.mp4`, seedanceDraft: { receiptId: name }
  }));
  const node = { id: "video", data: { resultItems: drafts } };
  const submitted = [];
  const result = await finishSeedanceDraft({
    node, receiptIds: ["two", "three"], groupId: "batch", getCurrent: () => node, update: patch => Object.assign(node.data, patch),
    complete: async request => {
      submitted.push(request.receiptId);
      if (request.receiptId === "two") throw new Error("Provider rejected this draft.");
      return { video: { localUrl: "/outputs/three_1080p.mp4" }, seedanceDraftSource: request.receiptId };
    }
  });
  assert.deepEqual(submitted, ["two", "three"]);
  assert.equal(result.status, "complete");
  assert.match(node.data.error, /two: Provider rejected/);
  assert.equal(node.data.resultItems.length, 4);
  assert.equal(node.data.resultItems.at(-1).label, "three (HD · 1080p)");
  assert.equal(node.data.resultUrl, "/outputs/three_1080p.mp4");
});

test("copying or reopening an in-flight finish preserves the preview and receipt", () => {
  const data = { status: "running", seedanceFinishing: "operation", resultUrl: "/outputs/draft.mp4", resultItems: [{ type: "video", url: "/outputs/draft.mp4", seedanceDraft: { receiptId: "receipt" } }] };
  const copy = resetCopiedNodeRuntime(data);
  assert.equal(copy.seedanceFinishing, ""); assert.equal(copy.status, "complete");
  assert.deepEqual(copy.resultItems, data.resultItems);
  const reopened = clearStaleRunningState({ type: "videoModel", data }).data;
  assert.equal(reopened.seedanceFinishing, ""); assert.equal(reopened.resultUrl, data.resultUrl);
  assert.equal(reopened.resultItems[0].seedanceDraft.receiptId, "receipt");
});
