import test from "node:test";
import assert from "node:assert/strict";
import { mergeGenerationProgressEntry, aggregateGenerationProgressEntries, liveGenerationElapsed, formatGenerationElapsed } from "../src/generationProgress.js";

test("video elapsed time crosses 2:59 through retries and freezes only at completion", () => {
  const start = Date.parse("2026-09-15T12:00:00Z");
  let entry = { runId: "run", groupId: "group", nodeId: "video", kind: "video", status: "running", phase: "generating", startedAt: new Date(start).toISOString(), updatedAt: new Date(start).toISOString() };
  let previous = 0;
  for (const seconds of [179, 180, 181, 240, 360, 1800]) {
    const now = start + seconds * 1000;
    entry = mergeGenerationProgressEntry(entry, { ...entry, startedAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() });
    const progress = aggregateGenerationProgressEntries([entry], now);
    const elapsed = liveGenerationElapsed(progress, now);
    assert.equal(elapsed, seconds * 1000);
    assert.ok(elapsed > previous);
    previous = elapsed;
  }
  assert.equal(formatGenerationElapsed(180000), "3:00");
  const done = aggregateGenerationProgressEntries([{ ...entry, status: "completed", phase: "complete" }], start + 1900000);
  assert.equal(liveGenerationElapsed(done, start + 3600000), 1800000);
});
