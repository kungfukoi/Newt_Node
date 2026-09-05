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

// Topology changes are uncommon; source data changes must still reach every viewer.
export function createFlowConnectionIndex() {
  let previousEdges;
  let ids = [];
  let connectionKeysByNode;
  let bootstrapPortsByNode;
  let incoming;
  let inputDependencyRefsByNode = new Map();
  return (nodes = [], edges = []) => {
    const topologyChanged = edges !== previousEdges || nodes.length !== ids.length || nodes.some((node, index) => node.id !== ids[index]);
    if (topologyChanged) {
      previousEdges = edges;
      ids = nodes.map((node) => node.id);
      connectionKeysByNode = buildNodeConnectionKeys(nodes, edges);
      bootstrapPortsByNode = new Map(ids.map((id) => [id, { source: new Set(), target: new Set() }]));
      incoming = new Map(ids.map((id) => [id, []]));
      for (const edge of edges) {
        bootstrapPortsByNode.get(edge.from?.nodeId)?.source.add(edge.from?.port);
        bootstrapPortsByNode.get(edge.to?.nodeId)?.target.add(edge.to?.port);
        if (bootstrapPortsByNode.has(edge.from?.nodeId)) incoming.get(edge.to?.nodeId)?.push({
          id: edge.from.nodeId, key: `${edge.to?.port || ""}:${edge.from.nodeId}:${edge.from?.port || ""}`
        });
      }
      for (const list of incoming.values()) list.sort((a, b) => a.key.localeCompare(b.key));
    }
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    let changed = inputDependencyRefsByNode.size !== nodes.length;
    const next = new Map(ids.map((id) => {
      const values = incoming.get(id).map((source) => nodeById.get(source.id)?.data);
      const previous = inputDependencyRefsByNode.get(id);
      if (previous && sameNodeInputDependencyRefs(previous, values)) return [id, previous];
      changed = true;
      return [id, values];
    }));
    if (changed) inputDependencyRefsByNode = next;
    return { connectionKeysByNode, bootstrapPortsByNode, inputDependencyRefsByNode };
  };
}
