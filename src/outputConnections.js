export const outputAcceptedSourceKinds = Object.freeze([
  "prompt",
  "image",
  "camera",
  "style",
  "transfer",
  "character",
  "director",
  "video",
  "audio",
  "model3d"
]);

export function isOutputSinkConnection(targetType, targetPort, sourceKind) {
  return (
    targetType === "output"
    && targetPort === "sourceIn"
    && outputAcceptedSourceKinds.includes(sourceKind)
  );
}
