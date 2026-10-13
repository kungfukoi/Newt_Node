import assert from "node:assert/strict";
import test from "node:test";
import { jobTimingDiagnostic } from "../server/job-diagnostics.js";

test("timings separate local stages from provider latency and freeze terminal time", () => {
  const job = { spec: { body: { generationSubmittedAt: 1000 } }, createdAt: 4000,
    submissionStartedAt: 6000, providerAcceptedAt: 14000, outputAvailableAt: 114000,
    finishedAt: 119000, providerLatencyMs: 99000 };
  assert.deepEqual(jobTimingDiagnostic(job, 999999), {
    preparationMs: 3000, admissionMs: 2000, submissionMs: 8000,
    providerTrackingMs: 100000, localSaveMs: 5000, totalMs: 118000,
    providerReportedLatencyMs: 99000
  });
});

test("older records and invalid timestamps do not invent stage measurements", () => {
  const timings = jobTimingDiagnostic({ createdAt: "bad", providerLatencyMs: -1 }, 10000);
  assert.ok(Object.values(timings).every(value => value === null));
  assert.equal(jobTimingDiagnostic({ createdAt: 1000, submissionStartedAt: 0 }, 10000).admissionMs, null);
  const legacy = jobTimingDiagnostic({ state: "completed", providerAcceptedAt: 1000, finishedAt: 5000 });
  assert.equal(legacy.providerTrackingMs, null);
  assert.equal(legacy.localSaveMs, null);
});
