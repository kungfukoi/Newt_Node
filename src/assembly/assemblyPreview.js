export function assemblyOutputPortState(portId, renderedVideoUrl = "") {
  return {
    disabled: portId === "videoOut" && !renderedVideoUrl,
    disabledReason: portId === "videoOut" ? "Render the Timeline first" : ""
  };
}

export function selectAssemblyPreviewSource(previewSources = [], sourceNodeId = "", preferredSourcePort = "frameOut") {
  return previewSources.find((source) => source.sourceNodeId === sourceNodeId && source.sourcePort === preferredSourcePort)
    || previewSources.find((source) => source.sourceNodeId === sourceNodeId)
    || null;
}
