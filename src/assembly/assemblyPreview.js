export function assemblyOutputPortState() {
  return {
    disabled: false,
    disabledReason: ""
  };
}

export function selectAssemblyPreviewSource(previewSources = [], sourceNodeId = "", preferredSourcePort = "frameOut") {
  return previewSources.find((source) => source.sourceNodeId === sourceNodeId && source.sourcePort === preferredSourcePort)
    || previewSources.find((source) => source.sourceNodeId === sourceNodeId)
    || null;
}
