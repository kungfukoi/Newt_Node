import test from "node:test";
import assert from "node:assert/strict";
import {
  clearStaleRunningState,
  cloneNode,
  dedupeEdges,
  remapImportedGraph,
  restoreGraphHistorySnapshot,
  workflowStateFingerprint
} from "../src/workflowState.js";

test("saving a Film Director preserves its built scene without persisting transient rebuild work", () => {
  const saved = cloneNode({
    id: "director-1",
    type: "skillDirector",
    data: {
      resultText: "Finished scene package",
      skillDirectorBuilt: true,
      skillDirectorLocks: { setup: true, style: true, motion: true, scene: true, shotList: true },
      skillDirectorAction: "build",
      skillDirectorQueuedAction: "shotList",
      skillDirectorQueueId: "shotList-runtime"
    }
  });

  assert.equal(saved.data.resultText, "Finished scene package");
  assert.equal(saved.data.skillDirectorBuilt, true);
  assert.deepEqual(saved.data.skillDirectorLocks, { setup: true, style: true, motion: true, scene: true, shotList: true });
  assert.equal(saved.data.skillDirectorAction, "");
  assert.equal(saved.data.skillDirectorQueuedAction, "");
  assert.equal(saved.data.skillDirectorQueueId, "");
});

test("workflowStateFingerprint ignores viewport changes", () => {
  const base = {
    nodes: [{ id: "a", type: "image", x: 0, y: 0, data: { title: "Image" } }],
    edges: [],
    groups: [],
    projectName: "Project",
    projectPackagePath: "",
    viewport: { x: 0, y: 0, scale: 1 }
  };
  assert.equal(workflowStateFingerprint(base), workflowStateFingerprint({ ...base, viewport: { x: 100, y: -20, scale: 1.5 } }));
});

test("incremental fingerprints preserve exact legacy JSON and recognize undo/reopen", () => {
  const state = {
    nodes: [
      { id: "a", type: "plainText", x: 0, y: 0, data: { prompt: 'quoted "text"\nline', resultItems: [{ url: "/outputs/a.png" }] } },
      { id: "b", type: "assembly", data: { assemblyFrameUrl: "blob:live", assemblyFrameTime: 3 } }
    ],
    edges: [{ from: { nodeId: "a", port: "promptOut" }, to: { nodeId: "b", port: "input" } }],
    groups: [{ nodeIds: ["a", "b"] }], projectName: "Example", projectPackagePath: "/project"
  };
  const initial = workflowStateFingerprint(state);
  const parsed = JSON.parse(initial);
  assert.equal(parsed.nodes[1].data.assemblyFrameUrl, "");
  assert.equal(parsed.nodes[1].data.assemblyFrameTime, 0);
  assert.equal(workflowStateFingerprint(JSON.parse(JSON.stringify(state))), initial);
  const edited = { ...state, nodes: [{ ...state.nodes[0], data: { ...state.nodes[0].data, prompt: "edited" } }, state.nodes[1]] };
  assert.notEqual(workflowStateFingerprint(edited), initial);
  assert.equal(workflowStateFingerprint(state), initial);
  const moved = { ...state, nodes: [{ ...state.nodes[0], x: 10 }, state.nodes[1]] };
  assert.notEqual(workflowStateFingerprint(moved), initial);
  assert.notEqual(workflowStateFingerprint({ ...state, projectPackagePath: "/saved-as" }), initial);
});

test("remapImportedGraph remaps node, edge, and group ids with an offset", () => {
  const graph = {
    nodes: [
      { id: "a", type: "image", x: 10, y: 20, data: { title: "A" } },
      { id: "b", type: "video", x: 30, y: 40, data: { title: "B", nodeReferenceBindings: { a: "a" } } }
    ],
    edges: [{ id: "edge-1", from: { nodeId: "a", port: "imageOut" }, to: { nodeId: "b", port: "videoIn" }, color: "#fff" }],
    groups: [{ id: "group-1", x: 0, y: 0, width: 100, height: 100, nodeIds: ["a", "b"] }]
  };

  const remapped = remapImportedGraph(graph, { x: 100, y: 200 }, 123);
  assert.match(remapped.nodes[0].id, /^image-/);
  assert.notEqual(remapped.nodes[0].id, "a");
  assert.equal(remapped.nodes[0].x, 110);
  assert.equal(remapped.nodes[1].y, 240);
  assert.equal(remapped.edges[0].from.nodeId, remapped.nodes[0].id);
  assert.equal(remapped.edges[0].to.nodeId, remapped.nodes[1].id);
  assert.equal(remapped.nodes[1].data.nodeReferenceBindings.a, remapped.nodes[0].id);
  assert.deepEqual(remapped.groups[0].nodeIds, remapped.nodes.map((node) => node.id));
});

test("dedupeEdges and clearStaleRunningState preserve load-safe graph state", () => {
  const edge = { id: "a", from: { nodeId: "n1", port: "out" }, to: { nodeId: "n2", port: "in" } };
  assert.equal(dedupeEdges([edge, { ...edge, id: "b" }]).length, 1);
  assert.deepEqual(clearStaleRunningState({ id: "n", data: { status: "running", resultUrl: "" } }).data.status, "ready");
  assert.deepEqual(clearStaleRunningState({ id: "n", data: { status: "running", resultUrl: "/outputs/a.png" } }).data.status, "complete");
});

test("structural graph undo preserves newer node data and the current viewport", () => {
  const snapshot = {
    nodes: [{ id: "a", type: "image", x: 10, y: 20, data: { title: "Old", resultUrl: "" } }],
    edges: [],
    groups: [],
    viewport: { x: 0, y: 0, scale: 1 }
  };
  const current = {
    nodes: [{ id: "a", type: "image", x: 90, y: 100, data: { title: "Current", resultUrl: "/outputs/new.png" } }],
    edges: [],
    groups: [],
    viewport: { x: -800, y: 450, scale: 0.4 }
  };

  const restored = restoreGraphHistorySnapshot(snapshot, current);
  assert.equal(restored.nodes[0].x, 10);
  assert.deepEqual(restored.nodes[0].data, current.nodes[0].data);
  assert.deepEqual(restored.viewport, current.viewport);
});

test("node-scoped graph undo restores data only for the edited node", () => {
  const snapshot = {
    nodes: [
      { id: "edited", type: "image", data: { title: "Before" } },
      { id: "other", type: "image", data: { title: "Old unrelated value" } }
    ]
  };
  const current = {
    nodes: [
      { id: "edited", type: "image", data: { title: "After" } },
      { id: "other", type: "image", data: { title: "New unrelated value" } }
    ],
    viewport: { x: 20, y: 30, scale: 2 }
  };

  current.edges = [{ id: "new-edge" }];
  current.groups = [{ id: "new-group", nodeIds: ["edited", "other"] }];
  current.nodes[0].x = 50;
  const restored = restoreGraphHistorySnapshot(snapshot, current, { nodeDataIds: ["edited"], restoreStructure: false });
  assert.equal(restored.nodes[0].data.title, "Before");
  assert.equal(restored.nodes[1].data.title, "New unrelated value");
  assert.equal(restored.nodes[0].x, 50);
  assert.deepEqual(restored.edges, current.edges);
  assert.deepEqual(restored.groups, current.groups);
});
