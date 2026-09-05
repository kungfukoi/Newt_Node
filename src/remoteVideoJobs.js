export const remoteVideoWarningMs = 20 * 60 * 1000;

export function supportsDurableVideo(model) {
  return /^seedance\s*2\.(0|5)$/i.test(String(model || "").trim());
}

export function remoteVideoScope(context = {}) {
  // Package identity separates Save As copies even when node IDs are retained.
  const packagePath = String(context.workflowPackagePath || "").replace(/\\/g, "/").replace(/\/$/, "");
  return JSON.stringify([
    String(context.projectId || ""),
    String(context.workflowPackageId || ""),
    /^[a-z]:\//i.test(packagePath) ? packagePath.toLowerCase() : packagePath
  ]);
}

export function remoteVideoTerminal(job) {
  return job?.state === "completed" || job?.state === "failed" || job?.state === "dismissed";
}

export function remoteVideoNeedsAttention(job) {
  return job?.state === "uncertain";
}

export function appendUniqueVideoResults(previous = [], incoming = []) {
  const result = [...previous];
  for (const item of incoming) {
    if (!item?.url || result.some((entry) => entry.url === item.url || (item.generationRunId && entry.generationRunId === item.generationRunId))) continue;
    result.push(item);
  }
  return result;
}
