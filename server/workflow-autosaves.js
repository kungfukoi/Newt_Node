import path from "node:path";
import { mkdir, readdir } from "node:fs/promises";
import { fileMetadata, readJsonFile, writeJsonAtomic } from "./json-store.js";

export const workflowAutosaveDirectoryName = "autosaves";
export const workflowAutosaveLimit = 5;

const autosaveQueues = new Map();

export function workflowAutosaveDirectory(packagePath) {
  return path.join(path.resolve(String(packagePath || "")), workflowAutosaveDirectoryName);
}

export function workflowAutosaveOpenContext(filePath, workflow = {}) {
  const selectedPath = path.resolve(String(filePath || ""));
  const selectedFileName = path.basename(selectedPath);
  const selectedDirectory = path.dirname(selectedPath);
  const packagePath = String(workflow.autosave?.packagePath || "").trim();
  const resolvedPackagePath = packagePath ? path.resolve(packagePath) : "";
  const isAutosave = Boolean(
    workflow.autosave?.version &&
    resolvedPackagePath &&
    sameWorkflowPath(selectedDirectory, workflowAutosaveDirectory(resolvedPackagePath))
  );
  const workflowFileName = isAutosave
    ? safeWorkflowFileName(workflow.autosave?.workflowFileName || workflow.package?.workflowFileName || workflow.fileName) || selectedFileName
    : selectedFileName;

  return {
    isAutosave,
    packagePath: isAutosave ? resolvedPackagePath : selectedDirectory,
    workflowFileName,
    displayFilePath: isAutosave ? path.join(resolvedPackagePath, workflowFileName) : selectedPath
  };
}

export function sameWorkflowPath(first, second) {
  const leftValue = String(first || "").trim();
  const rightValue = String(second || "").trim();
  if (!leftValue || !rightValue) return false;
  const left = path.resolve(leftValue);
  const right = path.resolve(rightValue);
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

export async function listWorkflowAutosaves(packagePath, limit = workflowAutosaveLimit) {
  const directoryPath = workflowAutosaveDirectory(packagePath);
  const entries = await readdir(directoryPath, { withFileTypes: true }).catch(() => []);
  const autosaves = await Promise.all(entries
    .filter((entry) => entry.isFile())
    .map(async (entry) => {
      const slot = autosaveSlotFromFileName(entry.name, limit);
      if (!slot) return null;
      const filePath = path.join(directoryPath, entry.name);
      const [snapshot, metadata] = await Promise.all([
        readJsonFile(filePath, null),
        fileMetadata(filePath)
      ]);
      if (!snapshot?.graph || !metadata.exists) return null;
      return {
        slot,
        fileName: entry.name,
        filePath,
        savedAt: String(snapshot.autosave?.savedAt || metadata.updatedAt || ""),
        updatedAt: metadata.updatedAt || "",
        size: metadata.size || 0
      };
    }));

  return autosaves
    .filter(Boolean)
    .sort((left, right) => String(right.savedAt).localeCompare(String(left.savedAt)) || right.slot - left.slot);
}

export function saveWorkflowAutosave(packagePath, workflow, options = {}) {
  const packageRoot = path.resolve(String(packagePath || ""));
  const queueKey = process.platform === "win32" ? packageRoot.toLowerCase() : packageRoot;
  const previous = autosaveQueues.get(queueKey) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => writeWorkflowAutosave(packageRoot, workflow, options));
  autosaveQueues.set(queueKey, next);
  return next.finally(() => {
    if (autosaveQueues.get(queueKey) === next) autosaveQueues.delete(queueKey);
  });
}

async function writeWorkflowAutosave(packagePath, workflow, options = {}) {
  if (!workflow?.graph || !Array.isArray(workflow.graph.nodes) || !Array.isArray(workflow.graph.edges)) {
    throw new Error("That JSON document is not a NewtNode workflow.");
  }

  const limit = Math.max(1, Math.trunc(Number(options.limit) || workflowAutosaveLimit));
  const savedAt = autosaveTimestamp(options.now);
  const directoryPath = workflowAutosaveDirectory(packagePath);
  await mkdir(directoryPath, { recursive: true });

  const current = await listWorkflowAutosaves(packagePath, limit);
  const usedSlots = new Set(current.map((item) => item.slot));
  const availableSlot = Array.from({ length: limit }, (_, index) => index + 1).find((slot) => !usedSlots.has(slot));
  const slot = availableSlot || current.at(-1)?.slot || 1;
  const fileName = `autosave-${slot}.json`;
  const workflowFileName = safeWorkflowFileName(
    options.workflowFileName || workflow.package?.workflowFileName || workflow.fileName
  );
  const snapshot = {
    ...workflow,
    packagePath,
    package: {
      ...(workflow.package || {}),
      id: workflow.id || workflow.package?.id || "",
      name: workflow.name || workflow.package?.name || "Untitled node project",
      rootPath: packagePath,
      workflowFileName,
      assetBaseUrl: workflow.package?.assetBaseUrl || `/workflow-assets/${encodeURIComponent(workflow.id || "")}`
    },
    autosave: {
      version: 1,
      savedAt,
      slot,
      fileName,
      packagePath,
      workflowFileName
    }
  };

  const filePath = path.join(directoryPath, fileName);
  await writeJsonAtomic(filePath, snapshot);
  return {
    slot,
    fileName,
    filePath,
    savedAt,
    count: Math.min(limit, current.length + (availableSlot ? 1 : 0))
  };
}

function autosaveSlotFromFileName(fileName, limit) {
  const match = String(fileName || "").match(/^autosave-(\d+)\.json$/i);
  const slot = Number(match?.[1]);
  return Number.isInteger(slot) && slot >= 1 && slot <= limit ? slot : 0;
}

function autosaveTimestamp(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function safeWorkflowFileName(value) {
  const fileName = path.basename(String(value || ""));
  if (!fileName.toLowerCase().endsWith(".json")) return "workflow.json";
  return fileName.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 120) || "workflow.json";
}
