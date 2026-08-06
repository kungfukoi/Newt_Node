import React from "react";
import { Hand, Play, Plus } from "lucide-react";
import { edgeCurveOffset, edgePathData, normalizeRect } from "../nodeGeometry.js";

const emptyEdgeSet = new Set();
const edgeHitTolerancePx = 11;
const edgeHitSamples = 28;

export const EdgeCanvas = React.memo(React.forwardRef(function EdgeCanvas({
  edges = [],
  draftConnection = null,
  viewportRef,
  canvasSize,
  selectedEdgeId = null,
  activeEdgeIds = emptyEdgeSet,
  inactiveEdgeIds = emptyEdgeSet
}, ref) {
  const canvasRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const animationPhaseRef = React.useRef(0);
  const propsRef = React.useRef({
    edges,
    draftConnection,
    viewportRef,
    canvasSize,
    selectedEdgeId,
    activeEdgeIds,
    inactiveEdgeIds
  });

  propsRef.current = {
    edges,
    draftConnection,
    viewportRef,
    canvasSize,
    selectedEdgeId,
    activeEdgeIds,
    inactiveEdgeIds
  };

  const draw = React.useCallback((viewportOverride = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const {
      edges: currentEdges,
      draftConnection: currentDraft,
      viewportRef: currentViewportRef,
      canvasSize: currentCanvasSize,
      selectedEdgeId: currentSelectedEdgeId,
      activeEdgeIds: currentActiveEdgeIds,
      inactiveEdgeIds: currentInactiveEdgeIds
    } = propsRef.current;
    const viewport = viewportOverride || currentViewportRef?.current || { x: 0, y: 0, scale: 1 };
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(currentCanvasSize?.width || rect.width || 1));
    const height = Math.max(1, Math.round(currentCanvasSize?.height || rect.height || 1));
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";

    currentEdges.forEach(({ edge, from, to }) => {
      drawCanvasEdge(context, { from, to }, {
        color: edge.color,
        selected: currentSelectedEdgeId === edge.id,
        active: currentActiveEdgeIds?.has?.(edge.id),
        inactive: currentInactiveEdgeIds?.has?.(edge.id),
        phase: animationPhaseRef.current
      }, viewport);
    });

    if (currentDraft) {
      drawCanvasEdge(context, currentDraft, {
        color: currentDraft.color,
        draft: true,
        phase: animationPhaseRef.current
      }, viewport);
    }
  }, []);

  const hitTest = React.useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
    const { edges: currentEdges, viewportRef: currentViewportRef } = propsRef.current;
    const viewport = currentViewportRef?.current || { x: 0, y: 0, scale: 1 };

    for (let index = currentEdges.length - 1; index >= 0; index -= 1) {
      const item = currentEdges[index];
      if (canvasEdgeHitTest(item, point, viewport)) return item.edge.id;
    }
    return null;
  }, []);

  React.useImperativeHandle(ref, () => ({ draw, hitTest }), [draw, hitTest]);

  React.useLayoutEffect(() => {
    draw();
  }, [draw, edges, draftConnection, canvasSize, selectedEdgeId, activeEdgeIds, inactiveEdgeIds]);

  React.useEffect(() => {
    if (!activeEdgeIds?.size) {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      draw();
      return undefined;
    }

    const animate = () => {
      animationPhaseRef.current = (animationPhaseRef.current + 1.6) % 20;
      draw();
      frameRef.current = window.requestAnimationFrame(animate);
    };
    frameRef.current = window.requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [activeEdgeIds, draw]);

  return <canvas ref={canvasRef} className="edge-canvas-layer" aria-hidden="true" />;
}));

function drawCanvasEdge(context, connection, { color = "#ddc631", draft = false, selected = false, active = false, inactive = false, phase = 0 } = {}, viewport) {
  const curve = canvasCurvePoints(connection.from, connection.to, viewport);
  context.save();
  context.beginPath();
  context.moveTo(curve.start.x, curve.start.y);
  context.bezierCurveTo(curve.first.x, curve.first.y, curve.second.x, curve.second.y, curve.end.x, curve.end.y);

  if (inactive) {
    context.strokeStyle = "#7a7a7a";
    context.globalAlpha = selected ? 0.52 : 0.24;
    context.setLineDash([6, 10]);
  } else {
    context.strokeStyle = color || "#ddc631";
    context.globalAlpha = selected ? 0.9 : draft ? 0.62 : active ? 0.82 : 0.42;
    if (active) {
      context.setLineDash([8, 12]);
      context.lineDashOffset = -phase;
    }
  }

  context.lineWidth = selected ? 2.5 : draft ? 1.5 : 2;
  if (selected) {
    context.shadowColor = "rgba(244, 240, 232, 0.44)";
    context.shadowBlur = 5;
  }
  context.stroke();
  context.restore();
}

function canvasCurvePoints(from, to, viewport) {
  const curve = edgeCurveOffset(from, to);
  return {
    start: sceneToCanvasPoint(from, viewport),
    first: sceneToCanvasPoint({ x: from.x + curve, y: from.y }, viewport),
    second: sceneToCanvasPoint({ x: to.x - curve, y: to.y }, viewport),
    end: sceneToCanvasPoint(to, viewport)
  };
}

function sceneToCanvasPoint(point, viewport) {
  const scale = Number(viewport?.scale) || 1;
  return {
    x: (Number(viewport?.x) || 0) + (Number(point?.x) || 0) * scale,
    y: (Number(viewport?.y) || 0) + (Number(point?.y) || 0) * scale
  };
}

function canvasEdgeHitTest({ from, to } = {}, point, viewport) {
  if (![from?.x, from?.y, to?.x, to?.y, point?.x, point?.y].every(Number.isFinite)) return false;
  const curve = canvasCurvePoints(from, to, viewport);
  let previous = bezierPoint(curve, 0);
  for (let step = 1; step <= edgeHitSamples; step += 1) {
    const next = bezierPoint(curve, step / edgeHitSamples);
    if (distanceToSegment(point, previous, next) <= edgeHitTolerancePx) return true;
    previous = next;
  }
  return false;
}

function bezierPoint(curve, t) {
  const inv = 1 - t;
  const inv2 = inv * inv;
  const t2 = t * t;
  return {
    x: inv2 * inv * curve.start.x + 3 * inv2 * t * curve.first.x + 3 * inv * t2 * curve.second.x + t2 * t * curve.end.x,
    y: inv2 * inv * curve.start.y + 3 * inv2 * t * curve.first.y + 3 * inv * t2 * curve.second.y + t2 * t * curve.end.y
  };
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!dx && !dy) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

export const EdgePath = React.memo(function EdgePath({ edgeId, from, to, color, draft, selected, active, inactive, onSelect }) {
  const path = edgePathData(from, to);
  return (
    <g className={`edge-path ${draft ? "draft" : ""} ${selected ? "selected" : ""} ${active ? "active" : ""} ${inactive ? "inactive" : ""}`}>
      <path className="edge-visible" d={path} stroke={color} strokeWidth={draft ? 3 : 4} fill="none" opacity={draft ? 0.62 : 0.42} strokeLinecap="round" />
      {!draft && (
        <path
          className="edge-hitbox"
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="18"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          onPointerDown={(event) => onSelect?.(event, edgeId)}
        />
      )}
    </g>
  );
});

export const SelectionMarquee = React.memo(function SelectionMarquee({ start, current }) {
  const rect = normalizeRect(start, current);
  return (
    <rect
      className="selection-marquee"
      x={rect.left}
      y={rect.top}
      width={rect.right - rect.left}
      height={rect.bottom - rect.top}
      rx="8"
    />
  );
});

export const SelectionActionBar = React.memo(function SelectionActionBar({ bounds, viewport, selectedCount, runnableCount, onRunAll, onGroup, onMoveStart }) {
  const x = viewport.x + (bounds.left + bounds.width / 2) * viewport.scale;
  const y = viewport.y + bounds.top * viewport.scale - 54;

  return (
    <div className="selection-action-bar" style={{ left: x, top: y }} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" className="selection-move-handle" onPointerDown={onMoveStart} title="Move selected nodes" aria-label="Move selected nodes">
        <Hand size={19} />
      </button>
      <span className="selection-action-divider" aria-hidden="true" />
      <button onClick={onRunAll} disabled={!runnableCount} title={runnableCount ? `Run or play ${runnableCount} selected node${runnableCount === 1 ? "" : "s"}` : "No runnable selected nodes"}>
        <Play size={18} />
        <span>Run All</span>
      </button>
      <button onClick={onGroup} disabled={selectedCount < 2} title="Group selected nodes">
        <Plus size={17} />
        <span>Group</span>
      </button>
    </div>
  );
});

export function UnsavedWorkflowPrompt({ actionLabel, onDecision }) {
  React.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onDecision("cancel");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDecision]);

  return (
    <div className="workflow-prompt-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onDecision("cancel");
    }}>
      <section className="workflow-prompt" role="dialog" aria-modal="true" aria-labelledby="workflow-prompt-title" onPointerDown={(event) => event.stopPropagation()}>
        <h2 id="workflow-prompt-title">Unsaved workflow</h2>
        <p>Save changes before you {actionLabel || "change workflows"}?</p>
        <div className="workflow-prompt-actions">
          <button type="button" className="primary" onClick={() => onDecision("save")}>Save</button>
          <button type="button" onClick={() => onDecision("discard")}>Don't Save</button>
          <button type="button" onClick={() => onDecision("cancel")}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
