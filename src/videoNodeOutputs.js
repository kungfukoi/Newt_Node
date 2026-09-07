export const videoOutputPortId = "videoOut";
export const embeddedAudioOutputPortId = "audioOut";

export function videoNodeOutputPortDefinitions(portColors = {}) {
  return [
    { id: videoOutputPortId, label: "Video", color: portColors.video },
    { id: embeddedAudioOutputPortId, label: "Audio", color: portColors.audio }
  ];
}

export function videoNodeOutputKind(nodeOrType, portId) {
  const nodeType = typeof nodeOrType === "string" ? nodeOrType : nodeOrType?.type;
  if (!["video", "videoModel"].includes(nodeType)) return "";
  return portId === embeddedAudioOutputPortId ? "audio" : "video";
}

export function videoNodeOutputLabel(node, portId) {
  if (videoNodeOutputKind(node, portId) !== "audio") return "";
  return `${node?.data?.title || "Video"} audio`;
}
