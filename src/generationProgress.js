export const generationProgressTerminalDisplayMs = 5000;
export const generationProgressServerRegistrationGraceMs = 10000;

export function createGenerationGroupId(prefix = "generation") {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${cleanProgressId(prefix) || "generation"}-${randomPart}`;
}

export function generationRequestMetadata({
  nodeId,
  nodeTitle,
  kind = "generation",
  label = "Generation",
  groupId,
  batchIndex = 1,
  batchTotal = 1
} = {}) {
  const normalizedGroupId = cleanProgressId(groupId) || createGenerationGroupId(kind);
  const normalizedBatchIndex = positiveInteger(batchIndex, 1);
  const normalizedBatchTotal = Math.max(normalizedBatchIndex, positiveInteger(batchTotal, 1));
  const runId = `${normalizedGroupId}:${normalizedBatchIndex}:${createGenerationGroupId("run")}`;
  return {
    generationRunId: runId,
    generationGroupId: normalizedGroupId,
    generationKind: String(kind || "generation"),
    generationLabel: String(label || "Generation"),
    generationBatchIndex: normalizedBatchIndex,
    generationBatchTotal: normalizedBatchTotal,
    nodeId: String(nodeId || ""),
    nodeTitle: String(nodeTitle || "")
  };
}

export function progressEntryFromRequestMetadata(metadata, now = new Date().toISOString()) {
  return {
    runId: metadata.generationRunId,
    groupId: metadata.generationGroupId,
    nodeId: metadata.nodeId,
    nodeTitle: metadata.nodeTitle,
    kind: metadata.generationKind,
    label: metadata.generationLabel,
    batchIndex: metadata.generationBatchIndex,
    batchTotal: metadata.generationBatchTotal,
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
}

export function generationEntryProgress(entry = {}, now = Date.now()) {
  if (entry.status === "attention") return { percent: null, estimated: false };
  const exactPercent = normalizedPercent(entry.percent);
  if (exactPercent !== null) return { percent: exactPercent, estimated: false };

  if (entry.status === "completed" || entry.phase === "complete") return { percent: 100, estimated: false };
  if (entry.status === "failed" || entry.phase === "failed") return { percent: 100, estimated: false };

  const phaseStartedAt = Date.parse(entry.phaseStartedAt || entry.updatedAt || entry.startedAt || "");
  const elapsedMs = Number.isFinite(phaseStartedAt) ? Math.max(0, now - phaseStartedAt) : 0;
  if (entry.phase === "queued") {
    return {
      percent: Math.min(8, 2 + (6 * (1 - Math.exp(-elapsedMs / 15000)))),
      estimated: true
    };
  }
  if (entry.phase === "downloading") return { percent: 94, estimated: true };
  if (entry.phase === "finalizing") return { percent: 98, estimated: true };

  const expectedDurationMs = ({
    text: 12000,
    image: 90000,
    video: 300000
  })[entry.kind] || 90000;
  const ratio = elapsedMs / expectedDurationMs;
  const percent = ratio <= 1
    ? 10 + (78 * ratio)
    : 88 + (4 * (1 - Math.exp(-(ratio - 1))));
  return { percent: Math.min(92, Math.max(10, percent)), estimated: true };
}

export function aggregateGenerationProgressEntries(entries = [], now = Date.now()) {
  const normalized = entries.filter((entry) => entry?.runId && entry?.nodeId);
  if (!normalized.length) return null;

  const groups = new Map();
  normalized.forEach((entry) => {
    const groupId = entry.groupId || entry.runId;
    const group = groups.get(groupId) || [];
    group.push(entry);
    groups.set(groupId, group);
  });
  const latestGroup = [...groups.values()].sort((first, second) => groupStartedAt(second) - groupStartedAt(first))[0];
  if (!latestGroup?.length) return null;

  const latestUpdated = [...latestGroup].sort((first, second) => entryUpdatedAt(second) - entryUpdatedAt(first))[0];
  const active = latestGroup.filter((entry) => !isTerminalProgressStatus(entry.status));
  const terminal = latestGroup.filter((entry) => isTerminalProgressStatus(entry.status));
  const failed = terminal.filter((entry) => entry.status === "failed");
  const attention = terminal.filter((entry) => entry.status === "attention");
  const batchTotal = Math.max(1, ...latestGroup.map((entry) => positiveInteger(entry.batchTotal, 1)));
  const settledCount = Math.min(batchTotal, terminal.length);
  const groupIncomplete = settledCount < batchTotal;
  const completedCount = Math.min(batchTotal, terminal.filter((entry) => entry.status === "completed").length);
  const current = [...active].sort((first, second) => entryUpdatedAt(second) - entryUpdatedAt(first))[0] || latestUpdated;
  const needsAttention = !active.length && attention.length > 0;
  const phase = needsAttention ? "attention" : progressPhase(active, failed, groupIncomplete);
  const status = needsAttention ? "attention" : active.length || groupIncomplete
    ? (phase === "queued" ? "queued" : "running")
    : attention.length ? "attention" : failed.length
      ? "failed"
      : "completed";
  const activeProgress = active.map((entry) => generationEntryProgress(entry, now));
  const numericActiveProgress = activeProgress
    .map((progress) => progress.percent)
    .filter((percent) => percent !== null);
  let percent = null;
  let determinate = false;
  let estimated = false;
  if (needsAttention || (!active.length && !groupIncomplete)) {
    percent = attention.length ? null : 100;
    determinate = !attention.length;
  } else if (batchTotal > 1 && (settledCount > 0 || numericActiveProgress.length)) {
    percent = Math.min(99, ((settledCount + numericActiveProgress.reduce((sum, value) => sum + value / 100, 0)) / batchTotal) * 100);
    determinate = true;
    estimated = activeProgress.some((progress) => progress.estimated);
  } else {
    const currentProgress = generationEntryProgress(current, now);
    percent = currentProgress.percent;
    determinate = percent !== null;
    estimated = currentProgress.estimated;
  }

  const startedAt = Math.min(...latestGroup.map((entry) => entryStartedAt(entry)).filter(Number.isFinite));
  const updatedAt = Math.max(...latestGroup.map((entry) => entryUpdatedAt(entry)).filter(Number.isFinite));
  return {
    nodeId: current.nodeId,
    groupId: current.groupId || current.runId,
    kind: current.kind || "generation",
    label: current.label || "Generation",
    status,
    phase,
    percent,
    determinate,
    estimated,
    batchTotal,
    settledCount,
    completedCount,
    failedCount: failed.length,
    attentionCount: attention.length,
    queuePosition: current.queuePosition ?? null,
    message: current.message || phaseLabel(phase),
    startedAt: Number.isFinite(startedAt) ? new Date(startedAt).toISOString() : current.startedAt,
    updatedAt: Number.isFinite(updatedAt) ? new Date(updatedAt).toISOString() : current.updatedAt,
    elapsedMs: Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : 0
  };
}

export function phaseLabel(phase) {
  return ({
    queued: "Queued",
    generating: "Generating",
    downloading: "Downloading",
    finalizing: "Finalizing",
    complete: "Complete",
    failed: "Failed",
    attention: "Needs attention"
  })[phase] || "Generating";
}

export function formatGenerationElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000) || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function isTerminalProgressStatus(status) {
  return status === "completed" || status === "failed" || status === "attention";
}

export function shouldDiscardProgressEntryMissingFromServer(entry, now = Date.now()) {
  if (!entry?.runId || !entry?.nodeId) return true;
  if (isTerminalProgressStatus(entry.status)) return true;
  const startedAt = Date.parse(entry.startedAt || entry.updatedAt || "");
  if (!Number.isFinite(startedAt)) return true;
  return now - startedAt >= generationProgressServerRegistrationGraceMs;
}

function progressPhase(active, failed, groupIncomplete) {
  if (!active.length) return groupIncomplete ? "generating" : failed.length ? "failed" : "complete";
  const phases = new Set(active.map((entry) => entry.phase));
  if (phases.has("downloading")) return "downloading";
  if (phases.has("finalizing")) return "finalizing";
  if (phases.has("generating")) return "generating";
  return "queued";
}

function groupStartedAt(entries) {
  return Math.max(...entries.map((entry) => entryStartedAt(entry)).filter(Number.isFinite), 0);
}

function entryStartedAt(entry) {
  return Date.parse(entry?.startedAt || entry?.updatedAt || "");
}

function entryUpdatedAt(entry) {
  return Date.parse(entry?.updatedAt || entry?.startedAt || "");
}

function normalizedPercent(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function cleanProgressId(value) {
  return String(value || "").trim().replace(/[^a-z0-9._:-]+/gi, "-").slice(0, 180);
}
