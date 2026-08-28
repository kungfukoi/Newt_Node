export const flowConnectOnClick = false;

export function flowPortConnectability(side, disabled = false) {
  return {
    isConnectable: !disabled,
    isConnectableStart: !disabled && side === "output",
    isConnectableEnd: !disabled && side === "input"
  };
}

export function shouldDisconnectInputPort(side, connected) {
  return side === "input" && connected;
}

export function appendInputConnection(edges = [], nextEdge) {
  const withoutDuplicate = edges.filter((edge) => !(
    edge.from.nodeId === nextEdge.from.nodeId
    && edge.from.port === nextEdge.from.port
    && edge.to.nodeId === nextEdge.to.nodeId
    && edge.to.port === nextEdge.to.port
  ));
  return [...withoutDuplicate, nextEdge];
}
