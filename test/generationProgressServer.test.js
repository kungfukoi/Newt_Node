import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  beginGenerationProgress,
  clearGenerationProgressForTests,
  generationProgressMiddleware,
  listGenerationProgress,
  providerProgressPercent,
  updateCurrentGenerationProgress,
  updateGenerationProgress
} from "../server/generation-progress.js";

test.beforeEach(() => clearGenerationProgressForTests());

test("generation progress registry stores provider state without request payloads", () => {
  beginGenerationProgress({ runId: "run-1", groupId: "group-1", nodeId: "node-1", nodeTitle: "Video Model", batchTotal: 2 });
  updateGenerationProgress("run-1", {
    status: "running",
    phase: "generating",
    queuePosition: 4,
    requestId: "provider-request",
    message: "Generating"
  });

  const [entry] = listGenerationProgress();
  assert.equal(entry.runId, "run-1");
  assert.equal(entry.nodeId, "node-1");
  assert.equal(entry.status, "running");
  assert.equal(entry.queuePosition, 4);
  assert.equal(entry.requestId, "provider-request");
  assert.equal(Object.hasOwn(entry, "prompt"), false);
});

test("generation progress middleware completes a successful model request", () => {
  const request = {
    body: {
      generationRunId: "run-2",
      generationGroupId: "group-2",
      generationKind: "image",
      generationLabel: "Nano Banana Pro",
      generationBatchIndex: 1,
      generationBatchTotal: 1,
      nodeId: "image-1",
      nodeTitle: "Image Model"
    }
  };
  const response = new EventEmitter();
  response.statusCode = 200;
  response.writableEnded = true;

  generationProgressMiddleware(request, response, () => {
    updateCurrentGenerationProgress({ status: "running", phase: "downloading", message: "Downloading" });
  });
  assert.equal(listGenerationProgress()[0].phase, "downloading");
  response.emit("finish");

  const [entry] = listGenerationProgress();
  assert.equal(entry.status, "completed");
  assert.equal(entry.phase, "complete");
  assert.equal(entry.percent, 100);
});

test("generation progress middleware records failed HTTP responses", () => {
  const request = { body: { generationRunId: "run-3", nodeId: "text-1" } };
  const response = new EventEmitter();
  response.statusCode = 500;
  response.writableEnded = true;

  generationProgressMiddleware(request, response, () => {});
  response.emit("finish");

  const [entry] = listGenerationProgress();
  assert.equal(entry.status, "failed");
  assert.equal(entry.phase, "failed");
  assert.match(entry.message, /HTTP 500/);
});
test("provider progress accepts direct, percentage-log, and step-log formats", () => {
  assert.equal(providerProgressPercent({ progress: 0.42 }), 42);
  assert.equal(providerProgressPercent({ percentage: 67 }), 67);
  assert.equal(providerProgressPercent({ logs: [{ message: "Rendering 73.5%" }] }), 73.5);
  assert.equal(providerProgressPercent({ logs: [{ message: "Sampling step 12/30" }] }), 40);
  assert.equal(providerProgressPercent({ status: "IN_PROGRESS" }), null);
});
