export function buildNodeConnectionKeys(nodes = [], edges = []) {
  const connectionsByNode = new Map((nodes || []).map((node) => [node.id, []]));

  (edges || []).forEach((edge) => {
    const sourceId = edge.from?.nodeId;
    const sourcePort = edge.from?.port;
    const targetId = edge.to?.nodeId;
    const targetPort = edge.to?.port;
    if (!sourceId || !sourcePort || !targetId || !targetPort) return;

    connectionsByNode.get(sourceId)?.push(`out:${sourcePort}:${targetId}:${targetPort}`);
    connectionsByNode.get(targetId)?.push(`in:${targetPort}:${sourceId}:${sourcePort}`);
  });

  return new Map(
    [...connectionsByNode].map(([nodeId, connections]) => [nodeId, connections.sort().join("|")])
  );
}
