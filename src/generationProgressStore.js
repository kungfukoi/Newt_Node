import { generationProgressApi } from "./api/newtApi.js";
import {
  aggregateGenerationProgressEntries,
  generationProgressTerminalDisplayMs,
  generationProgressEntriesForNode,
  generationRequestMetadata,
  isTerminalProgressStatus,
  mergeGenerationProgressEntry,
  progressEntryFromRequestMetadata,
  shouldDiscardProgressEntryMissingFromServer
} from "./generationProgress.js";

const entriesByRunId = new Map();
const snapshotsByNodeKey = new Map();
const listenersByNodeKey = new Map();
let pollTimer = null;
let pollInFlight = false;

export function subscribeGenerationProgress(scope, nodeId, listener) {
  const normalizedScope = String(scope || "");
  const normalizedNodeId = String(nodeId || "");
  const key = progressNodeKey(normalizedScope, normalizedNodeId);
  const record = listenersByNodeKey.get(key) || { scope: normalizedScope, nodeId: normalizedNodeId, listeners: new Set() };
  record.listeners.add(listener);
  listenersByNodeKey.set(key, record);
  scheduleProgressPoll(0);
  return () => {
    record.listeners.delete(listener);
    if (!record.listeners.size) listenersByNodeKey.delete(key);
    if (!listenersByNodeKey.size && pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };
}

export function generationProgressSnapshot(scope, nodeId) {
  return snapshotsByNodeKey.get(progressNodeKey(scope, nodeId)) || null;
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
      status: result?.data?.needsAttention ? "attention" : succeeded ? "completed" : "failed",
      phase: result?.data?.needsAttention ? "attention" : succeeded ? "complete" : "failed",
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
  if (pollInFlight || !listenersByNodeKey.size) return;
  pollInFlight = true;
  let hasActive = false;
  try {
    const scopes = [...new Set([...listenersByNodeKey.values()].map((record) => record.scope))];
    const responses = await Promise.all(scopes.map(async (scope) => ({ scope, data: await generationProgressApi.list(scope) })));
    responses.forEach(({ scope, data }) => {
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      reconcileProgressEntries(entries, scope);
    });
    const subscribedScopes = new Set(scopes);
    hasActive = [...entriesByRunId.values()].some((entry) => subscribedScopes.has(progressEntryScope(entry)) && !isTerminalProgressStatus(entry.status));
    refreshSubscribedSnapshots();
  } catch {
    const subscribedScopes = new Set([...listenersByNodeKey.values()].map((record) => record.scope));
    hasActive = [...entriesByRunId.values()].some((entry) => subscribedScopes.has(progressEntryScope(entry)) && !isTerminalProgressStatus(entry.status));
  } finally {
    pollInFlight = false;
    scheduleProgressPoll(hasActive ? 650 : 2500);
  }
}

function reconcileProgressEntries(serverEntries, scope) {
  const serverRunIds = new Set();
  serverEntries.forEach((entry) => {
    if (!entry?.runId || !entry?.nodeId) return;
    serverRunIds.add(entry.runId);
    upsertProgressEntry({ ...entry, scope: progressEntryScope(entry) || scope });
  });

  const affectedNodeKeys = new Set();
  for (const [runId, entry] of entriesByRunId) {
    if (progressEntryScope(entry) !== scope) continue;
    if (serverRunIds.has(runId) || !shouldDiscardProgressEntryMissingFromServer(entry)) continue;
    entriesByRunId.delete(runId);
    affectedNodeKeys.add(progressNodeKey(scope, entry.nodeId));
  }
  affectedNodeKeys.forEach((key) => {
    const record = listenersByNodeKey.get(key);
    if (record) refreshNodeSnapshot(record.scope, record.nodeId);
  });
}

function scheduleProgressPoll(delay) {
  if (typeof window === "undefined" || !listenersByNodeKey.size) return;
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    pollTimer = null;
    refreshGenerationProgress();
  }, Math.max(0, delay));
}

function upsertProgressEntry(entry) {
  if (!entry?.runId || !entry?.nodeId) return;
  const previous = entriesByRunId.get(entry.runId);
  const next = mergeGenerationProgressEntry(previous, entry);
  entriesByRunId.set(entry.runId, next);
  refreshNodeSnapshot(progressEntryScope(next), next.nodeId);
  if (
    isTerminalProgressStatus(next.status) &&
    (!previous || previous.status !== next.status || previous.updatedAt !== next.updatedAt)
  ) {
    scheduleTerminalCleanup(next);
  }
}

function refreshSubscribedSnapshots() {
  for (const record of listenersByNodeKey.values()) refreshNodeSnapshot(record.scope, record.nodeId);
}

function refreshNodeSnapshot(scope, nodeId) {
  const normalizedScope = String(scope || "");
  const normalizedNodeId = String(nodeId || "");
  const key = progressNodeKey(normalizedScope, normalizedNodeId);
  const entries = generationProgressEntriesForNode([...entriesByRunId.values()], normalizedScope, normalizedNodeId).filter(progressEntryVisible);
  let next = aggregateGenerationProgressEntries(entries);
  const previous = snapshotsByNodeKey.get(key) || null;
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
  if (next) snapshotsByNodeKey.set(key, next);
  else snapshotsByNodeKey.delete(key);
  for (const listener of listenersByNodeKey.get(key)?.listeners || []) listener();
}

function progressEntryVisible(entry, now = Date.now()) {
  if (!isTerminalProgressStatus(entry.status)) return true;
  if ([...entriesByRunId.values()].some((other) => progressEntryScope(other) === progressEntryScope(entry) && other.groupId === entry.groupId && !isTerminalProgressStatus(other.status))) return true;
  return now - Date.parse(entry.updatedAt || entry.startedAt || "") <= generationProgressTerminalDisplayMs;
}

function scheduleTerminalCleanup(entry) {
  const updatedAt = entry.updatedAt;
  setTimeout(() => {
    const current = entriesByRunId.get(entry.runId);
    if (!current || current.updatedAt !== updatedAt || !isTerminalProgressStatus(current.status)) return;
    refreshNodeSnapshot(progressEntryScope(entry), entry.nodeId);
  }, generationProgressTerminalDisplayMs + 100);
}

function progressNodeKey(scope, nodeId) {
  return JSON.stringify([String(scope || ""), String(nodeId || "")]);
}

function progressEntryScope(entry) {
  return String(entry?.scope || "");
}

function sameSnapshot(first, second) {
  if (first === second) return true;
  if (!first || !second) return false;
  return [
    "groupId", "status", "phase", "percent", "determinate", "estimated", "batchTotal", "settledCount",
    "completedCount", "failedCount", "queuePosition", "provider", "providerStatus", "health", "lastContactAt", "message", "updatedAt"
  ].every((key) => first[key] === second[key]) && Math.floor(first.elapsedMs / 1000) === Math.floor(second.elapsedMs / 1000);
}

function progressErrorMessage(data) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return "Generation failed.";
}
