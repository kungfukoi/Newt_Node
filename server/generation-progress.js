import { AsyncLocalStorage } from "node:async_hooks";

const progressContext = new AsyncLocalStorage();
const progressEntries = new Map();
const terminalRetentionMs = 5 * 60 * 1000;
const maxProgressEntries = 500;

export function generationProgressMiddleware(req, res, next) {
  const runId = cleanId(req.body?.generationRunId);
  if (!runId) return next();

  beginGenerationProgress({
    runId,
    groupId: req.body?.generationGroupId,
    nodeId: req.body?.nodeId,
    nodeTitle: req.body?.nodeTitle,
    kind: req.body?.generationKind,
    label: req.body?.generationLabel,
    batchIndex: req.body?.generationBatchIndex,
    batchTotal: req.body?.generationBatchTotal
  });

  let responseFinished = false;
  res.once("finish", () => {
    responseFinished = true;
    const failed = res.statusCode >= 400;
    updateGenerationProgress(runId, failed
      ? { status: "failed", phase: "failed", message: `Generation failed (HTTP ${res.statusCode}).` }
      : { status: "completed", phase: "complete", percent: 100, message: "Complete" });
  });
  res.once("close", () => {
    if (!responseFinished && !res.writableEnded) {
      updateGenerationProgress(runId, { status: "failed", phase: "failed", message: "Generation connection closed." });
    }
  });

  return progressContext.run({ runId }, next);
}

export function beginGenerationProgress(input = {}) {
  const runId = cleanId(input.runId);
  if (!runId) return null;
  pruneGenerationProgress();
  const now = new Date().toISOString();
  const entry = {
    runId,
    groupId: cleanId(input.groupId) || runId,
    nodeId: cleanId(input.nodeId),
    nodeTitle: cleanText(input.nodeTitle, 120),
    kind: cleanText(input.kind, 40) || "generation",
    label: cleanText(input.label, 120) || "Generation",
    batchIndex: positiveInteger(input.batchIndex, 1),
    batchTotal: positiveInteger(input.batchTotal, 1),
    status: "queued",
    phase: "queued",
    percent: null,
    queuePosition: null,
    providerStatus: "",
    requestId: "",
    message: "Queued",
    startedAt: now,
    phaseStartedAt: now,
    updatedAt: now
  };
  progressEntries.set(runId, entry);
  trimGenerationProgress();
  return { ...entry };
}

export function updateGenerationProgress(runId, patch = {}) {
  const id = cleanId(runId);
  const current = progressEntries.get(id);
  if (!current) return null;
  const normalizedPatch = normalizedProgressPatch(patch);
  const now = new Date().toISOString();
  const next = {
    ...current,
    ...normalizedPatch,
    runId: id,
    phaseStartedAt: normalizedPatch.phase && normalizedPatch.phase !== current.phase ? now : current.phaseStartedAt,
    updatedAt: now
  };
  progressEntries.set(id, next);
  return { ...next };
}

export function updateCurrentGenerationProgress(patch = {}) {
  const runId = progressContext.getStore()?.runId;
  return runId ? updateGenerationProgress(runId, patch) : null;
}

export function currentGenerationRunId() {
  return progressContext.getStore()?.runId || "";
}

export function listGenerationProgress() {
  pruneGenerationProgress();
  return [...progressEntries.values()]
    .sort((first, second) => Date.parse(first.startedAt) - Date.parse(second.startedAt))
    .map((entry) => ({ ...entry }));
}

export function clearGenerationProgressForTests() {
  progressEntries.clear();
}

export function providerProgressPercent(value = {}) {
  const directCandidates = [
    value?.progress,
    value?.percent,
    value?.percentage,
    value?.progress_percent,
    value?.progress_percentage,
    value?.metrics?.progress,
    value?.metrics?.percent,
    value?.metrics?.percentage
  ];
  for (const candidate of directCandidates) {
    const percent = normalizedProviderPercent(candidate);
    if (percent !== null) return percent;
  }

  const logs = Array.isArray(value?.logs) ? value.logs : [];
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const message = String(logs[index]?.message || "");
    const percentMatch = message.match(/(?:^|\s)(\d{1,3}(?:\.\d+)?)\s*%/);
    if (percentMatch) {
      const percent = normalizedPercent(percentMatch[1]);
      if (percent !== null) return percent;
    }
    const stepMatch = message.match(/(?:step|frame|sample|sampling)\s*(\d+)\s*(?:\/|of)\s*(\d+)/i);
    if (stepMatch) {
      const current = Number(stepMatch[1]);
      const total = Number(stepMatch[2]);
      if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
        return Math.max(0, Math.min(100, (current / total) * 100));
      }
    }
  }

  return null;
}

function normalizedProgressPatch(patch = {}) {
  const next = {};
  if (patch.status !== undefined) next.status = normalizedStatus(patch.status);
  if (patch.phase !== undefined) next.phase = normalizedPhase(patch.phase);
  if (patch.percent !== undefined) next.percent = normalizedPercent(patch.percent);
  if (patch.queuePosition !== undefined) next.queuePosition = normalizedQueuePosition(patch.queuePosition);
  if (patch.providerStatus !== undefined) next.providerStatus = cleanText(patch.providerStatus, 80);
  if (patch.requestId !== undefined) next.requestId = cleanText(patch.requestId, 160);
  if (patch.message !== undefined) next.message = cleanText(patch.message, 240);
  return next;
}

function normalizedStatus(value) {
  const status = String(value || "").toLowerCase();
  return ["queued", "running", "completed", "failed"].includes(status) ? status : "running";
}

function normalizedPhase(value) {
  const phase = String(value || "").toLowerCase();
  return ["queued", "generating", "downloading", "finalizing", "complete", "failed"].includes(phase)
    ? phase
    : "generating";
}

function normalizedPercent(value) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function normalizedProviderPercent(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return normalizedPercent(number >= 0 && number <= 1 ? number * 100 : number);
}

function normalizedQueuePosition(value) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

function cleanId(value) {
  return String(value || "").trim().replace(/[^a-z0-9._:-]+/gi, "-").slice(0, 180);
}

function cleanText(value, limit) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function pruneGenerationProgress(now = Date.now()) {
  for (const [runId, entry] of progressEntries) {
    if (!["completed", "failed"].includes(entry.status)) continue;
    if (now - Date.parse(entry.updatedAt) > terminalRetentionMs) progressEntries.delete(runId);
  }
}

function trimGenerationProgress() {
  if (progressEntries.size <= maxProgressEntries) return;
  const terminal = [...progressEntries.values()]
    .filter((entry) => ["completed", "failed"].includes(entry.status))
    .sort((first, second) => Date.parse(first.updatedAt) - Date.parse(second.updatedAt));
  for (const entry of terminal) {
    if (progressEntries.size <= maxProgressEntries) break;
    progressEntries.delete(entry.runId);
  }
}
