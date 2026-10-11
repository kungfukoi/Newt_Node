import React from "react";
import { NodeRow } from "./NodePorts.jsx";
import { compositeVideoBlendModeOptions, colorIdMatteVideoOutputOptions } from "../modelOptions.js";
import { normalizeCompositeLayers, compositeLayerPortId, compositeMaskPortId, compositeLayerLimit } from "../compositeLayers.js";

export function CompositeLayerControls({ node, incoming, onUpdate, onUndoSnapshot, onConnectStart, onDisconnectInput, connectedPortKeys, colors, mediaType, connectedSummary }) {
  const layers = normalizeCompositeLayers(node.data);
  const inputColor = (portId) => {
    const connection = incoming[portId]?.at(-1);
    const type = connection ? mediaType(connection.source, connection.edge) : "";
    return type === "image" ? colors.image : type === "video" ? colors.video : colors.preview;
  };
  const portProps = { node, onConnectStart, onDisconnectInput, connectedPortKeys };
  const save = (patch, restoreStructure = false) => { onUndoSnapshot?.({ nodeDataIds: [node.id], restoreStructure }); onUpdate(node.id, patch); };
  const update = (id, patch) => save({ compositeLayers: layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer) });
  return <div className="composite-layer-stack nodrag">
    <NodeRow label="Layers">
      <button className="composite-layer-action" type="button" title="Add layer" aria-label="Add composite layer" disabled={layers.length >= compositeLayerLimit} onClick={() => save({ compositeLayers: [...layers, { ...normalizeCompositeLayers()[1], id: `layer_${crypto.randomUUID()}` }] }, true)}>+</button>
    </NodeRow>
    <small className="utility-mini-note">Base first, then layers above it. Connect an image or video to each dot.</small>
    {layers.map((layer, index) => {
      const portId = compositeLayerPortId(layer);
      const maskId = compositeMaskPortId(layer);
      const maskConnected = Boolean(incoming[maskId]?.length);
      return <div className="composite-layer" key={layer.id}>
        <NodeRow label={index === 0 ? "Base" : `Layer ${index}`} inputPort={{ id: portId, label: `Layer ${index} image / video`, color: inputColor(portId) }} {...portProps}>
          <div className="composite-layer-asset"><span className={incoming[portId]?.length ? "connected-field" : "utility-mini-note"}>{connectedSummary(incoming[portId], "Image / video")}</span>
          <button className="composite-layer-action" type="button" aria-label={`Remove layer ${index}`} title="Remove layer" disabled={layers.length <= 2} onClick={() => save({ compositeLayers: layers.filter((item) => item.id !== layer.id) }, true)}>−</button></div>
        </NodeRow>
        <NodeRow label="Blend">
          <select aria-label={`Layer ${index} blend method`} value={layer.blendMode} onChange={(event) => update(layer.id, { blendMode: event.target.value })}>
            {compositeVideoBlendModeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </NodeRow>
        <NodeRow label="Mix"><div className="color-id-slider"><input aria-label={`Layer ${index} opacity`} type="range" min="0" max="100" value={layer.mixAmount} onChange={(event) => update(layer.id, { mixAmount: Number(event.target.value) })} /><span>{layer.mixAmount}%</span></div></NodeRow>
        <NodeRow label="Mask" inputPort={{ id: maskId, label: `Layer ${index} mask image / video`, color: inputColor(maskId) }} {...portProps}>
          <span className={maskConnected ? "connected-field" : "utility-mini-note"}>{connectedSummary(incoming[maskId], "Optional image / video")}</span>
        </NodeRow>
        {maskConnected && <>
          <NodeRow label="Invert Mask"><input aria-label={`Invert layer ${index} mask`} type="checkbox" checked={layer.invertMask} onChange={(event) => update(layer.id, { invertMask: event.target.checked })} /></NodeRow>
          <NodeRow label="Mask Blur"><input aria-label={`Layer ${index} mask blur`} type="number" min="0" max="24" step="0.5" value={layer.maskBlur} onChange={(event) => update(layer.id, { maskBlur: Number(event.target.value) })} /></NodeRow>
          <NodeRow label="Expand"><input aria-label={`Layer ${index} mask expansion`} type="number" min="-12" max="12" value={layer.maskExpand} onChange={(event) => update(layer.id, { maskExpand: Number(event.target.value) })} /></NodeRow>
        </>}
      </div>;
    })}
    <NodeRow label="Format"><select value={node.data.compositeOutputFormat || "mp4"} onChange={(event) => onUpdate(node.id, { compositeOutputFormat: event.target.value })}>{colorIdMatteVideoOutputOptions.map(([value, label]) => <option key={value} value={value}>{label.replace("mask", "video")}</option>)}</select></NodeRow>
    <NodeRow label="Still Duration"><input aria-label="Duration for image-only composite" type="number" min="0.1" max="600" step="0.1" value={node.data.compositeDuration || 5} onChange={(event) => onUpdate(node.id, { compositeDuration: event.target.value })} /></NodeRow>
    <small className="utility-mini-note">Video length follows the first video layer. Image-only stacks use Still Duration.</small>
  </div>;
}
