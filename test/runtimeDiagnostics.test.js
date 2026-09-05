import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeDiagnostics, safeJobDiagnostic } from "../server/runtime-diagnostics.js";

test("diagnostics start disabled, stop collecting on opt-out, and export only allowlisted job fields", async () => {
  const unsafe = { runId: "run-1", provider: "krea", state: "recovering", prompt: "PRIVATE", requestId: "SECRET", remote: { url: "https://signed/secret" }, spec: { key: "PRIVATE" }, lastError: { code: "ETIMEDOUT", httpStatus: 503, message: "PRIVATE" }, events: [{ at: "2026-09-04T12:00:00Z", state: "recovering", error: { code: "ETIMEDOUT", message: "PRIVATE" } }] };
  let enabled = 0; let disabled = 0;
  const service = createRuntimeDiagnostics({ version: "test", getCommit: async () => "1234567", getJobs: () => [unsafe], monitor: () => ({ mean: 2000000, max: 3000000, percentile: () => 2000000, enable: () => enabled++, disable: () => disabled++ }) });
  assert.equal((await service.snapshot()).jobs, undefined);
  assert.equal(enabled, 0);
  service.setEnabled(true);
  const snapshot = await service.snapshot();
  assert.equal(snapshot.eventLoop.p95Ms, 2);
  assert.equal(snapshot.commit, "1234567");
  assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE|SECRET|https:|prompt|requestId/);
  assert.deepEqual(snapshot.jobs[0].lastError, { code: "ETIMEDOUT", httpStatus: 503 });
  service.setEnabled(false);
  assert.equal(disabled, 1);
  assert.equal((await service.snapshot()).eventLoop, undefined);
  service.close();
  assert.equal(safeJobDiagnostic({ runId: "https://secret", events: [] }).runId, "redacted");
});
