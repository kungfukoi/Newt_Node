import test from "node:test";
import assert from "node:assert/strict";
import {
  appendInputConnection,
  flowConnectOnClick,
  flowPortConnectability,
  shouldDisconnectInputPort
} from "../src/nodePortBehavior.js";

test("connections use directional drag handles instead of click-to-connect", () => {
  assert.equal(flowConnectOnClick, false);
  assert.deepEqual(flowPortConnectability("output"), {
    isConnectable: true,
    isConnectableStart: true,
    isConnectableEnd: false
  });
  assert.deepEqual(flowPortConnectability("input"), {
    isConnectable: true,
    isConnectableStart: false,
    isConnectableEnd: true
  });
});

test("clicking any connected input requests its disconnection", () => {
  assert.equal(shouldDisconnectInputPort("input", true), true);
  assert.equal(shouldDisconnectInputPort("input", false), false);
  assert.equal(shouldDisconnectInputPort("output", true), false);
});

test("dropping another compatible line appends without replacing existing input lines", () => {
  const first = {
    id: "edge-1",
    from: { nodeId: "image-a", port: "imageOut" },
    to: { nodeId: "model", port: "imagePromptIn" }
  };
  const second = {
    id: "edge-2",
    from: { nodeId: "image-b", port: "imageOut" },
    to: { nodeId: "model", port: "imagePromptIn" }
  };

  assert.deepEqual(appendInputConnection([first], second), [first, second]);
  assert.deepEqual(appendInputConnection([first], { ...first, id: "edge-new" }), [{ ...first, id: "edge-new" }]);
});
