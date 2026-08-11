import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  exactWorkflowPackageAssetFilePath,
  registeredWorkflowPackageCandidates,
  relocatedWorkflowPackageAssetFilePath,
  uniqueWorkflowPackageAssetFilePath,
  workflowPackageAssetCandidatesForExternalFilePath,
  workflowSaveIdentity
} from "../server/workflowPackageAssets.js";

test("workflow package lookup recovers assets reorganized into nested folders", async (context) => {
  const packagePath = await mkdtemp(path.join(tmpdir(), "newtnode-package-assets-"));
  context.after(() => rm(packagePath, { recursive: true, force: true }));

  const outputPath = path.join(packagePath, "outputs", "Seq01", "frame.png");
  const storyboardPath = path.join(packagePath, "storyboards", "old", "Seq_2", "Seq_2_Frame_01.png");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.dirname(storyboardPath), { recursive: true });
  await writeFile(outputPath, "output");
  await writeFile(storyboardPath, "storyboard");

  assert.equal(await exactWorkflowPackageAssetFilePath(packagePath, "outputs/frame.png"), "");
  assert.equal(await relocatedWorkflowPackageAssetFilePath(packagePath, "outputs/frame.png"), outputPath);
  assert.equal(
    await relocatedWorkflowPackageAssetFilePath(packagePath, "storyboards/Seq_2/Seq_2_Frame_01.png"),
    storyboardPath
  );
});

test("workflow package lookup refuses ambiguous filename matches and traversal", async (context) => {
  const packagePath = await mkdtemp(path.join(tmpdir(), "newtnode-package-assets-"));
  context.after(() => rm(packagePath, { recursive: true, force: true }));

  const firstPath = path.join(packagePath, "outputs", "Seq01", "frame.png");
  const secondPath = path.join(packagePath, "outputs", "Seq02", "frame.png");
  await mkdir(path.dirname(firstPath), { recursive: true });
  await mkdir(path.dirname(secondPath), { recursive: true });
  await writeFile(firstPath, "first");
  await writeFile(secondPath, "second");

  assert.equal(await relocatedWorkflowPackageAssetFilePath(packagePath, "outputs/frame.png"), "");
  assert.equal(await exactWorkflowPackageAssetFilePath(packagePath, "../frame.png"), "");
});

test("workflow package lookup recovers a uniquely matching asset from a stale workflow id", async (context) => {
  const rootPath = await mkdtemp(path.join(tmpdir(), "newtnode-package-assets-"));
  context.after(() => rm(rootPath, { recursive: true, force: true }));

  const firstPackage = path.join(rootPath, "first");
  const secondPackage = path.join(rootPath, "second");
  const sourcePath = path.join(firstPackage, "outputs", "depth-video.mp4");
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await mkdir(path.join(secondPackage, "outputs"), { recursive: true });
  await writeFile(sourcePath, "video");

  const workflows = [{ packagePath: firstPackage }, { packagePath: secondPackage }];
  assert.equal(await uniqueWorkflowPackageAssetFilePath(workflows, "outputs/depth-video.mp4"), sourcePath);

  await writeFile(path.join(secondPackage, "outputs", "depth-video.mp4"), "duplicate");
  assert.equal(await uniqueWorkflowPackageAssetFilePath(workflows, "outputs/depth-video.mp4"), "");
});

test("external output paths rebase to a moved workflow package", () => {
  const candidates = workflowPackageAssetCandidatesForExternalFilePath(
    "C:\\Users\\someone\\OneDrive\\Projects\\DXC_video_v03\\outputs\\TrainShot\\Xbridge_16.png",
    "C:\\Users\\current\\OneDrive\\Projects\\DXC_video_v03"
  );

  assert.deepEqual(pathSegments(candidates[0]), ["outputs", "TrainShot", "Xbridge_16.png"]);
  assert.ok(candidates.some((candidate) => pathSegments(candidate).join("/") === "outputs/Xbridge_16.png"));
});

test("external output rebasing recognizes Windows paths in macOS packages", () => {
  const candidates = workflowPackageAssetCandidatesForExternalFilePath(
    "C:\\Users\\someone\\Projects\\ShowPackage\\outputs\\Seq01\\frame.png",
    "/Users/current/Projects/ShowPackage"
  );

  assert.deepEqual(pathSegments(candidates[0]), ["outputs", "Seq01", "frame.png"]);
});

test("workflow package candidates include duplicate ids and stale ids referenced by a graph", () => {
  const workflows = [
    { id: "shared-id", packagePath: "C:/packages/one", graph: {} },
    { id: "shared-id", packagePath: "C:/packages/two", graph: {} },
    {
      id: "new-id",
      packagePath: "C:/packages/three",
      graph: { nodes: [{ data: { image: "/workflow-assets/shared-id/outputs/frame.png" } }] }
    }
  ];

  assert.deepEqual(
    registeredWorkflowPackageCandidates(workflows, "shared-id").map((workflow) => workflow.packagePath),
    ["C:/packages/one", "C:/packages/two", "C:/packages/three"]
  );
});

test("Save As assigns a fresh workflow identity for a cloned package", () => {
  const existingWorkflow = { id: "original-id", packagePath: "C:/packages/original" };
  const cloned = workflowSaveIdentity({
    requestedId: "original-id",
    existingWorkflow,
    packageParentPath: "C:/packages",
    createId: () => "clone-id"
  });
  const ordinarySave = workflowSaveIdentity({
    requestedId: "original-id",
    existingWorkflow,
    createId: () => "unused-id"
  });

  assert.deepEqual(cloned, { id: "clone-id", existingWorkflow: null, isPackageClone: true });
  assert.deepEqual(ordinarySave, { id: "original-id", existingWorkflow, isPackageClone: false });
});
function pathSegments(value) {
  return String(value || "").split(/[\\/]+/).filter(Boolean);
}
