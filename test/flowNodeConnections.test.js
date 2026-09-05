import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNodeConnectionKeys,
  buildNodeInputDependencyRefs,
  createFlowConnectionIndex,
  sameNodeInputDependencyRefs
} from "../src/flowNodeConnections.js";

test("connection keys update both endpoint nodes", () => {
  const nodes = [{ id: "source" }, { id: "target" }, { id: "other" }];
  const before = buildNodeConnectionKeys(nodes, []);
  const after = buildNodeConnectionKeys(nodes, [{
    id: "edge-1",
    from: { nodeId: "source", port: "videoOut" },
    to: { nodeId: "target", port: "sourceIn" }
  }]);

  assert.notEqual(after.get("source"), before.get("source"));
  assert.notEqual(after.get("target"), before.get("target"));
  assert.equal(after.get("other"), before.get("other"));
});

test("connection keys are stable when edge order changes", () => {
  const nodes = [{ id: "source" }, { id: "target-a" }, { id: "target-b" }];
  const edges = [
    {
      from: { nodeId: "source", port: "videoOut" },
      to: { nodeId: "target-a", port: "sourceIn" }
    },
    {
      from: { nodeId: "source", port: "videoOut" },
      to: { nodeId: "target-b", port: "sourceIn" }
    }
  ];

  assert.deepEqual(
    buildNodeConnectionKeys(nodes, edges),
    buildNodeConnectionKeys(nodes, [...edges].reverse())
  );
});

test("input dependency refs update only downstream nodes when source data changes", () => {
  const sourceData = { resultUrl: "/outputs/old.png" };
  const nodes = [
    { id: "source", data: sourceData },
    { id: "preview", data: {} },
    { id: "unrelated", data: {} }
  ];
  const edges = [{
    from: { nodeId: "source", port: "imageOut" },
    to: { nodeId: "preview", port: "sourceIn" }
  }];
  const before = buildNodeInputDependencyRefs(nodes, edges);
  const after = buildNodeInputDependencyRefs(
    nodes.map((node) => node.id === "source"
      ? { ...node, data: { ...node.data, resultUrl: "/outputs/new.png" } }
      : node),
    edges
  );

  assert.equal(sameNodeInputDependencyRefs(before.get("preview"), after.get("preview")), false);
  assert.equal(sameNodeInputDependencyRefs(before.get("unrelated"), after.get("unrelated")), true);
});

test("input dependency refs ignore source position-only updates", () => {
  const sourceData = { resultUrl: "/outputs/image.png" };
  const edges = [{
    from: { nodeId: "source", port: "imageOut" },
    to: { nodeId: "preview", port: "sourceIn" }
  }];
  const before = buildNodeInputDependencyRefs([
    { id: "source", x: 0, y: 0, data: sourceData },
    { id: "preview", data: {} }
  ], edges);
  const after = buildNodeInputDependencyRefs([
    { id: "source", x: 500, y: 200, data: sourceData },
    { id: "preview", data: {} }
  ], edges);

  assert.equal(sameNodeInputDependencyRefs(before.get("preview"), after.get("preview")), true);
});

test("connection index reuses topology and unrelated inputs but refreshes connected results", () => {
  const index = createFlowConnectionIndex();
  const nodes = [{ id: "source", data: { resultUrl: "old.png" } }, { id: "viewer", data: {} }, { id: "other", data: {} }];
  const edges = [{ from: { nodeId: "source", port: "imageOut" }, to: { nodeId: "viewer", port: "sourceIn" } }];
  const before = index(nodes, edges);
  const moved = index(nodes.map((node) => ({ ...node, x: 100 })), edges);
  assert.equal(moved.connectionKeysByNode, before.connectionKeysByNode);
  assert.equal(moved.bootstrapPortsByNode, before.bootstrapPortsByNode);
  assert.equal(moved.inputDependencyRefsByNode, before.inputDependencyRefsByNode);
  const updated = nodes.map((node) => node.id === "source" ? { ...node, data: { resultUrl: "new.png" } } : node);
  const after = index(updated, edges);
  assert.equal(after.connectionKeysByNode, before.connectionKeysByNode);
  assert.equal(after.inputDependencyRefsByNode.get("other"), before.inputDependencyRefsByNode.get("other"));
  assert.equal(after.inputDependencyRefsByNode.get("viewer")[0], updated[0].data);
  assert.deepEqual(after.inputDependencyRefsByNode, buildNodeInputDependencyRefs(updated, edges));
  const rewiredEdges = [{ ...edges[0], to: { nodeId: "other", port: "sourceIn" } }];
  const rewired = index(updated, rewiredEdges);
  assert.deepEqual(rewired.connectionKeysByNode, buildNodeConnectionKeys(updated, rewiredEdges));
  assert.deepEqual(rewired.inputDependencyRefsByNode, buildNodeInputDependencyRefs(updated, rewiredEdges));
  const deleted = index(updated.slice(1), rewiredEdges);
  assert.deepEqual(deleted.inputDependencyRefsByNode, buildNodeInputDependencyRefs(updated.slice(1), rewiredEdges));
});
