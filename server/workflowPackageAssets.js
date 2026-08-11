import path from "node:path";
import { readdir, stat } from "node:fs/promises";

const packageSearchDepth = 8;

export function registeredWorkflowPackageCandidates(workflows = [], workflowId = "") {
  const expectedId = String(workflowId || "");
  if (!expectedId) return [];

  const direct = [];
  const referenced = [];
  const seenPaths = new Set();

  for (const workflow of workflows) {
    const packagePath = workflowPackageRoot(workflow);
    if (!packagePath) continue;
    const resolvedPackagePath = path.resolve(packagePath);
    const packageKey = process.platform === "win32" ? resolvedPackagePath.toLowerCase() : resolvedPackagePath;
    if (seenPaths.has(packageKey)) continue;

    const isDirect = [workflow?.id, workflow?.package?.id].some((value) => String(value || "") === expectedId);
    const referencesId = !isDirect && valueReferencesWorkflowPackageId(workflow?.graph, expectedId);
    if (!isDirect && !referencesId) continue;

    seenPaths.add(packageKey);
    (isDirect ? direct : referenced).push(workflow);
  }

  return [...direct, ...referenced];
}

export function workflowSaveIdentity({ requestedId = "", existingWorkflow = null, packageParentPath = "", createId }) {
  const nextId = typeof createId === "function" ? createId : () => "";
  const normalizedRequestedId = String(requestedId || nextId()).trim();
  const isPackageClone = Boolean(packageParentPath && existingWorkflow);
  return {
    id: isPackageClone ? String(nextId()).trim() : normalizedRequestedId,
    existingWorkflow: isPackageClone ? null : existingWorkflow,
    isPackageClone
  };
}

export async function exactWorkflowPackageAssetFilePath(packagePath, relativePath) {
  const target = safePackageAssetTarget(packagePath, relativePath);
  return target && await isFile(target) ? target : "";
}

export async function relocatedWorkflowPackageAssetFilePath(packagePath, relativePath) {
  const packageRoot = normalizedPackageRoot(packagePath);
  const cleanPath = safePackageRelativePath(relativePath);
  if (!packageRoot || !cleanPath) return "";

  const requestedSegments = pathSegments(cleanPath);
  const fileName = requestedSegments.at(-1);
  if (!fileName) return "";

  const matches = [];
  await collectNamedFiles(packageRoot, fileName, packageRoot, packageSearchDepth, matches);
  if (!matches.length) return "";

  const ranked = matches
    .map((filePath) => ({ filePath, score: relocatedAssetScore(path.relative(packageRoot, filePath), cleanPath) }))
    .sort((left, right) => right.score - left.score || left.filePath.localeCompare(right.filePath));

  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return "";
  return ranked[0].filePath;
}

export async function uniqueWorkflowPackageAssetFilePath(workflows = [], relativePath = "") {
  const packagePaths = uniqueWorkflowPackageRoots(workflows);
  const exactMatches = await uniqueAssetMatches(packagePaths, relativePath, exactWorkflowPackageAssetFilePath);
  if (exactMatches.length) return exactMatches.length === 1 ? exactMatches[0] : "";

  const relocatedMatches = await uniqueAssetMatches(packagePaths, relativePath, relocatedWorkflowPackageAssetFilePath);
  return relocatedMatches.length === 1 ? relocatedMatches[0] : "";
}

export async function uniqueFileByNameUnderRoots(roots = [], fileName = "", depth = 6) {
  const expectedName = String(fileName || "").trim();
  if (!expectedName) return "";

  const rootPaths = uniqueSearchRoots(roots);
  const matches = [];
  const seenMatches = new Set();
  for (const rootPath of rootPaths) {
    const rootMatches = [];
    await collectNamedFiles(rootPath, expectedName, rootPath, depth, rootMatches);
    for (const filePath of rootMatches) {
      const resolvedPath = path.resolve(filePath);
      const key = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
      if (seenMatches.has(key)) continue;
      seenMatches.add(key);
      matches.push(resolvedPath);
      if (matches.length > 1) return "";
    }
  }

  return matches.length === 1 ? matches[0] : "";
}

function uniqueWorkflowPackageRoots(workflows) {
  const roots = [];
  const seenPaths = new Set();
  for (const workflow of workflows) {
    const packagePath = workflowPackageRoot(workflow);
    if (!packagePath) continue;
    const resolvedPath = path.resolve(packagePath);
    const key = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
    if (seenPaths.has(key)) continue;
    seenPaths.add(key);
    roots.push(resolvedPath);
  }
  return roots;
}

function uniqueSearchRoots(roots = []) {
  const normalized = [];
  const seenPaths = new Set();
  for (const root of roots) {
    const rootPath = normalizedPackageRoot(root);
    if (!rootPath) continue;
    const key = process.platform === "win32" ? rootPath.toLowerCase() : rootPath;
    if (seenPaths.has(key)) continue;
    seenPaths.add(key);
    normalized.push(rootPath);
  }
  return normalized;
}

async function uniqueAssetMatches(packagePaths, relativePath, resolver) {
  const matches = [];
  const seenPaths = new Set();
  for (const packagePath of packagePaths) {
    const filePath = await resolver(packagePath, relativePath);
    if (!filePath) continue;
    const resolvedPath = path.resolve(filePath);
    const key = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
    if (seenPaths.has(key)) continue;
    seenPaths.add(key);
    matches.push(resolvedPath);
  }
  return matches;
}

export function workflowPackageAssetCandidatesForExternalFilePath(filePath, packagePath) {
  const sourceSegments = originalPathSegments(filePath);
  const packageSegments = originalPathSegments(packagePath);
  const fileName = sourceSegments.at(-1);
  if (!sourceSegments.length || !fileName) return [];

  const candidates = [];
  const packageName = packageSegments.at(-1)?.toLowerCase();
  if (packageName) {
    for (let index = sourceSegments.length - 2; index >= 0; index -= 1) {
      if (sourceSegments[index].toLowerCase() !== packageName) continue;
      addCandidate(candidates, sourceSegments.slice(index + 1));
      break;
    }
  }

  const assetGroups = new Set(["inputs", "outputs", "dependencies", "thumbnails"]);
  for (let index = sourceSegments.length - 2; index >= 0; index -= 1) {
    if (!assetGroups.has(sourceSegments[index].toLowerCase())) continue;
    addCandidate(candidates, sourceSegments.slice(index));
    break;
  }

  ["outputs", "dependencies", "thumbnails", "inputs"].forEach((group) => {
    addCandidate(candidates, [group, fileName]);
  });
  return candidates;
}

function workflowPackageRoot(workflow) {
  return String(workflow?.packagePath || workflow?.package?.rootPath || "").trim();
}

function valueReferencesWorkflowPackageId(value, workflowId) {
  if (typeof value === "string") {
    const match = value.match(/^\/workflow-assets\/([^/]+)\//);
    if (!match) return false;
    try {
      return decodeURIComponent(match[1] || "") === workflowId;
    } catch {
      return false;
    }
  }
  if (Array.isArray(value)) return value.some((item) => valueReferencesWorkflowPackageId(item, workflowId));
  if (value && typeof value === "object") return Object.values(value).some((item) => valueReferencesWorkflowPackageId(item, workflowId));
  return false;
}

function safePackageAssetTarget(packagePath, relativePath) {
  const packageRoot = normalizedPackageRoot(packagePath);
  const cleanPath = safePackageRelativePath(relativePath);
  if (!packageRoot || !cleanPath) return "";
  const target = path.resolve(packageRoot, cleanPath);
  const relativeTarget = path.relative(packageRoot, target);
  if (!relativeTarget || relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) return "";
  return target;
}

function normalizedPackageRoot(value) {
  const raw = String(value || "").trim();
  return raw ? path.resolve(raw) : "";
}

function safePackageRelativePath(value) {
  const normalized = path.normalize(String(value || "").replace(/^[/\\]+/, ""));
  if (!normalized || normalized === "." || path.isAbsolute(normalized) || normalized.startsWith("..")) return "";
  return normalized;
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function collectNamedFiles(directoryPath, expectedName, packageRoot, depth, matches) {
  if (depth < 0) return;
  let entries = [];
  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  const expected = expectedName.toLowerCase();
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === expected) matches.push(entryPath);
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".newtnode") continue;
    const entryPath = path.join(directoryPath, entry.name);
    const relativeEntry = path.relative(packageRoot, entryPath);
    if (relativeEntry.startsWith("..") || path.isAbsolute(relativeEntry)) continue;
    await collectNamedFiles(entryPath, expectedName, packageRoot, depth - 1, matches);
  }
}

function relocatedAssetScore(candidatePath, requestedPath) {
  const candidate = pathSegments(candidatePath);
  const requested = pathSegments(requestedPath);
  let score = 0;

  if (candidate[0] === requested[0]) score += 1000;
  const requestedTail = requested.slice(1);
  if (requestedTail.length && endsWithSegments(candidate, requestedTail)) score += 500 + requestedTail.length;

  let commonSuffix = 0;
  while (
    commonSuffix < candidate.length &&
    commonSuffix < requested.length &&
    candidate[candidate.length - commonSuffix - 1] === requested[requested.length - commonSuffix - 1]
  ) {
    commonSuffix += 1;
  }
  score += commonSuffix * 20;
  score -= Math.abs(candidate.length - requested.length);
  return score;
}

function pathSegments(value) {
  return String(value || "")
    .split(/[\\/]+/)
    .map((segment) => segment.toLowerCase())
    .filter(Boolean);
}

function originalPathSegments(value) {
  return String(value || "")
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function addCandidate(candidates, segments) {
  const candidate = safePackageRelativePath(segments.join(path.sep));
  if (!candidate) return;
  const key = process.platform === "win32" ? candidate.toLowerCase() : candidate;
  if (!candidates.some((value) => (process.platform === "win32" ? value.toLowerCase() : value) === key)) {
    candidates.push(candidate);
  }
}

function endsWithSegments(value, suffix) {
  if (suffix.length > value.length) return false;
  return suffix.every((segment, index) => value[value.length - suffix.length + index] === segment);
}
