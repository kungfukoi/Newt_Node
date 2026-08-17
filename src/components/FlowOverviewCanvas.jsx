import React from "react";
import { estimatedNodeRect } from "../nodeGeometry.js";

const statusColors = {
  error: "#f45b69",
  running: "#f0d629",
  success: "#48d27c"
};
const typeColors = ["#3f8cff", "#26c6da", "#9b6cff", "#e95cae", "#f39b45", "#55c878", "#d7bd38"];

export const FlowOverviewCanvas = React.forwardRef(function FlowOverviewCanvas({
  active,
  activeEdgeIds,
  edges,
  groups,
  mode,
  inactiveEdgeIds,
  nodes,
  onDoubleClickNode,
  onSelectEdge,
  onSelectNode,
  onSelectNodes,
  selectedEdgeId,
  selectedNodeIds,
  viewport
}, forwardedRef) {
  const canvasRef = React.useRef(null);
  const propsRef = React.useRef(null);
  const viewportRef = React.useRef(viewport);
  const frameRef = React.useRef(null);
  const hoveredNodeIdRef = React.useRef(null);
  const pointerStartRef = React.useRef(null);
  const marqueeRef = React.useRef(null);

  propsRef.current = { active, activeEdgeIds, edges, groups, inactiveEdgeIds, mode, nodes, selectedEdgeId, selectedNodeIds };
  viewportRef.current = viewport;

  const scheduleDraw = React.useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame((time) => {
      frameRef.current = null;
      const hoveredEdgeId = canvasRef.current?.dataset.hoveredEdge || null;
      drawFlowOverview(canvasRef.current, propsRef.current, viewportRef.current, hoveredNodeIdRef.current, hoveredEdgeId, marqueeRef.current, time);
      if (propsRef.current?.active && propsRef.current?.activeEdgeIds?.size) scheduleDraw();
    });
  }, []);

  React.useImperativeHandle(forwardedRef, () => ({
    setViewport(nextViewport) {
      viewportRef.current = normalizeOverviewViewport(nextViewport);
      scheduleDraw();
    },
    redraw() {
      scheduleDraw();
    }
  }), [scheduleDraw]);

  React.useLayoutEffect(() => {
    scheduleDraw();
  }, [active, activeEdgeIds, edges, groups, inactiveEdgeIds, mode, nodes, scheduleDraw, selectedEdgeId, selectedNodeIds, viewport]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [scheduleDraw]);

  React.useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
  }, []);

  function nodeAtPointer(event) {
    return overviewHitAtPoint(nodes, edges, viewportRef.current, event.clientX, event.clientY, canvasRef.current);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      canvasRef.current?.setPointerCapture?.(event.pointerId);
      if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
      const point = { x: event.clientX, y: event.clientY };
      marqueeRef.current = {
        pointerId: event.pointerId,
        start: point,
        current: point,
        baseSelection: [...(selectedNodeIds || [])]
      };
      pointerStartRef.current = null;
      scheduleDraw();
      return;
    }
    pointerStartRef.current = { x: event.clientX, y: event.clientY, hit: nodeAtPointer(event) };
  }

  function handlePointerMove(event) {
    const marquee = marqueeRef.current;
    if (marquee?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      marquee.current = { x: event.clientX, y: event.clientY };
      if (pointerDistance(marquee.start, marquee.current) > 4) {
        onSelectNodes?.(additiveOverviewSelection(
          marquee.baseSelection,
          overviewNodesInScreenRect(nodes, viewportRef.current, marquee.start, marquee.current, canvasRef.current)
        ));
      }
      scheduleDraw();
      return;
    }
    const hit = nodeAtPointer(event);
    const hoveredNodeId = hit?.kind === "node" ? hit.id : null;
    if (hoveredNodeIdRef.current !== hoveredNodeId || canvasRef.current?.dataset.hoveredEdge !== (hit?.kind === "edge" ? hit.id : "")) {
      hoveredNodeIdRef.current = hoveredNodeId;
      if (canvasRef.current) canvasRef.current.dataset.hoveredEdge = hit?.kind === "edge" ? hit.id : "";
      if (canvasRef.current) canvasRef.current.style.cursor = hit ? "pointer" : "grab";
      scheduleDraw();
    }
  }

  function handlePointerUp(event) {
    const marquee = marqueeRef.current;
    if (marquee?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      marquee.current = { x: event.clientX, y: event.clientY };
      const moved = pointerDistance(marquee.start, marquee.current) > 4;
      if (moved) {
        onSelectNodes?.(additiveOverviewSelection(
          marquee.baseSelection,
          overviewNodesInScreenRect(nodes, viewportRef.current, marquee.start, marquee.current, canvasRef.current)
        ));
      } else {
        const hit = nodeAtPointer(event);
        onSelectNodes?.(hit?.kind === "node"
          ? toggledOverviewSelection(marquee.baseSelection, hit.id)
          : marquee.baseSelection);
      }
      canvasRef.current?.releasePointerCapture?.(event.pointerId);
      if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      marqueeRef.current = null;
      scheduleDraw();
      return;
    }
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start?.hit || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const hit = nodeAtPointer(event);
    if (!hit || hit.kind !== start.hit.kind || hit.id !== start.hit.id) return;
    if (hit.kind === "node") onSelectNode?.(hit.id);
    else onSelectEdge?.(hit.id);
  }

  function handleDoubleClick(event) {
    const hit = nodeAtPointer(event);
    if (hit?.kind === "node") onDoubleClickNode?.(hit.node);
  }

  function handlePointerCancel(event) {
    if (marqueeRef.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    marqueeRef.current = null;
    scheduleDraw();
  }

  return (
    <canvas
      ref={canvasRef}
      className="flow-overview-canvas"
      data-flow-overview="true"
      aria-label="Workflow overview"
      style={{
        display: active ? "block" : "none",
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 8,
        cursor: "grab"
      }}
      onDoubleClick={handleDoubleClick}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onLostPointerCapture={handlePointerCancel}
      onPointerLeave={() => {
        hoveredNodeIdRef.current = null;
        scheduleDraw();
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
});

function drawFlowOverview(canvas, props, viewport, hoveredNodeId, hoveredEdgeId, marquee, time) {
  if (!canvas || !props?.active) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const normalizedViewport = normalizeOverviewViewport(viewport);
  const selectedSet = new Set(props.selectedNodeIds || []);
  const selectedConnections = new Set();
  (props.edges || []).forEach((edge) => {
    if (selectedSet.has(edge.from?.nodeId) || selectedSet.has(edge.to?.nodeId)) selectedConnections.add(edge.id);
  });

  drawGroups(context, props.groups, normalizedViewport);
  drawEdges(context, props.edges, props.nodes, normalizedViewport, props.activeEdgeIds, props.inactiveEdgeIds, selectedConnections, props.selectedEdgeId, hoveredEdgeId, time);
  drawNodes(context, props.nodes, normalizedViewport, selectedSet, hoveredNodeId, props.mode);
  drawOverviewMarquee(context, marquee, rect);
}

function drawOverviewMarquee(context, marquee, canvasRect) {
  if (!marquee) return;
  const bounds = normalizedPointerRect(marquee.start, marquee.current);
  const left = bounds.left - canvasRect.left;
  const top = bounds.top - canvasRect.top;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  context.fillStyle = "rgba(240, 214, 41, 0.10)";
  context.strokeStyle = "rgba(240, 214, 41, 0.9)";
  context.lineWidth = 1;
  context.fillRect(left, top, width, height);
  context.strokeRect(left + 0.5, top + 0.5, width, height);
}

function drawGroups(context, groups, viewport) {
  (groups || []).forEach((group) => {
    const left = sceneToScreenX(group.x, viewport);
    const top = sceneToScreenY(group.y, viewport);
    const width = Math.max(1, (Number(group.width) || 0) * viewport.zoom);
    const height = Math.max(1, (Number(group.height) || 0) * viewport.zoom);
    context.fillStyle = overviewColorWithAlpha(group.color, 0.09, "rgba(240, 214, 41, 0.05)");
    context.strokeStyle = group.color || "rgba(240, 214, 41, 0.28)";
    context.lineWidth = 1;
    context.fillRect(left, top, width, height);
    context.strokeRect(left + 0.5, top + 0.5, width, height);
    if (width > 80 && group.name) {
      context.font = "600 11px system-ui, sans-serif";
      context.fillStyle = group.color || "#d5c34b";
      context.fillText(group.name, left + 6, top + 14, Math.max(20, width - 12));
    }
  });
}

function drawEdges(context, edges, nodes, viewport, activeEdgeIds, inactiveEdgeIds, selectedConnections, selectedEdgeId, hoveredEdgeId, time) {
  const nodeById = new Map((nodes || []).map((node) => [node.id, node]));
  (edges || []).forEach((edge) => {
    const source = nodeById.get(edge.from?.nodeId);
    const target = nodeById.get(edge.to?.nodeId);
    if (!source || !target) return;
    const sourceRect = estimatedNodeRect(source);
    const targetRect = estimatedNodeRect(target);
    const sourceX = sceneToScreenX(sourceRect.right, viewport);
    const sourceY = sceneToScreenY((sourceRect.top + sourceRect.bottom) / 2, viewport);
    const targetX = sceneToScreenX(targetRect.left, viewport);
    const targetY = sceneToScreenY((targetRect.top + targetRect.bottom) / 2, viewport);
    const selected = selectedConnections.has(edge.id) || selectedEdgeId === edge.id || hoveredEdgeId === edge.id;
    const active = activeEdgeIds?.has?.(edge.id);
    const inactive = inactiveEdgeIds?.has?.(edge.id);
    context.beginPath();
    context.moveTo(sourceX, sourceY);
    const curve = Math.max(22, Math.abs(targetX - sourceX) * 0.42);
    context.bezierCurveTo(sourceX + curve, sourceY, targetX - curve, targetY, targetX, targetY);
    context.strokeStyle = edge.color || "#6285cf";
    context.globalAlpha = selected || active ? 0.95 : inactive ? 0.18 : 0.42;
    context.lineWidth = selected || active ? 3 : 1.5;
    if (active) {
      context.setLineDash([8, 6]);
      context.lineDashOffset = -((time || 0) / 45) % 14;
    }
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
  });
}

function drawNodes(context, nodes, viewport, selectedSet, hoveredNodeId, mode) {
  (nodes || []).forEach((node) => {
    const bounds = estimatedNodeRect(node);
    const left = sceneToScreenX(bounds.left, viewport);
    const top = sceneToScreenY(bounds.top, viewport);
    const width = Math.max(3, (bounds.right - bounds.left) * viewport.zoom);
    const height = Math.max(3, (bounds.bottom - bounds.top) * viewport.zoom);
    const selected = selectedSet.has(node.id);
    const hovered = hoveredNodeId === node.id;
    const color = overviewTypeColor(node.type);
    const statusColor = node.data?.error ? statusColors.error : isProcessingStatus(node.data?.status) ? statusColors.running : color;

    context.fillStyle = selected ? "#3a351d" : "#242424";
    context.strokeStyle = selected || hovered ? "#f0d629" : color;
    context.lineWidth = selected || hovered ? 2 : 1;
    context.fillRect(left, top, width, height);
    context.strokeRect(left + 0.5, top + 0.5, width, height);
    context.fillStyle = statusColor;
    context.fillRect(left, top, width, Math.min(3, Math.max(1, height * 0.16)));

    if (width >= 8 && height >= 8) {
      context.save();
      context.beginPath();
      context.rect(left + 2, top + 3, Math.max(1, width - 4), Math.max(1, height - 5));
      context.clip();
      context.font = mode === "compact" ? "600 11px system-ui, sans-serif" : "600 9px system-ui, sans-serif";
      context.fillStyle = "#f2f2f2";
      context.textBaseline = "top";
      const label = compactLabel(context, node.name || node.type || "Node", Math.max(4, width - 5));
      if (label) context.fillText(label, left + 3, top + 5);
      context.restore();
    }

    if (hovered || selected) drawNodeTooltip(context, node, left, top, width, height);
  });
}

function drawNodeTooltip(context, node, left, top, width, height) {
  const title = node.name || node.type || "Node";
  const subtitle = node.type || "Node";
  context.font = "600 12px system-ui, sans-serif";
  const titleWidth = context.measureText(title).width;
  context.font = "10px system-ui, sans-serif";
  const subtitleWidth = context.measureText(subtitle).width;
  const tooltipWidth = Math.min(280, Math.max(86, titleWidth + 18, subtitleWidth + 18));
  const tooltipX = left + width + 7;
  const tooltipY = Math.max(6, top + Math.min(height, 12));
  context.fillStyle = "rgba(18, 18, 18, 0.96)";
  context.strokeStyle = "#f0d629";
  context.lineWidth = 1;
  context.fillRect(tooltipX, tooltipY, tooltipWidth, 40);
  context.strokeRect(tooltipX + 0.5, tooltipY + 0.5, tooltipWidth, 40);
  context.font = "600 12px system-ui, sans-serif";
  context.fillStyle = "#f4f4f4";
  context.fillText(title, tooltipX + 8, tooltipY + 15, tooltipWidth - 16);
  context.font = "10px system-ui, sans-serif";
  context.fillStyle = "#a9a9a9";
  context.fillText(subtitle, tooltipX + 8, tooltipY + 31, tooltipWidth - 16);
}

function overviewHitAtPoint(nodes, edges, viewport, clientX, clientY, canvas) {
  const node = overviewNodeAtPoint(nodes, viewport, clientX, clientY, canvas);
  if (node) return { kind: "node", id: node.id, node };
  const edge = overviewEdgeAtPoint(edges, nodes, viewport, clientX, clientY, canvas);
  return edge ? { kind: "edge", id: edge.id, edge } : null;
}

function overviewNodeAtPoint(nodes, viewport, clientX, clientY, canvas) {
  const rect = canvas?.getBoundingClientRect();
  if (!rect) return null;
  const normalizedViewport = normalizeOverviewViewport(viewport);
  const sceneX = (clientX - rect.left - normalizedViewport.x) / normalizedViewport.zoom;
  const sceneY = (clientY - rect.top - normalizedViewport.y) / normalizedViewport.zoom;
  for (let index = (nodes || []).length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    const bounds = estimatedNodeRect(node, 5 / normalizedViewport.zoom);
    if (sceneX >= bounds.left && sceneX <= bounds.right && sceneY >= bounds.top && sceneY <= bounds.bottom) return node;
  }
  return null;
}

function overviewEdgeAtPoint(edges, nodes, viewport, clientX, clientY, canvas) {
  const rect = canvas?.getBoundingClientRect();
  if (!rect) return null;
  const normalizedViewport = normalizeOverviewViewport(viewport);
  const point = { x: clientX - rect.left, y: clientY - rect.top };
  const nodeById = new Map((nodes || []).map((node) => [node.id, node]));
  for (let index = (edges || []).length - 1; index >= 0; index -= 1) {
    const edge = edges[index];
    const source = nodeById.get(edge.from?.nodeId);
    const target = nodeById.get(edge.to?.nodeId);
    if (!source || !target) continue;
    const sourceRect = estimatedNodeRect(source);
    const targetRect = estimatedNodeRect(target);
    const p0 = {
      x: sceneToScreenX(sourceRect.right, normalizedViewport),
      y: sceneToScreenY((sourceRect.top + sourceRect.bottom) / 2, normalizedViewport)
    };
    const p3 = {
      x: sceneToScreenX(targetRect.left, normalizedViewport),
      y: sceneToScreenY((targetRect.top + targetRect.bottom) / 2, normalizedViewport)
    };
    const curve = Math.max(22, Math.abs(p3.x - p0.x) * 0.42);
    const p1 = { x: p0.x + curve, y: p0.y };
    const p2 = { x: p3.x - curve, y: p3.y };
    let previous = p0;
    for (let step = 1; step <= 18; step += 1) {
      const current = cubicBezierPoint(p0, p1, p2, p3, step / 18);
      if (distanceToSegment(point, previous, current) <= 6) return edge;
      previous = current;
    }
  }
  return null;
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const oneMinus = 1 - t;
  return {
    x: oneMinus ** 3 * p0.x + 3 * oneMinus ** 2 * t * p1.x + 3 * oneMinus * t ** 2 * p2.x + t ** 3 * p3.x,
    y: oneMinus ** 3 * p0.y + 3 * oneMinus ** 2 * t * p1.y + 3 * oneMinus * t ** 2 * p2.y + t ** 3 * p3.y
  };
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

function overviewNodesInScreenRect(nodes, viewport, start, current, canvas) {
  const canvasRect = canvas?.getBoundingClientRect();
  if (!canvasRect) return [];
  const normalizedViewport = normalizeOverviewViewport(viewport);
  const selection = normalizedPointerRect(start, current);
  return (nodes || []).filter((node) => {
    const bounds = estimatedNodeRect(node);
    const nodeRect = {
      left: canvasRect.left + sceneToScreenX(bounds.left, normalizedViewport),
      top: canvasRect.top + sceneToScreenY(bounds.top, normalizedViewport),
      right: canvasRect.left + sceneToScreenX(bounds.right, normalizedViewport),
      bottom: canvasRect.top + sceneToScreenY(bounds.bottom, normalizedViewport)
    };
    return rectanglesIntersect(selection, nodeRect);
  }).map((node) => node.id);
}

function additiveOverviewSelection(baseSelection, nodeIds) {
  return [...new Set([...(baseSelection || []), ...(nodeIds || [])])];
}

function toggledOverviewSelection(baseSelection, nodeId) {
  const next = new Set(baseSelection || []);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  return [...next];
}

function normalizedPointerRect(start, current) {
  return {
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    right: Math.max(start.x, current.x),
    bottom: Math.max(start.y, current.y)
  };
}

function rectanglesIntersect(first, second) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

function pointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function compactLabel(context, value, maxWidth) {
  const text = String(value || "").trim();
  if (!text || maxWidth < 4) return "";
  if (context.measureText(text).width <= maxWidth) return text;
  let compact = text.replace(/[^a-z0-9]/gi, "");

  while (compact.length > 1 && context.measureText(compact).width > maxWidth) compact = compact.slice(0, -1);
  return compact;
}

function isProcessingStatus(status) {
  return ["running", "planning", "exporting", "compiling", "compiling-board", "compiling-characters", "uploading"].includes(status);
}

function overviewTypeColor(type) {
  const value = String(type || "node");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return typeColors[hash % typeColors.length];
}

function overviewColorWithAlpha(color, alpha, fallback) {
  const value = String(color || "").trim();
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const number = Number.parseInt(hex[1], 16);
    const red = (number >> 16) & 255;
    const green = (number >> 8) & 255;
    const blue = number & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  if (value.startsWith("rgb")) return value;
  return fallback;
}

function normalizeOverviewViewport(viewport) {
  return {
    x: Number(viewport?.x) || 0,
    y: Number(viewport?.y) || 0,
    zoom: Math.max(0.01, Number(viewport?.scale ?? viewport?.zoom) || 1)
  };
}

function sceneToScreenX(value, viewport) {
  return Number(value || 0) * viewport.zoom + viewport.x;
}

function sceneToScreenY(value, viewport) {
  return Number(value || 0) * viewport.zoom + viewport.y;
}
