import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedanceDraftCompletionEndpoint, seedanceAtlasDraftCompletionEndpoint, seedanceDraftLifetimeMs, seedanceDraftCost, seedanceDraftProviderName, seedanceDraftPairStem, supportsSeedanceDraft, seedanceDraftFinishResolutions, seedanceDraftFinishLabel } from "../src/seedanceDraft.js";
import { kreaSeedanceEndpoint } from "../src/kreaSeedance.js";
import { workflowContextPayload } from "../src/workflowContext.js";
import { providerKeyFingerprint } from "./seedance-job-provider.js";
const failure = (status, message) => Object.assign(new Error(message), { status });

// The shared durable worker owns paid submission, polling, local save and History.
// A deterministic receipt makes finalization safe to repeat after a crash.
export function createSeedanceDraftStore({ directory, getKey, jobs, checkOutput = async () => {}, now = Date.now }) {
  const active = new Map();
  const deliveries = new Map();
  const file = id => {
    if (!/^[a-f0-9-]{36}$/.test(String(id))) throw failure(400, "Invalid draft receipt.");
    return path.join(directory, `${id}.json`);
  };
  async function read(id) {
    try { return JSON.parse(await readFile(file(id), "utf8")); }
    catch (error) {
      if (error.code === "ENOENT") throw failure(404, "Finish this draft on the NewtNode installation that created it, using the original provider key.");
      throw error;
    }
  }
  async function recordDraft({ draftId, keyFingerprint, startedAt, original, previewFileName, exportFileName, provider = "fal" }) {
    if (!supportsSeedanceDraft(provider)) throw failure(400, "This provider does not support draft finishing.");
    if (typeof draftId !== "string" || !draftId.trim()) return null;
    // Preserve legacy Fal receipt IDs; namespace additional providers.
    const identity = `${keyFingerprint}:${draftId}`;
    const hash = createHash("sha256").update(provider === "fal" ? identity : `${provider}:${identity}`).digest("hex").slice(0, 32);
    const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`;
    let record;
    try { record = await read(id); } catch (error) { if (error.status !== 404) throw error; }
    if (!record) {
      const created = Number.isFinite(Number(startedAt)) ? Number(startedAt) : Date.parse(startedAt) || now();
      record = { id, draftId, provider, keyFingerprint, original, previewFileName, exportFileName, createdAt: new Date(created).toISOString(), expiresAt: new Date(created + seedanceDraftLifetimeMs).toISOString() };
      await mkdir(directory, { recursive: true });
      const target = file(id), temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
      await rename(temporary, target);
    }
    return { receiptId: id, draftId, provider: record.provider || "fal", createdAt: record.createdAt, expiresAt: record.expiresAt, resolution: "480p" };
  }
  function rememberOutput(id, fileName) {
    if (deliveries.has(id)) return deliveries.get(id);
    const saving = (async () => {
      let record;
      try { record = await read(id); }
      catch (error) { if (error.status === 404) return fileName; throw error; }
      if (record.exportFileName) return record.exportFileName;
      const target = file(id), temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify({ ...record, exportFileName: fileName }), { mode: 0o600 });
      await rename(temporary, target);
      return fileName;
    })().finally(() => deliveries.delete(id));
    deliveries.set(id, saving);
    return saving;
  }
  async function execute(id, request, resolution) {
    if (deliveries.has(id)) await deliveries.get(id);
    const record = await read(id);
    const runId = `seedance-finish-${id}`;
    const provider = record.provider || "fal";
    if (!supportsSeedanceDraft(provider)) throw failure(400, "This provider does not support draft finishing.");
    if (!seedanceDraftFinishResolutions(provider).includes(resolution)) {
      throw failure(400, seedanceDraftProviderName(provider) + " supports finishing drafts at 1080p.");
    }
    const existing = jobs.get(runId);
    if (existing) {
      const startedResolution = existing.seedanceDraftResolution || "1080p";
      if (startedResolution !== resolution) throw failure(409, "This draft already has a " + seedanceDraftFinishLabel(startedResolution) + " finish job.");
      return existing;
    }
    const key = String(getKey(provider) || "").trim();
    if (!key || providerKeyFingerprint(key) !== record.keyFingerprint) throw failure(400, `Enable the original ${seedanceDraftProviderName(provider)} API key used for this draft before finishing it.`);
    if (now() >= Date.parse(record.expiresAt)) throw failure(410, "This draft's seven-day finishing window has expired. Its preview is still available.");
    const original = record.original;
    const fallbackFileName = String(request.previewFileName || "").replace(/\\/g, "/").split(/[?#]/)[0];
    const previewFileName = path.basename(record.exportFileName || record.previewFileName || fallbackFileName);
    const previewStem = seedanceDraftPairStem(previewFileName) || `seedance-${id.slice(0, 8)}`;
    const seedanceFinishedFileName = previewStem + ".mp4";
    const settings = { ...original.settings, resolution, seedanceDraft: false, seedanceDraftSource: id,
      seedanceDraftPreviewFileName: previewFileName, seedanceDraftDeliveryFileName: seedanceFinishedFileName };
    const context = request.draftCompletionDestination === true ? workflowContextPayload(request) : {};
    const body = { ...original.body, ...context,
      ...(request.draftCompletionDestination === true ? { nodeId: request.nodeId, nodeTitle: request.nodeTitle, outputDirectory: "", outputFileName: "" } : {}),
      generationRunId: runId, generationGroupId: request.generationGroupId || runId,
      generationBatchIndex: request.generationBatchIndex || 1, generationBatchTotal: request.generationBatchTotal || 1,
      seedanceDraftOutput: false, seedanceFinishedFileName };
    if (body.outputTargetPath) {
      body.outputTargetFileName = "$filename";
      body.outputTargetSourceFileName = seedanceFinishedFileName;
    }
    const endpoint = {
      atlas: seedanceAtlasDraftCompletionEndpoint,
      fal: seedanceDraftCompletionEndpoint,
      krea: kreaSeedanceEndpoint(undefined, "Seedance 2.5")
    }[provider];
    const input = {
      atlas: { model: endpoint, draft_id: record.draftId, resolution },
      fal: { draft_id: record.draftId, resolution, codec: "auto" },
      krea: { draft_job_id: record.draftId, resolution }
    }[provider];
    const storageFallback = (await checkOutput(body))?.fallback === true;
    const spec = { ...original, provider, modelName: "Seedance 2.5", endpoint,
      credentialFingerprint: record.keyFingerprint, seedance25: true,
      input,
      body, storageFallback, cost: seedanceDraftCost("completion", provider), settings, routeKind: "draft-completion" };
    return jobs.create(runId, spec, runId);
  }
  async function complete(id, request = {}) {
    const resolution = request.resolution === undefined ? "1080p" : String(request.resolution).trim().toLowerCase();
    if (!["1080p", "4k"].includes(resolution)) throw failure(400, "Choose 1080p or 4K to finish the draft.");
    const current = active.get(id);
    if (current) {
      if (current.resolution !== resolution) throw failure(409, "A finish at " + seedanceDraftFinishLabel(current.resolution) + " is already starting for this draft.");
      return current.pending;
    }
    const pending = execute(id, request, resolution).finally(() => active.delete(id));
    active.set(id, { resolution, pending });
    return pending;
  }
  return { recordDraft, rememberOutput, complete };
}
export function registerSeedanceDraftRoutes(app, { store, sendApiError }) {
  app.post("/api/node/seedance-draft/complete", async (req, res) => {
    try { res.status(202).json({ job: await store.complete(req.body.receiptId, req.body) }); }
    catch (error) { sendApiError(res, error, "Could not finish this draft. Its preview has been preserved."); }
  });
}
