import { compositeVideoBlendModeOptions } from "./modelOptions.js";

export const compositeLayerLimit = 32;
export function normalizeCompositeLayers(data = {}) {
  const raw = Array.isArray(data.compositeLayers) && data.compositeLayers.length ? data.compositeLayers : [{ id: "base" }, { id: "layer1", blendMode: data.compositeBlendMode, mixAmount: data.compositeMixAmount, invertMask: data.compositeInvertMask, maskBlur: data.compositeMaskBlur, maskExpand: data.compositeMaskExpand }];
  const used = new Set();
  return raw.slice(0, compositeLayerLimit).map((layer, index) => {
    let id = String(layer?.id || `layer${index}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || `layer${index}`;
    while (used.has(id)) id += "_";
    used.add(id);
    const bound = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
    return { id, blendMode: compositeVideoBlendModeOptions.some(([value]) => value === layer?.blendMode) ? layer.blendMode : "normal", mixAmount: bound(layer?.mixAmount, 0, 100, 100), invertMask: Boolean(layer?.invertMask), maskBlur: bound(layer?.maskBlur, 0, 24, 0), maskExpand: Math.round(bound(layer?.maskExpand, -12, 12, 0)) };
  });
}
export function compositeLayerPortId(layer) { return layer.id === "base" ? "referenceVideoIn" : `compositeLayer:${layer.id}`; }
export function compositeMaskPortId(layer) { return layer.id === "layer1" ? "maskVideoIn" : `compositeMask:${layer.id}`; }
export function compositeInputPorts(data, color) {
  return normalizeCompositeLayers(data).flatMap((layer, index) => [
    { id: compositeLayerPortId(layer), label: index === 0 ? "Base" : `Layer ${index}`, color },
    { id: compositeMaskPortId(layer), label: index === 0 ? "Base mask" : `Layer ${index} mask`, color }
  ]);
}
export function isCompositeLayerPort(data, portId) { return compositeInputPorts(data).some((port) => port.id === portId); }

export function migrateCompositeEdges(nodes, edges, isComposite) {
  const targets = new Map(nodes.filter(isComposite).map((node) => [node.id, node]));
  const counts = new Map();
  return edges.map((edge) => {
    const node = targets.get(edge.to.nodeId);
    if (!node || edge.to.port !== "referenceVideoIn") return edge;
    const index = counts.get(node.id) || 0;
    counts.set(node.id, index + 1);
    if (index === 0) return edge;
    const layers = normalizeCompositeLayers(node.data);
    while (layers.length <= index && layers.length < compositeLayerLimit) layers.push({ ...normalizeCompositeLayers()[1], id: `legacy${layers.length}` });
    node.data.compositeLayers = layers;
    return { ...edge, to: { ...edge.to, port: compositeLayerPortId(layers[Math.min(index, layers.length - 1)]) } };
  });
}
