const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;

export const keyerModelName = "CorridorKey 2.0";
export function isKeyerNode(node) {
  return node?.type === "keyer" || (node?.type === "utility" && node.data?.utilityMode === "video" && node.data?.utilityVideoModel === keyerModelName);
}
export function migrateKeyerNode(node) {
  if (!isKeyerNode(node)) return node;
  const title = node.type === "keyer" ? String(node.data?.title || "Utility").replace(/^Keyer(?=\s*\d*$)/, "Utility") : node.data?.title;
  return { ...node, type: "utility", data: normalizeKeyerData({ ...node.data, title: title || "Utility", utilityMode: "video", utilityVideoModel: keyerModelName }) };
}

// Preserve the source and primary-output wires when switching Utility models;
// remove auxiliary wires only when the new model has no corresponding port.
export function remapUtilityKeyerEdges(edges, nodeId, inputIds, outputIds, keying, modeChanged = false) {
  return edges.map(edge => {
    let { from, to } = edge;
    if (to.nodeId === nodeId) {
      const port = keying && to.port === "referenceVideoIn" ? "videoIn" : !keying && to.port === "videoIn" && inputIds.includes("referenceVideoIn") ? "referenceVideoIn" : to.port;
      if (port !== to.port) to = { ...to, port };
    }
    if (from.nodeId === nodeId) {
      const port = keying && from.port === "utilityOut" ? "cutoutOut" : !keying && from.port === "cutoutOut" && outputIds.includes("utilityOut") ? "utilityOut" : from.port;
      if (port !== from.port) from = { ...from, port };
    }
    return from === edge.from && to === edge.to ? edge : { ...edge, from, to };
  }).filter(edge => (edge.to.nodeId !== nodeId || inputIds.includes(edge.to.port)) && (edge.from.nodeId !== nodeId || !modeChanged && outputIds.includes(edge.from.port)));
}
export function normalizeKeyerData(data = {}) {
  return { ...data, nodeWidth: data.nodeWidth ?? 420, model: keyerModelName, resultType: "video",
    keyerMode: ["auto", "first", "video"].includes(data.keyerMode) ? data.keyerMode : "auto",
    keyerDespill: number(data.keyerDespill ?? 0.5, 0.5, 0, 1),
    keyerHintQuality: number(data.keyerHintQuality ?? 0.95, 0.95, 0, 1),
    keyerMemory: ["auto", "balanced", "low"].includes(data.keyerMemory) ? data.keyerMemory : "balanced",
    keyerFrameLimit: Math.round(number(data.keyerFrameLimit ?? 0, 0, 0, 1000000)),
    keyerView: ["source", "checker", "alpha", "fg", "cutout"].includes(data.keyerView) ? data.keyerView : "checker",
    keyerCarry: data.keyerCarry !== false,
    resultItems: Array.isArray(data.resultItems) ? data.resultItems : [],
    sourceVideoUrl: data.sourceVideoUrl || "", keyerVideoOpen: data.keyerVideoOpen !== false, settingsOpen: data.settingsOpen !== false };
}

export function keyerSettings(data = {}) {
  const d = normalizeKeyerData(data);
  return { mode: d.keyerMode, despill: d.keyerDespill, hintQuality: d.keyerHintQuality,
    memory: d.keyerMemory, frameLimit: d.keyerFrameLimit, carry: d.keyerCarry };
}

export function keyerResultForPort(node, port = "cutoutOut") {
  const d = node?.data || {};
  const items = d.resultItems || [];
  const item = items[d.selectedResultIndex] || items.at(-1);
  if (!item) return null;
  const pass = { cutoutOut: "cutout", matteOut: "alpha", foregroundOut: "fg" }[port];
  if (!pass) return null;
  return item.keyer?.passes?.[pass] || (pass === "cutout" ? item : null);
}

export function keyerInputError({ sourceVideoUrl, firstHintUrl, hintVideoUrl, settings }) {
  if (!sourceVideoUrl) return "Connect a source video to the input port.";
  if (settings.mode === "first" && !firstHintUrl) return "Connect a first-frame matte image or choose Automatic mode.";
  if (settings.mode === "video" && !hintVideoUrl) return "Connect a full matte video or choose Automatic mode.";
  return "";
}
