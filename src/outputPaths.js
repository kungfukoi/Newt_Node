export function rebaseOutputPathToProjectOutputs(outputPath, projectOutputPath) {
  const sourcePath = String(outputPath || "").trim();
  const currentOutputsPath = String(projectOutputPath || "").trim();
  if (!sourcePath || !currentOutputsPath) return sourcePath;

  const sourceSegments = portablePathSegments(sourcePath);
  const currentSegments = portablePathSegments(currentOutputsPath);
  const outputsIndex = currentSegments.length - 1;
  if (outputsIndex < 1 || currentSegments[outputsIndex].toLowerCase() !== "outputs") return sourcePath;

  const packageName = currentSegments[outputsIndex - 1].toLowerCase();
  let sourceOutputsIndex = -1;
  for (let index = sourceSegments.length - 1; index >= 1; index -= 1) {
    if (sourceSegments[index].toLowerCase() !== "outputs") continue;
    if (sourceSegments[index - 1].toLowerCase() !== packageName) continue;
    sourceOutputsIndex = index;
    break;
  }
  if (sourceOutputsIndex < 0) return sourcePath;

  const suffix = sourceSegments.slice(sourceOutputsIndex + 1);
  const separator = preferredPathSeparator(currentOutputsPath);
  const rebasedPath = [currentOutputsPath.replace(/[\\/]+$/, ""), ...suffix].join(separator);
  return samePortablePath(sourcePath, rebasedPath) ? sourcePath : rebasedPath;
}

function portablePathSegments(value) {
  return String(value || "").split(/[\\/]+/).filter(Boolean);
}

function preferredPathSeparator(value) {
  const pathValue = String(value || "");
  return pathValue.includes("\\") && !pathValue.includes("/") ? "\\" : "/";
}

function samePortablePath(left, right) {
  const normalize = (value) => String(value || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return normalize(left) === normalize(right);
}
