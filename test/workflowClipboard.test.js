import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowClipboardPayload,
  parseWorkflowClipboardText,
  readWorkflowClipboardFromStorage,
  readWorkflowClipboardFromSystemClipboard,
  serializeWorkflowClipboardPayload,
  workflowClipboardStorageKey,
  workflowClipboardType,
  writeWorkflowClipboardToStorage,
  writeWorkflowClipboardToSystemClipboard
} from "../src/workflowClipboard.js";

test("workflow clipboard payloads round-trip selected nodes and internal edges", () => {
  const payload = createWorkflowClipboardPayload({
    nodes: [
      { id: "text-1", type: "text", x: 20, y: 40, data: { title: "Prompt", prompt: "hello" } },
      { id: "image-1", type: "imageModel", x: 400, y: 40, data: { title: "Image" } }
    ],
    edges: [
      {
        id: "edge-1",
        from: { nodeId: "text-1", port: "promptOut" },
        to: { nodeId: "image-1", port: "promptIn" },
        color: "#ffe000"
      }
    ],
    groups: [{ id: "group-1", x: 0, y: 0, width: 500, height: 300, nodeIds: ["text-1", "image-1"] }]
  });

  const parsed = parseWorkflowClipboardText(serializeWorkflowClipboardPayload(payload));

  assert.equal(parsed.type, workflowClipboardType);
  assert.deepEqual(parsed.nodes, payload.nodes);
  assert.deepEqual(parsed.edges, payload.edges);
  assert.deepEqual(parsed.groups, payload.groups);
});

test("workflow clipboard ignores ordinary clipboard text and unmarked JSON", () => {
  assert.equal(parseWorkflowClipboardText("plain text"), null);
  assert.equal(
    parseWorkflowClipboardText(JSON.stringify({ nodes: [{ id: "text-1", type: "text", data: {} }] })),
    null
  );

  assert.equal(
    parseWorkflowClipboardText(JSON.stringify({
      type: workflowClipboardType,
      nodes: [{ id: "text-1", type: "text", data: {} }]
    })).nodes.length,
    1
  );
});

test("workflow clipboard can be shared through browser storage", () => {
  const entries = new Map();
  const storage = {
    getItem(key) {
      return entries.get(key) || null;
    },
    setItem(key, value) {
      entries.set(key, value);
    }
  };
  const payload = createWorkflowClipboardPayload({
    nodes: [{ id: "camera-1", type: "camera", x: 1, y: 2, data: { title: "Camera" } }]
  });

  assert.equal(writeWorkflowClipboardToStorage(payload, storage), true);
  assert.equal(entries.has(workflowClipboardStorageKey), true);
  assert.deepEqual(readWorkflowClipboardFromStorage(storage), payload);
});

test("workflow clipboard can be shared through the system text clipboard", async () => {
  let clipboardText = "";
  const clipboard = {
    async readText() {
      return clipboardText;
    },
    async writeText(value) {
      clipboardText = value;
    }
  };
  const payload = createWorkflowClipboardPayload({
    nodes: [{ id: "style-1", type: "style", x: 10, y: 20, data: { stylePreset: "Cinematic" } }]
  });

  assert.equal(await writeWorkflowClipboardToSystemClipboard(payload, clipboard), true);
  assert.deepEqual(await readWorkflowClipboardFromSystemClipboard(clipboard), payload);
});
