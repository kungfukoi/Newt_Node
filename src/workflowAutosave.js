export const workflowAutosaveIntervalMs = 2 * 60 * 1000;

export function shouldAutosaveWorkflow({
  projectId = "",
  packagePath = "",
  currentFingerprint = "",
  cleanFingerprint = "",
  lastAutosavedFingerprint = ""
} = {}) {
  return Boolean(
    String(projectId).trim() &&
    String(packagePath).trim() &&
    currentFingerprint &&
    currentFingerprint !== cleanFingerprint &&
    currentFingerprint !== lastAutosavedFingerprint
  );
}
