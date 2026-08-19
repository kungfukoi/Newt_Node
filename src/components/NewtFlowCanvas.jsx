import React from "react";
import "./NewtFlowCanvas.css";
import {
  applyNodeChanges,
  getBezierPath,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  useUpdateNodeInternals,
  ViewportPortal
} from "@xyflow/react";
import {
  estimatedNodeHeight,
  estimatedNodeRect,
  estimatedNodeWidth,
  maximumResizableNodeHeight,
  minimumResizableNodeHeight,
  normalizedNodeHeight,
  normalizedNodeWidth
} from "../nodeGeometry.js";
import {
  flowOnlyRenderVisibleElements,
  flowOverviewEnabled,
  flowRenderMode
} from "../flowOverview.js";
import { FlowOverviewCanvas } from "./FlowOverviewCanvas.jsx";
import { NewtFlowPortProvider } from "./NewtFlowContext.jsx";

const NewtFlowRenderContext = React.createContext(null);
const flowMultiSelectionKeys = ["Shift", "Control", "Meta"];

export const NewtFlowCanvas = React.forwardRef(function NewtFlowCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <NewtFlowCanvasInner {...props} forwardedRef={ref} />
    </ReactFlowProvider>
  );
});

function NewtFlowCanvasInner({
  graphNodes,
  graphEdges,
  groups,
  viewport,
  selectedNodeIds,
  selectedEdgeId,
  activeEdgeIds,
  inactiveEdgeIds,
  renderNodeRef,
  renderGroupRef,
  onNodeDragStart,
  onNodePositionsCommit,
  onSelectionChange,
  onViewportChange,
  onViewportCommit,
  onConnect,
  isValidConnection,
  onConnectStart,
  onConnectEnd,
  onPaneContextMenu,
  onPaneClick,
  onDragOver,
  onDrop,
  forwardedRef
}) {
  const instance = useReactFlow();
  const draggingRef = React.useRef(false);
  const selectionCommitFrameRef = React.useRef(null);
  const lastViewportSyncRef = React.useRef(0);
  const navigationActiveRef = React.useRef(false);
  const overviewCanvasRef = React.useRef(null);
  const liveViewportRef = React.useRef(normalizeViewport(viewport));
  const lastWarmSyncRef = React.useRef(0);
  const warmTouchedRef = React.useRef(new Map());
  const initialRenderMode = flowRenderMode(graphNodes.length, viewport.scale, "detail");
  const [navigationActive, setNavigationActive] = React.useState(false);
  const renderModeRef = React.useRef(initialRenderMode);
  const [renderMode, setRenderMode] = React.useState(initialRenderMode);
  const warmNodeIdsRef = React.useRef(new Set(selectedNodeIds || []));
  const [warmNodeIds, setWarmNodeIds] = React.useState(warmNodeIdsRef.current);
  const selectedSet = React.useMemo(() => new Set(selectedNodeIds || []), [selectedNodeIds]);
  const overviewActive = renderMode !== "detail";
  const bootstrapPortsByNode = React.useMemo(
    () => buildBootstrapPorts(graphNodes, graphEdges),
    [graphEdges, graphNodes]
  );
  const desiredNodes = React.useMemo(
    () => graphNodes.map((node) => {
      const width = normalizedNodeWidth(node.data?.nodeWidth, node.type) || estimatedNodeWidth(node.type);
      const height = normalizedNodeHeight(
        node.data?.nodeHeight,
        minimumResizableNodeHeight(node.type),
        maximumResizableNodeHeight(node.type)
      ) || estimatedNodeHeight(node.type);
      const handles = bootstrapHandles(bootstrapPortsByNode.get(node.id), width, height);
      return {
        id: node.id,
        type: "newt",
        position: { x: Number(node.x) || 0, y: Number(node.y) || 0 },
        initialWidth: width,
        initialHeight: height,
        handles,
        data: { node, bootstrapHandles: handles, bootstrapSize: { width, height } },
        selected: selectedSet.has(node.id),
        zIndex: selectedSet.has(node.id) ? 20 : 2
      };
    }),
    [bootstrapPortsByNode, graphNodes, selectedSet]
  );
  const [flowNodes, setFlowNodes] = React.useState(desiredNodes);

  React.useLayoutEffect(() => {
    setFlowNodes((current) => mergeFlowNodes(current, desiredNodes, draggingRef.current));
  }, [desiredNodes]);

  function syncRenderMode(zoom) {
    const nextMode = flowRenderMode(graphNodes.length, zoom, renderModeRef.current);
    if (renderModeRef.current === nextMode) return nextMode;
    renderModeRef.current = nextMode;
    setRenderMode(nextMode);
    return nextMode;
  }

  function syncWarmNodeIds(nextViewport, { force = false } = {}) {
    if (!flowOverviewEnabled || renderModeRef.current !== "detail") return;
    const now = performance.now();
    if (!force && now - lastWarmSyncRef.current < 100) return;
    lastWarmSyncRef.current = now;
    const canvasRect = document.querySelector(".newt-react-flow")?.getBoundingClientRect();
    if (!canvasRect?.width || !canvasRect?.height) return;
    const nextWarm = bufferedWarmNodeIds({
      nodes: graphNodes,
      viewport: nextViewport,
      canvasRect,
      selectedNodeIds,
      previous: warmNodeIdsRef.current,
      touched: warmTouchedRef.current,
      now
    });
    if (sameIdSet(warmNodeIdsRef.current, nextWarm)) return;
    warmNodeIdsRef.current = nextWarm;
    setWarmNodeIds(nextWarm);
  }

  React.useEffect(() => {
    const normalized = normalizeViewport(viewport);
    liveViewportRef.current = normalized;
    syncRenderMode(normalized.zoom);
    overviewCanvasRef.current?.setViewport(normalized);
    syncWarmNodeIds(normalized, { force: true });
  }, [graphNodes.length, viewport.scale, viewport.x, viewport.y]);

  React.useEffect(() => {
    if (renderMode !== "detail") return;
    syncWarmNodeIds(liveViewportRef.current, { force: true });
  }, [graphNodes, renderMode, selectedNodeIds]);

  React.useEffect(() => {
    if (!flowOverviewEnabled || !selectedNodeIds?.length || renderModeRef.current !== "detail") return;
    const nextWarm = new Set(warmNodeIdsRef.current);
    let changed = false;
    selectedNodeIds.forEach((id) => {
      if (!nextWarm.has(id)) {
        nextWarm.add(id);
        changed = true;
      }
      warmTouchedRef.current.set(id, performance.now());
    });
    if (changed) {
      warmNodeIdsRef.current = nextWarm;
      setWarmNodeIds(nextWarm);
    }
  }, [renderMode, selectedNodeIds]);

  React.useImperativeHandle(forwardedRef, () => ({
    setViewport(nextViewport, options = {}) {
      const normalized = normalizeViewport(nextViewport);
      if (navigationActiveRef.current) {
        navigationActiveRef.current = false;
        if (flowOverviewEnabled) setNavigationActive(false);
      }
      liveViewportRef.current = normalized;
      syncRenderMode(normalized.zoom);
      overviewCanvasRef.current?.setViewport(normalized);
      syncWarmNodeIds(normalized, { force: true });
      lastViewportSyncRef.current = performance.now();
      return instance.setViewport(normalized, options);
    },
    setTransientViewport(nextViewport) {
      const normalized = normalizeViewport(nextViewport);
      if (!navigationActiveRef.current) {
        navigationActiveRef.current = true;
        if (flowOverviewEnabled) setNavigationActive(true);
      }
      liveViewportRef.current = normalized;
      syncRenderMode(normalized.zoom);
      overviewCanvasRef.current?.setViewport(normalized);
      const viewportElement = document.querySelector(".newt-react-flow .react-flow__viewport");
      if (viewportElement) {
        viewportElement.style.transform = `translate(${normalized.x}px, ${normalized.y}px) scale(${normalized.zoom})`;
      }
      const now = performance.now();
      if (now - lastViewportSyncRef.current >= 100) {
        lastViewportSyncRef.current = now;
        syncWarmNodeIds(normalized);
        return instance.setViewport(normalized, { duration: 0 });
      }
      return Promise.resolve();
    },
    screenToFlowPosition(point) {
      return instance.screenToFlowPosition(point);
    },
    getViewport() {
      const current = instance.getViewport();
      return { x: current.x, y: current.y, scale: current.zoom };
    },
    getNodes() {
      return instance.getNodes();
    }
  }), [graphNodes, instance, selectedNodeIds]);

  const flowEdges = React.useMemo(
    () => graphEdges.map((edge) => ({
      id: edge.id,
      source: edge.from.nodeId,
      sourceHandle: edge.from.port,
      target: edge.to.nodeId,
      targetHandle: edge.to.port,
      type: "newt",
      selected: selectedEdgeId === edge.id,
      data: {
        color: edge.color,
        active: activeEdgeIds?.has?.(edge.id),
        inactive: inactiveEdgeIds?.has?.(edge.id)
      },
      zIndex: selectedEdgeId === edge.id ? 1 : 0
    })),
    [activeEdgeIds, graphEdges, inactiveEdgeIds, selectedEdgeId]
  );

  function handleNodesChange(changes) {
    setFlowNodes((current) => applyNodeChanges(changes, current).map(dropMeasuredBootstrapHandles));
  }

  function handleNodeDragStart(event, node) {
    draggingRef.current = true;
    onNodeDragStart?.(event, node.id);
  }

  function handleNodeDragStop() {
    draggingRef.current = false;
    const movedNodes = instance.getNodes()
      .filter((node) => node.selected)
      .map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }));
    onNodePositionsCommit?.(movedNodes);
  }

  const commitFlowSelection = React.useCallback(() => {
    const selectedNodes = instance.getNodes().filter((node) => node.selected);
    const selectedEdges = instance.getEdges().filter((edge) => edge.selected);
    const nodeIds = [...new Set(selectedNodes.map((node) => node.id))];
    onSelectionChange?.({
      nodeIds,
      edgeId: nodeIds.length ? null : selectedEdges.at(-1)?.id || null
    });
  }, [instance, onSelectionChange]);

  const scheduleFlowSelectionCommit = React.useCallback(() => {
    if (selectionCommitFrameRef.current) window.cancelAnimationFrame(selectionCommitFrameRef.current);
    selectionCommitFrameRef.current = window.requestAnimationFrame(() => {
      selectionCommitFrameRef.current = null;
      commitFlowSelection();
    });
  }, [commitFlowSelection]);

  React.useEffect(() => () => {
    if (selectionCommitFrameRef.current) {
      window.cancelAnimationFrame(selectionCommitFrameRef.current);
      selectionCommitFrameRef.current = null;
    }
  }, []);

  function handleMove(_event, nextViewport) {
    const normalized = normalizeViewport(nextViewport);
    liveViewportRef.current = normalized;
    syncRenderMode(normalized.zoom);
    overviewCanvasRef.current?.setViewport(normalized);
    syncWarmNodeIds(normalized);
    onViewportChange?.({ x: nextViewport.x, y: nextViewport.y, scale: nextViewport.zoom });
  }

  function handleMoveEnd(_event, nextViewport) {
    const normalized = normalizeViewport(nextViewport);
    liveViewportRef.current = normalized;
    syncRenderMode(normalized.zoom);
    overviewCanvasRef.current?.setViewport(normalized);
    syncWarmNodeIds(normalized, { force: true });
    onViewportCommit?.({ x: nextViewport.x, y: nextViewport.y, scale: nextViewport.zoom });
  }

  function selectOverviewNode(nodeId) {
    onSelectionChange?.({ nodeIds: [nodeId], edgeId: null });
  }

  function selectOverviewNodes(nodeIds) {
    onSelectionChange?.({ nodeIds: [...new Set(nodeIds)], edgeId: null });
  }

  function selectOverviewEdge(edgeId) {
    onSelectionChange?.({ nodeIds: [], edgeId });
  }

  function focusOverviewNode(node) {
    const canvasRect = document.querySelector(".newt-react-flow")?.getBoundingClientRect();
    if (!canvasRect) return;
    const bounds = estimatedNodeRect(node);
    const zoom = 0.34;
    const nextViewport = {
      x: canvasRect.width / 2 - ((bounds.left + bounds.right) / 2) * zoom,
      y: canvasRect.height / 2 - ((bounds.top + bounds.bottom) / 2) * zoom,
      zoom
    };
    liveViewportRef.current = nextViewport;
    syncRenderMode(zoom);
    syncWarmNodeIds(nextViewport, { force: true });
    instance.setViewport(nextViewport, { duration: 220 }).then(() => {
      onViewportCommit?.({ x: nextViewport.x, y: nextViewport.y, scale: zoom });
    });
  }

  const renderContextValue = React.useMemo(
    () => ({ navigationActive, renderMode, renderNodeRef, warmNodeIds }),
    [navigationActive, renderMode, renderNodeRef, warmNodeIds]
  );
  return (
    <NewtFlowRenderContext.Provider value={renderContextValue}>
      <ReactFlow
        nodes={overviewActive ? [] : flowNodes}
        edges={overviewActive ? [] : flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: viewport.x, y: viewport.y, zoom: viewport.scale }}
        minZoom={0.05}
        maxZoom={2.5}
        onlyRenderVisibleElements={flowOnlyRenderVisibleElements}
        nodesConnectable
        nodesDraggable
        noDragClassName="nodrag"
        elementsSelectable
        selectNodesOnDrag={false}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={flowMultiSelectionKeys}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={null}
        autoPanOnNodeDrag={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={false}
        onNodesChange={handleNodesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={scheduleFlowSelectionCommit}
        onEdgeClick={scheduleFlowSelectionCommit}
        onSelectionEnd={scheduleFlowSelectionCommit}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        connectionLineComponent={NewtConnectionLine}
        connectionRadius={26}
        className="newt-react-flow"
        proOptions={{ hideAttribution: true }}
      >
        <ViewportPortal>
          <div className="newt-flow-group-layer">
            {!overviewActive && (groups || []).map((group) => (
              <React.Fragment key={group.id}>{renderGroupRef.current(group)}</React.Fragment>
            ))}
          </div>
        </ViewportPortal>
      </ReactFlow>
      <FlowOverviewCanvas
        ref={overviewCanvasRef}
        active={overviewActive}
        mode={renderMode}
        activeEdgeIds={activeEdgeIds}
        edges={graphEdges}
        groups={groups}
        inactiveEdgeIds={inactiveEdgeIds}
        nodes={graphNodes}
        selectedEdgeId={selectedEdgeId}
        selectedNodeIds={selectedNodeIds}
        viewport={liveViewportRef.current}
        onSelectEdge={selectOverviewEdge}
        onSelectNode={selectOverviewNode}
        onSelectNodes={selectOverviewNodes}
        onDoubleClickNode={focusOverviewNode}
      />
    </NewtFlowRenderContext.Provider>
  );
}

function normalizeViewport(viewport) {
  return {
    x: Number(viewport?.x) || 0,
    y: Number(viewport?.y) || 0,
    zoom: Number(viewport?.scale ?? viewport?.zoom) || 1
  };
}

function buildBootstrapPorts(nodes, edges) {
  const portsByNode = new Map((nodes || []).map((node) => [node.id, { source: new Set(), target: new Set() }]));
  (edges || []).forEach((edge) => {
    portsByNode.get(edge.from?.nodeId)?.source.add(edge.from?.port);
    portsByNode.get(edge.to?.nodeId)?.target.add(edge.to?.port);
  });
  return portsByNode;
}

function bootstrapHandles(ports, width, height) {
  const sourceIds = [...(ports?.source || [])].filter(Boolean);
  const targetIds = [...(ports?.target || [])].filter(Boolean);
  if (!sourceIds.length && !targetIds.length) sourceIds.push("__newt_bootstrap__");
  return [
    ...bootstrapHandlesForSide(sourceIds, "source", Position.Right, width, height),
    ...bootstrapHandlesForSide(targetIds, "target", Position.Left, width, height)
  ];
}

function bootstrapHandlesForSide(ids, type, position, width, height) {
  const usableHeight = Math.max(40, height - 96);
  return ids.map((id, index) => ({
    id,
    type,
    position,
    x: position === Position.Left ? -9 : width - 9,
    y: 39 + (usableHeight * (index + 1)) / (ids.length + 1),
    width: 18,
    height: 18
  }));
}

function dropMeasuredBootstrapHandles(node) {
  if (!node.handles || !Number.isFinite(node.measured?.width) || !Number.isFinite(node.measured?.height)) return node;
  return { ...node, handles: undefined };
}

function mergeFlowNodes(current, desired, dragging) {
  const currentById = new Map(current.map((node) => [node.id, node]));
  let changed = current.length !== desired.length;
  const next = desired.map((node) => {
    const previous = currentById.get(node.id);
    if (!previous) {
      changed = true;
      return node;
    }
    const keepLocalPosition = dragging && previous.selected;
    const position = keepLocalPosition ? previous.position : node.position;
    const data = previous.data?.node === node.data.node ? previous.data : node.data;
    const selected = node.selected;
    const zIndex = selected ? 20 : 2;
    if (
      previous.type === node.type &&
      previous.dragHandle === node.dragHandle &&
      previous.position.x === position.x &&
      previous.position.y === position.y &&
      previous.zIndex === zIndex &&
      previous.data === data
    ) {
      return previous;
    }
    changed = true;
    return {
      ...previous,
      ...node,
      position,
      selected,
      zIndex,
      measured: previous.measured,
      width: previous.width,
      height: previous.height,
      handles: Number.isFinite(previous.measured?.width) && Number.isFinite(previous.measured?.height)
        ? undefined
        : node.handles,
      data
    };
  });
  return changed ? next : current;
}

const NewtFlowNode = React.memo(function NewtFlowNode({ id, data, selected }) {
  const { navigationActive, renderMode, renderNodeRef, warmNodeIds } = React.useContext(NewtFlowRenderContext);
  const updateNodeInternals = useUpdateNodeInternals();
  const shouldRenderFull = !flowOverviewEnabled || (renderMode === "detail" && warmNodeIds.has(id));
  const [hydrated, setHydrated] = React.useState(() => shouldRenderFull && !navigationActive);

  React.useEffect(() => {
    if (!shouldRenderFull) setHydrated(false);
    else if (!navigationActive) setHydrated(true);
  }, [navigationActive, shouldRenderFull]);

  React.useLayoutEffect(() => {
    if (shouldRenderFull && (hydrated || !flowOverviewEnabled)) updateNodeInternals(id);
  }, [data.node.data, hydrated, id, shouldRenderFull, updateNodeInternals]);

  const showPlaceholder = flowOverviewEnabled && (!shouldRenderFull || !hydrated);

  return (
    <NewtFlowPortProvider>
      {showPlaceholder
        ? <NavigationNodePlaceholder node={data.node} handles={data.bootstrapHandles} size={data.bootstrapSize} />
        : renderNodeRef.current(data.node, selected)}
    </NewtFlowPortProvider>
  );
});

function NavigationNodePlaceholder({ node, handles, size }) {
  return (
    <div
      aria-hidden="true"
      style={{
        boxSizing: "border-box",
        width: size?.width || estimatedNodeWidth(node.type),
        height: size?.height || estimatedNodeHeight(node.type),
        overflow: "hidden",
        border: "1px solid rgba(221, 198, 49, 0.42)",
        borderRadius: 8,
        background: "#202020",
        color: "#b9b9b9",
        padding: "14px 18px",
        fontSize: 13,
        fontWeight: 600
      }}
    >
      <div
        style={{
          height: "auto",
          overflow: "hidden",
          color: "inherit"
        }}
      >
        {node.name || node.type}
      </div>
      {(handles || []).map((handle) => (
        <Handle
          key={`${handle.type}:${handle.id}`}
          id={handle.id}
          type={handle.type}
          position={handle.position}
          isConnectable={false}
          style={{ top: handle.y + handle.height / 2, width: handle.width, height: handle.height, opacity: 0, pointerEvents: "none" }}
        />
      ))}
    </div>
  );
}

function bufferedWarmNodeIds({ nodes, viewport, canvasRect, selectedNodeIds, previous, touched, now }) {
  const normalized = normalizeViewport(viewport);
  const visibleWidth = canvasRect.width / normalized.zoom;
  const visibleHeight = canvasRect.height / normalized.zoom;
  const bufferScreens = Math.min(1.5, Math.max(0.75, 0.75 + (normalized.zoom - 0.3) * 2));
  const bufferX = visibleWidth * bufferScreens;
  const bufferY = visibleHeight * bufferScreens;
  const visible = {
    left: -normalized.x / normalized.zoom - bufferX,
    top: -normalized.y / normalized.zoom - bufferY,
    right: (canvasRect.width - normalized.x) / normalized.zoom + bufferX,
    bottom: (canvasRect.height - normalized.y) / normalized.zoom + bufferY
  };
  const next = new Set(selectedNodeIds || []);
  (nodes || []).forEach((node) => {
    if (!rectsOverlapInclusive(estimatedNodeRect(node), visible)) return;
    next.add(node.id);
    touched.set(node.id, now);
  });

  const selected = new Set(selectedNodeIds || []);
  const recent = [...(previous || [])]
    .filter((id) => !next.has(id) && !selected.has(id))
    .map((id) => ({ id, time: touched.get(id) || 0 }))
    .filter((entry) => now - entry.time < 12_000)
    .sort((first, second) => second.time - first.time);
  const retentionLimit = next.size + 32;
  for (const entry of recent) {
    if (next.size >= retentionLimit) break;
    next.add(entry.id);
  }

  for (const id of [...touched.keys()]) {
    if (!next.has(id) && now - (touched.get(id) || 0) >= 12_000) touched.delete(id);
  }
  return next;
}

function rectsOverlapInclusive(first, second) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

function sameIdSet(first, second) {
  if (first === second) return true;
  if (!first || !second || first.size !== second.size) return false;
  for (const id of first) {
    if (!second.has(id)) return false;
  }
  return true;
}

const nodeTypes = { newt: NewtFlowNode };
const edgeTypes = { newt: NewtFlowEdge };

function NewtFlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data }) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const classes = [
    "newt-flow-edge",
    selected ? "selected" : "",
    data?.active ? "active" : "",
    data?.inactive ? "inactive" : ""
  ].filter(Boolean).join(" ");

  return (
    <g className={classes} data-edge-id={id}>
      <path className="newt-flow-edge-visible" d={path} stroke={data?.inactive ? "#7a7a7a" : data?.color || "#ddc631"} />
      <path className="newt-flow-edge-hitbox" d={path} />
    </g>
  );
}

function NewtConnectionLine({ fromX, fromY, toX, toY, fromPosition = Position.Right, toPosition = Position.Left }) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
    sourcePosition: fromPosition,
    targetPosition: toPosition
  });
  return <path className="newt-flow-connection-line" d={path} />;
}

export function FlowPortHandle({ id, side, disabled, className, style, title, onPointerDown, dataAttributes = {} }) {
  return (
    <Handle
      id={id}
      type={side === "output" ? "source" : "target"}
      position={side === "output" ? Position.Right : Position.Left}
      isConnectable={!disabled}
      className={className}
      style={style}
      title={title}
      aria-disabled={disabled || undefined}
      onPointerDown={onPointerDown}
      {...dataAttributes}
    />
  );
}
