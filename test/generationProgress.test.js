import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateGenerationProgressEntries,
  formatGenerationElapsed,
  generationEntryProgress,
  generationProgressEntriesForNode,
  generationRequestMetadata,
  mergeGenerationProgressEntry,
  liveGenerationElapsed,
  progressEntryFromRequestMetadata,
  shouldRenderGenerationProgress,
  shouldDiscardProgressEntryMissingFromServer
} from "../src/generationProgress.js";

test("generation progress isolates identical node IDs in different workflows", () => {
  const entries = [
    { runId: "run-a", scope: "workflow-a", nodeId: "shared-node" },
    { runId: "run-b", scope: "workflow-b", nodeId: "shared-node" },
    { runId: "run-c", scope: "workflow-a", nodeId: "other-node" }
  ];

  assert.deepEqual(
    generationProgressEntriesForNode(entries, "workflow-a", "shared-node").map((entry) => entry.runId),
    ["run-a"]
  );
  assert.deepEqual(
    generationProgressEntriesForNode(entries, "workflow-b", "shared-node").map((entry) => entry.runId),
    ["run-b"]
  );
});

test("generation request metadata keeps one group across a model batch", () => {
  const first = generationRequestMetadata({
    scope: '["project-a","package-a","c:/projects/a"]',
    nodeId: "image-1",
    nodeTitle: "Image Model",
    kind: "image",
    groupId: "batch-1",
    batchIndex: 1,
    batchTotal: 3
  });
  const second = generationRequestMetadata({
    nodeId: "image-1",
    nodeTitle: "Image Model",
    kind: "image",
    groupId: "batch-1",
    batchIndex: 2,
    batchTotal: 3
  });

  assert.equal(first.generationGroupId, "batch-1");
  assert.equal(first.generationScope, '["project-a","package-a","c:/projects/a"]');
  assert.equal(progressEntryFromRequestMetadata(first).scope, first.generationScope);
  assert.equal(second.generationGroupId, "batch-1");
  assert.notEqual(first.generationRunId, second.generationRunId);
  assert.equal(second.generationBatchIndex, 2);
  assert.equal(second.generationBatchTotal, 3);
});

test("single-provider progress advances with a labeled estimate when no real percentage exists", () => {
  const metadata = generationRequestMetadata({ nodeId: "video-1", groupId: "video-group", kind: "video" });
  const entry = {
    ...progressEntryFromRequestMetadata(metadata, "2026-08-16T12:00:00.000Z"),
    status: "running",
    phase: "generating",
    updatedAt: "2026-08-16T12:00:01.000Z"
  };
  const progress = aggregateGenerationProgressEntries([entry], Date.parse("2026-08-16T12:00:05.000Z"));

  assert.equal(progress.status, "running");
  assert.equal(progress.phase, "generating");
  assert.equal(progress.determinate, true);
  assert.equal(progress.estimated, true);
  assert.ok(progress.percent > 10);
  assert.ok(progress.percent < 92);
  assert.equal(progress.elapsedMs, 5000);
});

test("provider health and heartbeat survive progress aggregation", () => {
  const metadata = generationRequestMetadata({ nodeId: "video-health", groupId: "health-group", kind: "video" });
  const entry = {
    ...progressEntryFromRequestMetadata(metadata, "2026-08-16T12:00:00.000Z"),
    status: "running",
    phase: "generating",
    provider: "krea",
    providerStatus: "processing",
    health: "stalled",
    lastContactAt: "2026-08-16T12:30:00.000Z",
    message: "Provider is responding."
  };

  const progress = aggregateGenerationProgressEntries([entry], Date.parse("2026-08-16T12:30:01.000Z"));
  assert.equal(progress.provider, "krea");
  assert.equal(progress.providerStatus, "processing");
  assert.equal(progress.health, "stalled");
  assert.equal(progress.lastContactAt, "2026-08-16T12:30:00.000Z");
});

test("batch progress combines completed, provider, and estimated request progress", () => {
  const base = {
    groupId: "batch-2",
    nodeId: "image-2",
    kind: "image",
    label: "Image generation",
    batchTotal: 4,
    startedAt: "2026-08-16T12:00:00.000Z"
  };
  const progress = aggregateGenerationProgressEntries([
    { ...base, runId: "run-1", batchIndex: 1, status: "completed", phase: "complete", percent: 100, updatedAt: "2026-08-16T12:00:02.000Z" },
    { ...base, runId: "run-2", batchIndex: 2, status: "running", phase: "generating", percent: 50, updatedAt: "2026-08-16T12:00:03.000Z" },
    { ...base, runId: "run-3", batchIndex: 3, status: "queued", phase: "queued", percent: null, updatedAt: "2026-08-16T12:00:01.000Z" }
  ], Date.parse("2026-08-16T12:00:04.000Z"));

  assert.equal(progress.determinate, true);
  assert.equal(progress.estimated, true);
  assert.ok(progress.percent > 37.5);
  assert.ok(progress.percent < 40);
  assert.equal(progress.settledCount, 1);
  assert.equal(progress.batchTotal, 4);
});

test("a finished group reports failure when any batch request failed", () => {
  const base = {
    groupId: "batch-3",
    nodeId: "video-2",
    kind: "video",
    batchTotal: 2,
    startedAt: "2026-08-16T12:00:00.000Z"
  };
  const progress = aggregateGenerationProgressEntries([
    { ...base, runId: "run-1", status: "completed", phase: "complete", percent: 100, updatedAt: "2026-08-16T12:00:03.000Z" },
    { ...base, runId: "run-2", status: "failed", phase: "failed", percent: null, updatedAt: "2026-08-16T12:00:04.000Z" }
  ]);

  assert.equal(progress.status, "failed");
  assert.equal(progress.phase, "failed");
  assert.equal(progress.failedCount, 1);
  assert.equal(progress.elapsedMs, 4000);
});

test("completed generation elapsed time freezes at the terminal update", () => {
  const progress = aggregateGenerationProgressEntries([{
    runId: "run-complete",
    groupId: "group-complete",
    nodeId: "video-complete",
    kind: "video",
    status: "completed",
    phase: "complete",
    percent: 100,
    startedAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:03:21.000Z"
  }], Date.parse("2026-08-16T13:00:00.000Z"));

  assert.equal(progress.elapsedMs, 201000);
  assert.equal(progress.finishedAt, "2026-08-16T12:03:21.000Z");
  assert.equal(liveGenerationElapsed(progress, Date.parse("2026-08-16T14:00:00.000Z")), 201000);
});

test("generation elapsed display continues beyond one minute", () => {
  assert.equal(formatGenerationElapsed(61000), "1:01");
  assert.equal(formatGenerationElapsed(3661000), "61:01");
  assert.equal(liveGenerationElapsed({
    status: "running",
    startedAt: "2026-08-16T12:00:00.000Z",
    elapsedMs: 59000
  }, Date.parse("2026-08-16T12:01:05.000Z")), 65000);
});
test("sequential batches stay active between completed requests", () => {
  const progress = aggregateGenerationProgressEntries([{
    runId: "run-1",
    groupId: "batch-4",
    nodeId: "image-4",
    status: "completed",
    phase: "complete",
    percent: 100,
    batchIndex: 1,
    batchTotal: 3,
    startedAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:03.000Z"
  }]);

  assert.equal(progress.status, "running");
  assert.equal(progress.phase, "generating");
  assert.ok(Math.abs(progress.percent - (100 / 3)) < 0.000001);
  assert.equal(progress.settledCount, 1);
});
test("estimated generation progress advances and reserves the final stages", () => {
  const entry = {
    runId: "run-estimate",
    groupId: "estimate-group",
    nodeId: "video-estimate",
    kind: "video",
    status: "running",
    phase: "generating",
    phaseStartedAt: "2026-08-16T12:00:00.000Z",
    startedAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z"
  };
  const early = generationEntryProgress(entry, Date.parse("2026-08-16T12:00:30.000Z"));
  const later = generationEntryProgress(entry, Date.parse("2026-08-16T12:03:00.000Z"));

  assert.equal(early.estimated, true);
  assert.ok(later.percent > early.percent);
  assert.ok(later.percent < 94);
  assert.equal(generationEntryProgress({ ...entry, phase: "downloading" }).percent, 94);
  assert.equal(generationEntryProgress({ ...entry, phase: "finalizing" }).percent, 98);
});

test("provider percentages remain exact instead of estimated", () => {
  const progress = generationEntryProgress({
    status: "running",
    phase: "generating",
    kind: "image",
    percent: 61
  });

  assert.equal(progress.percent, 61);
  assert.equal(progress.estimated, false);
});

test("fresh local progress survives briefly while its request registers with the server", () => {
  const entry = {
    runId: "fresh-run",
    nodeId: "video-fresh",
    status: "queued",
    startedAt: "2026-08-18T12:00:00.000Z"
  };

  assert.equal(
    shouldDiscardProgressEntryMissingFromServer(entry, Date.parse("2026-08-18T12:00:09.999Z")),
    false
  );
});

test("active progress missing from the server is discarded after registration grace", () => {
  const entry = {
    runId: "stale-run",
    nodeId: "video-stale",
    status: "running",
    startedAt: "2026-08-18T12:00:00.000Z"
  };

  assert.equal(
    shouldDiscardProgressEntryMissingFromServer(entry, Date.parse("2026-08-18T12:00:10.000Z")),
    true
  );
});

test("terminal local progress remains until the next node submission", () => {
  assert.equal(shouldDiscardProgressEntryMissingFromServer({
    runId: "complete-run",
    nodeId: "image-complete",
    status: "completed",
    startedAt: "2026-08-18T12:00:00.000Z"
  }), false);
});

test("the latest completed, failed, or attention progress remains visible", () => {
  assert.equal(shouldRenderGenerationProgress(null), false);
  assert.equal(shouldRenderGenerationProgress({ status: "running" }), true);
  assert.equal(shouldRenderGenerationProgress({ status: "running" }, "complete"), true);
  assert.equal(shouldRenderGenerationProgress({ status: "completed" }), true);
  assert.equal(shouldRenderGenerationProgress({ status: "failed" }), true);
  assert.equal(shouldRenderGenerationProgress({ status: "attention" }), true);
});

test("completed progress cannot be resurrected by an older active server snapshot", () => {
  const completed = {
    runId: "run-1",
    nodeId: "video-1",
    status: "completed",
    phase: "complete",
    percent: 100,
    updatedAt: "2026-09-07T01:41:39.000Z"
  };
  const staleDownload = {
    ...completed,
    status: "running",
    phase: "downloading",
    percent: 94,
    updatedAt: "2026-09-07T01:41:38.000Z"
  };

  assert.deepEqual(mergeGenerationProgressEntry(completed, staleDownload), completed);
});
