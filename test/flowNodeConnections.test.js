import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNodeConnectionKeys,
  buildNodeInputDependencyRefs,
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
