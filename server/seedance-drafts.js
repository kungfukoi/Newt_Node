import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedanceDraftCompletionEndpoint as endpoint, seedanceDraftLifetimeMs, seedanceDraftCost } from "../src/seedanceDraft.js";
import { providerKeyFingerprint } from "./seedance-job-provider.js";
const failure = (status, message) => Object.assign(new Error(message), { status });

// The shared durable worker owns paid submission, polling, local save and History.
// A deterministic receipt makes finalization safe to repeat after a crash.
export function createSeedanceDraftStore({ directory, getKey, jobs, now = Date.now }) {
  const active = new Map();
  const file = id => {
    if (!/^[a-f0-9-]{36}$/.test(String(id))) throw failure(400, "Invalid draft receipt.");
    return path.join(directory, `${id}.json`);
  };
  async function read(id) {
    try { return JSON.parse(await readFile(file(id), "utf8")); }
    catch (error) {
      if (error.code === "ENOENT") throw failure(404, "Finish this draft on the NewtNode installation that created it, using the original Fal key.");
      throw error;
    }
  }
  async function recordDraft({ draftId, keyFingerprint, startedAt, original }) {
    if (typeof draftId !== "string" || !draftId.trim()) return null;
    const hash = createHash("sha256").update(`${keyFingerprint}:${draftId}`).digest("hex").slice(0, 32);
    const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`;
    let record;
    try { record = await read(id); } catch (error) { if (error.status !== 404) throw error; }
    if (!record) {
      const created = Number.isFinite(Number(startedAt)) ? Number(startedAt) : Date.parse(startedAt) || now();
      record = { id, draftId, keyFingerprint, original, createdAt: new Date(created).toISOString(), expiresAt: new Date(created + seedanceDraftLifetimeMs).toISOString() };
      await mkdir(directory, { recursive: true });
      const target = file(id), temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
      await rename(temporary, target);
    }
    return { receiptId: id, draftId, provider: "fal", createdAt: record.createdAt, expiresAt: record.expiresAt, resolution: "480p" };
  }
  async function execute(id) {
    const record = await read(id);
    const runId = `seedance-finish-${id}`;
    const existing = jobs.get(runId);
    if (existing) return existing;
    const key = String(getKey() || "").trim();
    if (!key || providerKeyFingerprint(key) !== record.keyFingerprint) throw failure(400, "Enable the original Fal API key used for this draft before finishing it.");
    if (now() >= Date.parse(record.expiresAt)) throw failure(410, "This draft's seven-day finishing window has expired. Its preview is still available.");
    const original = record.original;
    const settings = { ...original.settings, resolution: "1080p", seedanceDraft: false, seedanceDraftSource: id };
    const spec = { ...original, provider: "fal", modelName: "Seedance 2.5", endpoint,
      credentialFingerprint: record.keyFingerprint, seedance25: true,
      input: { draft_id: record.draftId, resolution: "1080p", codec: "auto" },
      body: { ...original.body, generationRunId: runId, generationGroupId: runId, generationBatchIndex: 1, generationBatchTotal: 1 },
      cost: seedanceDraftCost("completion"), settings, routeKind: "draft-completion" };
    return jobs.create(runId, spec, runId);
  }
  function complete(id) {
    if (active.has(id)) return active.get(id);
    const pending = execute(id).finally(() => active.delete(id));
    active.set(id, pending);
    return pending;
  }
  return { recordDraft, complete };
}
export function registerSeedanceDraftRoutes(app, { store, sendApiError }) {
  app.post("/api/node/seedance-draft/complete", async (req, res) => {
    try { res.status(202).json({ job: await store.complete(req.body.receiptId) }); }
    catch (error) { sendApiError(res, error, "Could not finish this draft. Its preview has been preserved."); }
  });
}
