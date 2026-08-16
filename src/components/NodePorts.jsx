import React from "react";
import { FlowPortHandle } from "./NewtFlowCanvas.jsx";
import { NewtFlowPortContext } from "./NewtFlowContext.jsx";

export function PortHandle({ node, port, side, onConnectStart, onDisconnectInput, connectedPortKeys }) {
  const flowManaged = React.useContext(NewtFlowPortContext);
  const connected = connectedPortKeys.has(`${node.id}:${port.id}`);
  const disabled = Boolean(port.disabled);
  const className = `inline-port ${side} ${connected ? "connected" : ""} ${disabled ? "disabled" : ""}`;
  const title = disabled ? port.disabledReason || `${port.label} is not supported` : side === "input" ? `Disconnect ${port.label}` : `Connect ${port.label}`;
  const dataAttributes = {
    "data-port-role": side,
    "data-node-id": node.id,
    "data-port-id": port.id,
    "data-port-key": `${node.id}:${port.id}`
  };
  const handlePointerDown = (event) => {
    if (disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (flowManaged) {
      if (side === "input" && connected) onDisconnectInput(event, node.id, port.id);
      return;
    }
    if (side === "output") {
      onConnectStart(event, node.id, port.id, port.color);
      return;
    }
    onDisconnectInput(event, node.id, port.id);
  };

  if (flowManaged) {
    return (
      <FlowPortHandle
        id={port.id}
        side={side}
        disabled={disabled}
        className={className}
        style={{ "--port-color": port.color }}
        title={title}
        onPointerDown={handlePointerDown}
        dataAttributes={dataAttributes}
      />
    );
  }

  return (
    <button
      className={className}
      {...dataAttributes}
      style={{ "--port-color": port.color }}
      onPointerDown={handlePointerDown}
      disabled={disabled}
      title={title}
    />
  );
}

export function OutputPortRow({ node, port, onConnectStart, onDisconnectInput, connectedPortKeys, label = port.label, align = "" }) {
  return (
    <div className={`port-row output-row ${align === "right" ? "align-right" : ""}`}>
      {label ? <span>{label}</span> : <span aria-hidden="true" />}
      <PortHandle
        node={node}
        port={port}
        side="output"
        onConnectStart={onConnectStart}
        onDisconnectInput={onDisconnectInput}
        connectedPortKeys={connectedPortKeys}
      />
    </div>
  );
}

export function NodeRow({ label, children, inputPort, node, onConnectStart, onDisconnectInput, connectedPortKeys }) {
  return (
    <div className={`node-row ${inputPort ? "has-port" : ""} ${inputPort?.disabled ? "disabled" : ""}`}>
      <span className="node-row-label">
        {inputPort && (
          <PortHandle
            node={node}
            port={inputPort}
            side="input"
            onConnectStart={onConnectStart}
            onDisconnectInput={onDisconnectInput}
            connectedPortKeys={connectedPortKeys}
          />
        )}
        <span>{label}</span>
      </span>
      {children}
    </div>
  );
}
