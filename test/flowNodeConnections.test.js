import test from "node:test";
import assert from "node:assert/strict";
import { buildNodeConnectionKeys } from "../src/flowNodeConnections.js";

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
