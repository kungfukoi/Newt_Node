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

export function buildNodeInputDependencyRefs(nodes = [], edges = []) {
  const nodeById = new Map((nodes || []).map((node) => [node.id, node]));
  const dependenciesByNode = new Map((nodes || []).map((node) => [node.id, []]));

  (edges || []).forEach((edge) => {
    const source = nodeById.get(edge.from?.nodeId);
    const targetDependencies = dependenciesByNode.get(edge.to?.nodeId);
    if (!source || !targetDependencies) return;
    targetDependencies.push({
      key: `${edge.to?.port || ""}:${source.id}:${edge.from?.port || ""}`,
      data: source.data
    });
  });

  return new Map(
    [...dependenciesByNode].map(([nodeId, dependencies]) => [
      nodeId,
      dependencies.sort((left, right) => left.key.localeCompare(right.key)).map((dependency) => dependency.data)
    ])
  );
}

export function sameNodeInputDependencyRefs(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
