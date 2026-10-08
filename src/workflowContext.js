export function workflowContextPayload(workflowContext = {}, projectId = "", projectName = "") {
  return {
    projectId: workflowContext.projectId || projectId || "",
    projectName: workflowContext.projectName || projectName || "Untitled node project",
    workflowName: workflowContext.workflowName || workflowContext.projectName || projectName || "Untitled node project",
    workflowFileName: String(workflowContext.workflowFileName || "").split(/[\\/]/).at(-1),
    workflowPackageId: workflowContext.workflowPackageId || "",
    workflowPackagePath: workflowContext.workflowPackagePath || "",
    outputTargetPath: workflowContext.outputTargetPath || "",
    outputTargetFileName: workflowContext.outputTargetFileName || "",
    outputTargetNodeId: workflowContext.outputTargetNodeId || "",
    outputTargetNodeTitle: workflowContext.outputTargetNodeTitle || "",
    outputTargetSourceNodeId: workflowContext.outputTargetSourceNodeId || "",
    outputTargetSourceNodeTitle: workflowContext.outputTargetSourceNodeTitle || "",
    outputTargetSourceFileName: workflowContext.outputTargetSourceFileName || "",
    outputTargetIndex: workflowContext.outputTargetIndex || ""
  };
}

export function appendWorkflowContextFormFields(form, workflowContext = {}, projectId = "", projectName = "") {
  Object.entries(workflowContextPayload(workflowContext, projectId, projectName)).forEach(([key, value]) => {
    form.append(key, value || "");
  });
}
