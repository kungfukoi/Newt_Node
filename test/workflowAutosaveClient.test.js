import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutosaveWorkflow, workflowAutosaveIntervalMs } from "../src/workflowAutosave.js";

test("workflow autosave runs every two minutes for dirty packaged workflows", () => {
  assert.equal(workflowAutosaveIntervalMs, 120000);
  assert.equal(shouldAutosaveWorkflow({
    projectId: "workflow-1",
    packagePath: "C:/Projects/Test",
    currentFingerprint: "dirty",
    cleanFingerprint: "clean",
    lastAutosavedFingerprint: ""
  }), true);
});

test("workflow autosave skips clean, unpackaged, and already captured states", () => {
  const base = {
    projectId: "workflow-1",
    packagePath: "C:/Projects/Test",
    currentFingerprint: "current",
    cleanFingerprint: "clean",
    lastAutosavedFingerprint: "previous"
  };
  assert.equal(shouldAutosaveWorkflow({ ...base, packagePath: "" }), false);
  assert.equal(shouldAutosaveWorkflow({ ...base, cleanFingerprint: "current" }), false);
  assert.equal(shouldAutosaveWorkflow({ ...base, lastAutosavedFingerprint: "current" }), false);
});
