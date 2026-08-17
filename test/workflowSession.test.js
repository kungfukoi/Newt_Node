import test from "node:test";
import assert from "node:assert/strict";
import { createWorkflowSessionId, workflowRequestContextForState } from "../src/workflowSession.js";

test("new workflows receive unique stable session ids", () => {
  const first = createWorkflowSessionId();
  const second = createWorkflowSessionId();

  assert.match(first, /^workflow-/);
  assert.match(second, /^workflow-/);
  assert.notEqual(first, second);
});

test("workflow request context preserves an unsaved workflow session id", () => {
  const context = workflowRequestContextForState({
    projectId: "workflow-session-a",
    projectName: "Untitled node project"
  });

  assert.equal(context.projectId, "workflow-session-a");
  assert.equal(context.projectName, "Untitled node project");
});
