import assert from "node:assert/strict";
import test from "node:test";

test("progress subscriptions with the same node ID stay isolated by workflow", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const requests = [];
  const startedAt = new Date().toISOString();
  globalThis.window = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    location: { hostname: "127.0.0.1", port: "5173" }
  };
  globalThis.fetch = async (url) => {
    const scope = new URL(String(url)).searchParams.get("scope");
    requests.push(scope);
    return new Response(JSON.stringify({
      entries: [{
        scope,
        runId: `run-${scope}`,
        groupId: `group-${scope}`,
        nodeId: "shared-node",
        kind: "video",
        label: scope,
        status: "running",
        phase: "generating",
        startedAt,
        updatedAt: startedAt
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const store = await import(`../src/generationProgressStore.js?scope-test=${Date.now()}`);
  const unsubscribeFirst = store.subscribeGenerationProgress("workflow-a", "shared-node", () => {});
  const unsubscribeSecond = store.subscribeGenerationProgress("workflow-b", "shared-node", () => {});
  try {
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(store.generationProgressSnapshot("workflow-a", "shared-node")?.label, "workflow-a");
    assert.equal(store.generationProgressSnapshot("workflow-b", "shared-node")?.label, "workflow-b");
    assert.deepEqual(new Set(requests), new Set(["workflow-a", "workflow-b"]));
  } finally {
    unsubscribeFirst();
    unsubscribeSecond();
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});
