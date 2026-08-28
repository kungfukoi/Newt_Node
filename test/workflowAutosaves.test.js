import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  listWorkflowAutosaves,
  saveWorkflowAutosave,
  workflowAutosaveDirectory,
  workflowAutosaveOpenContext
} from "../server/workflow-autosaves.js";

function workflow(version) {
  return {
    id: "workflow-1",
    name: "Autosave Test",
    fileName: "Autosave-Test.json",
    updatedAt: `2026-08-25T12:00:0${version}.000Z`,
    graph: {
      nodes: [{ id: `node-${version}`, type: "image", data: {} }],
      edges: [],
      groups: [],
      viewport: { x: version, y: 0, scale: 1 }
    }
  };
}

test("workflow autosaves live in a visible package autosaves folder", async (context) => {
  const packagePath = await mkdtemp(path.join(tmpdir(), "newtnode-autosave-"));
  context.after(() => rm(packagePath, { recursive: true, force: true }));

  const saved = await saveWorkflowAutosave(packagePath, workflow(1), {
    now: "2026-08-25T12:00:01.000Z"
  });
  const snapshot = JSON.parse(await readFile(saved.filePath, "utf8"));

  assert.equal(path.dirname(saved.filePath), workflowAutosaveDirectory(packagePath));
  assert.equal(saved.fileName, "autosave-1.json");
  assert.equal(snapshot.autosave.packagePath, path.resolve(packagePath));
  assert.equal(snapshot.autosave.workflowFileName, "Autosave-Test.json");
  assert.equal(snapshot.graph.nodes[0].id, "node-1");

  assert.deepEqual(workflowAutosaveOpenContext(saved.filePath, snapshot), {
    isAutosave: true,
    packagePath: path.resolve(packagePath),
    workflowFileName: "Autosave-Test.json",
    displayFilePath: path.join(path.resolve(packagePath), "Autosave-Test.json")
  });
});

test("workflow autosaves retain five versions and overwrite the oldest slot", async (context) => {
  const packagePath = await mkdtemp(path.join(tmpdir(), "newtnode-autosave-"));
  context.after(() => rm(packagePath, { recursive: true, force: true }));

  for (let version = 1; version <= 6; version += 1) {
    await saveWorkflowAutosave(packagePath, workflow(version), {
      now: `2026-08-25T12:00:0${version}.000Z`
    });
  }

  const autosaves = await listWorkflowAutosaves(packagePath);
  const snapshots = await Promise.all(autosaves.map(async (item) => JSON.parse(await readFile(item.filePath, "utf8"))));
  assert.equal(autosaves.length, 5);
  assert.deepEqual(autosaves.map((item) => item.slot), [1, 5, 4, 3, 2]);
  assert.deepEqual(snapshots.map((snapshot) => snapshot.graph.nodes[0].id), ["node-6", "node-5", "node-4", "node-3", "node-2"]);
});
