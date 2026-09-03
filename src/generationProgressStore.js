import { generationProgressApi } from "./api/newtApi.js";
import {
  aggregateGenerationProgressEntries,
  generationProgressTerminalDisplayMs,
  generationRequestMetadata,
  isTerminalProgressStatus,
  progressEntryFromRequestMetadata,
  shouldDiscardProgressEntryMissingFromServer
} from "./generationProgress.js";

const entriesByRunId = new Map();
const snapshotsByNodeId = new Map();
const listenersByNodeId = new Map();
let pollTimer = null;
let pollInFlight = false;

export function subscribeGenerationProgress(nodeId, listener) {
  const id = String(nodeId || "");
  const listeners = listenersByNodeId.get(id) || new Set();
  listeners.add(listener);
  listenersByNodeId.set(id, listeners);
  scheduleProgressPoll(0);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) listenersByNodeId.delete(id);
    if (!listenersByNodeId.size && pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };
}

export function generationProgressSnapshot(nodeId) {
  return snapshotsByNodeId.get(String(nodeId || "")) || null;
}

export async function runTrackedGeneration(metadata, request) {
  const requestMetadata = generationRequestMetadata(metadata);
  upsertProgressEntry(progressEntryFromRequestMetadata(requestMetadata));
  scheduleProgressPoll(0);
  try {
    const result = await request(requestMetadata);
    const succeeded = result?.response?.ok !== false;
    upsertProgressEntry({
      ...entriesByRunId.get(requestMetadata.generationRunId),
      status: succeeded ? "completed" : "failed",
      phase: succeeded ? "complete" : "failed",
      percent: succeeded ? 100 : null,
      message: succeeded ? "Complete" : progressErrorMessage(result?.data),
      updatedAt: new Date().toISOString()
    });
    return result;
  } catch (error) {
    upsertProgressEntry({
      ...entriesByRunId.get(requestMetadata.generationRunId),
      status: "failed",
      phase: "failed",
      percent: null,
      message: error?.message || "Generation failed.",
      updatedAt: new Date().toISOString()
    });
    throw error;
  }
}

async function refreshGenerationProgress() {
  if (pollInFlight || !listenersByNodeId.size) return;
  pollInFlight = true;
  let hasActive = false;
  try {
    const data = await generationProgressApi.list();
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    reconcileProgressEntries(entries);
    hasActive = [...entriesByRunId.values()].some((entry) => !isTerminalProgressStatus(entry.status));
    refreshSubscribedSnapshots();
  } catch {
    hasActive = [...entriesByRunId.values()].some((entry) => !isTerminalProgressStatus(entry.status));
  } finally {
    pollInFlight = false;
    scheduleProgressPoll(hasActive ? 650 : 2500);
  }
}

function reconcileProgressEntries(serverEntries) {
  const serverRunIds = new Set();
  serverEntries.forEach((entry) => {
    if (!entry?.runId || !entry?.nodeId) return;
    serverRunIds.add(entry.runId);
    upsertProgressEntry(entry);
  });

  const affectedNodeIds = new Set();
  for (const [runId, entry] of entriesByRunId) {
    if (serverRunIds.has(runId) || !shouldDiscardProgressEntryMissingFromServer(entry)) continue;
    entriesByRunId.delete(runId);
    affectedNodeIds.add(entry.nodeId);
  }
  affectedNodeIds.forEach(refreshNodeSnapshot);
}

function scheduleProgressPoll(delay) {
  if (typeof window === "undefined" || !listenersByNodeId.size) return;
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    pollTimer = null;
    refreshGenerationProgress();
  }, Math.max(0, delay));
}

function upsertProgressEntry(entry) {
  if (!entry?.runId || !entry?.nodeId) return;
  const previous = entriesByRunId.get(entry.runId);
  const next = { ...previous, ...entry };
  entriesByRunId.set(entry.runId, next);
  refreshNodeSnapshot(next.nodeId);
  if (
    isTerminalProgressStatus(next.status) &&
    (!previous || previous.status !== next.status || previous.updatedAt !== next.updatedAt)
  ) {
    scheduleTerminalCleanup(next);
  }
}

function refreshSubscribedSnapshots() {
  for (const nodeId of listenersByNodeId.keys()) refreshNodeSnapshot(nodeId);
}

function refreshNodeSnapshot(nodeId) {
  const id = String(nodeId || "");
  const entries = [...entriesByRunId.values()].filter((entry) => entry.nodeId === id && progressEntryVisible(entry));
  let next = aggregateGenerationProgressEntries(entries);
  const previous = snapshotsByNodeId.get(id) || null;
  if (
    next &&
    previous?.groupId === next.groupId &&
    Number.isFinite(previous.percent) &&
    Number.isFinite(next.percent) &&
    next.percent < previous.percent
  ) {
    next = { ...next, percent: previous.percent, estimated: previous.estimated || next.estimated };
  }
  if (sameSnapshot(previous, next)) return;
  if (next) snapshotsByNodeId.set(id, next);
  else snapshotsByNodeId.delete(id);
  for (const listener of listenersByNodeId.get(id) || []) listener();
}

function progressEntryVisible(entry, now = Date.now()) {
  if (!isTerminalProgressStatus(entry.status)) return true;
  if ([...entriesByRunId.values()].some((other) => other.groupId === entry.groupId && !isTerminalProgressStatus(other.status))) return true;
  return now - Date.parse(entry.updatedAt || entry.startedAt || "") <= generationProgressTerminalDisplayMs;
}

function scheduleTerminalCleanup(entry) {
  const updatedAt = entry.updatedAt;
  setTimeout(() => {
    const current = entriesByRunId.get(entry.runId);
    if (!current || current.updatedAt !== updatedAt || !isTerminalProgressStatus(current.status)) return;
    refreshNodeSnapshot(entry.nodeId);
  }, generationProgressTerminalDisplayMs + 100);
}

function sameSnapshot(first, second) {
  if (first === second) return true;
  if (!first || !second) return false;
  return [
    "groupId", "status", "phase", "percent", "determinate", "estimated", "batchTotal", "settledCount",
    "completedCount", "failedCount", "queuePosition", "message", "updatedAt"
  ].every((key) => first[key] === second[key]) && Math.floor(first.elapsedMs / 1000) === Math.floor(second.elapsedMs / 1000);
}

function progressErrorMessage(data) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return "Generation failed.";
}
