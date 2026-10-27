import React from "react";
import { NodeRow } from "./NodePorts.jsx";
import { kling4DurationOptions, kling4ResolutionOptions } from "../kling4.js";

export function Kling4Controls({ node, provider, settingsOpen, incoming, framePorts, onUpdate, portProps, connectedSummary }) {
  const resolutions = kling4ResolutionOptions(provider);
  // Keep an unsupported saved ESR value visible when switching to Fal, so the
  // next run reports the mismatch instead of silently changing output quality.
  const displayedResolutions = [...new Set([node.data.resolution, ...resolutions])].filter(Boolean);
  return <>
    {framePorts.map(([label, port, placeholder]) => <NodeRow key={port.id} label={label} inputPort={settingsOpen ? port : null} node={node} {...portProps}>
      <button className={incoming[port.id]?.length ? "connected-field" : ""}>{connectedSummary(incoming[port.id], placeholder)}</button>
    </NodeRow>)}
    <NodeRow label="Duration">
      <select value={node.data.duration} onChange={event => onUpdate(node.id, { duration: event.target.value })}>
        {kling4DurationOptions.map(option => <option key={option}>{option}</option>)}
      </select>
    </NodeRow>
    <NodeRow label="Resolution">
      <select value={node.data.resolution} onChange={event => onUpdate(node.id, { resolution: event.target.value })}>
        {displayedResolutions.map(option => <option key={option} disabled={!resolutions.includes(option)}>{option}</option>)}
      </select>
    </NodeRow>
    <small className="upload-status model-status-note">Aspect ratio follows keyframes. Middle images follow connection order. ESR is enhanced output; available through Atlas Cloud.</small>
  </>;
}
