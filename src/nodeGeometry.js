export const contextMenuSize = { width: 190, height: 420, inset: 8 };

export function estimatedNodeWidth(type) {
  if (type === "frameIt") return 980;
  if (type === "storyboard") return 920;
  if (type === "autoAspect") return 390;
  if (type === "coverage") return 390;
  if (type === "skillDirector") return 760;
  if (type === "imageModel" || type === "videoModel" || type === "utility" || type === "edit" || type === "model3d") return 370;
  if (type === "character") return 760;
  if (type === "camera" || type === "style") return 360;
  if (type === "transfer" || type === "preview") return 335;
  return 310;
}

export function maximumResizableNodeWidth(type) {
  return type === "preview" ? 12000 : 2400;
}

export function maximumResizableNodeHeight(type) {
  return type === "preview" ? 12000 : 3000;
}

export function normalizedNodeWidth(value, type, maximum = maximumResizableNodeWidth(type)) {
  const width = Number(value);
  if (!Number.isFinite(width)) return null;
  const minimum = estimatedNodeWidth(type);
  return Math.round(clamp(width, minimum, Math.max(minimum, Number(maximum) || 2400)));
}

export function normalizedNodeHeight(value, minimum = 180, maximum = 3000) {
  const height = Number(value);
  if (!Number.isFinite(height)) return null;
  const safeMinimum = Math.max(120, Number(minimum) || 180);
  return Math.round(clamp(height, safeMinimum, Math.max(safeMinimum, Number(maximum) || 3000)));
}

export function pairedTextareaResizeHeights(primaryHeight, pairedHeight, delta, minimum = 40, maximum = 1400) {
  const safeMinimum = Math.max(1, Number(minimum) || 40);
  const safeMaximum = Math.max(safeMinimum, Number(maximum) || 1400);
  const primary = clamp(Number(primaryHeight) || safeMinimum, safeMinimum, safeMaximum);
  const paired = clamp(Number(pairedHeight) || safeMinimum, safeMinimum, safeMaximum);
  const total = primary + paired;
  const lowerBound = Math.max(safeMinimum, total - safeMaximum);
  const upperBound = Math.min(safeMaximum, total - safeMinimum);
  const nextPrimary = Math.round(clamp(primary + (Number(delta) || 0), lowerBound, upperBound));
  return {
    primary: nextPrimary,
    paired: Math.round(total - nextPrimary)
  };
}

export function minimumResizableNodeHeight(type) {
  if (type === "frameIt") return 520;
  if (type === "storyboard" || type === "character") return 420;
  if (type === "imageModel" || type === "videoModel" || type === "utility" || type === "edit" || type === "model3d") return 320;
  if (type === "preview" || type === "transfer" || type === "composer") return 280;
  if (type === "autoAspect" || type === "coverage" || type === "camera" || type === "style") return 260;
  if (type === "image" || type === "video") return 250;
  return 180;
}

export function estimatedNodeHeight(type) {
  if (type === "frameIt") return 700;
  if (type === "character") return 520;
  if (type === "composer") return 410;
  if (type === "skillDirector") return 940;
  if (type === "imageModel" || type === "videoModel" || type === "utility" || type === "edit" || type === "model3d" || type === "autoAspect" || type === "coverage") return 430;
  if (type === "transfer" || type === "preview") return 360;
  if (type === "camera") return 380;
  if (type === "style") return 520;
  return 270;
}
export function estimatedNodeRect(node, padding = 0) {
  const width = normalizedNodeWidth(node?.data?.nodeWidth, node?.type) || estimatedNodeWidth(node?.type);
  const height = normalizedNodeHeight(
    node?.data?.nodeHeight,
    minimumResizableNodeHeight(node?.type),
    maximumResizableNodeHeight(node?.type)
  ) || estimatedNodeHeight(node?.type);
  return {
    left: Number(node?.x || 0) - padding,
    top: Number(node?.y || 0) - padding,
    right: Number(node?.x || 0) + width + padding,
    bottom: Number(node?.y || 0) + height + padding
  };
}

export function graphBoundsForNodes(nodes = []) {
  const rects = nodes.map((node) => estimatedNodeRect(node));
  if (!rects.length) return { left: 0, top: 0, right: 0, bottom: 0 };
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom))
  };
}

export function pastedNodePositions(nodes = [], anchor = null, fallbackOffset = 42) {
  const positions = nodes.map((node) => ({
    x: finiteCoordinate(node?.x),
    y: finiteCoordinate(node?.y)
  }));
  if (!positions.length) return [];

  const anchorX = Number(anchor?.x);
  const anchorY = Number(anchor?.y);
  if (Number.isFinite(anchorX) && Number.isFinite(anchorY)) {
    const left = Math.min(...positions.map((position) => position.x));
    const top = Math.min(...positions.map((position) => position.y));
    return positions.map((position) => ({
      x: position.x + anchorX - left,
      y: position.y + anchorY - top
    }));
  }

  const offset = Number.isFinite(Number(fallbackOffset)) ? Number(fallbackOffset) : 42;
  return positions.map((position) => ({ x: position.x + offset, y: position.y + offset }));
}

function finiteCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function rectsOverlap(first, second) {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
}

export function normalizeRect(start, current) {
  return {
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    right: Math.max(start.x, current.x),
    bottom: Math.max(start.y, current.y)
  };
}

export function edgeCurveOffset(from, to) {
  return Math.max(80, Math.abs(Number(to?.x || 0) - Number(from?.x || 0)) * 0.42);
}

export function edgePathData(from, to) {
  const curve = edgeCurveOffset(from, to);
  return `M ${from.x} ${from.y} C ${from.x + curve} ${from.y}, ${to.x - curve} ${to.y}, ${to.x} ${to.y}`;
}

export function edgeLayerBounds(connections = [], points = [], padding = 32) {
  const coordinates = [];

  connections.forEach(({ from, to } = {}) => {
    if (![from?.x, from?.y, to?.x, to?.y].every(Number.isFinite)) return;
    const curve = edgeCurveOffset(from, to);
    coordinates.push(
      from,
      { x: from.x + curve, y: from.y },
      { x: to.x - curve, y: to.y },
      to
    );
  });

  points.forEach((point) => {
    if ([point?.x, point?.y].every(Number.isFinite)) coordinates.push(point);
  });

  if (!coordinates.length) {
    return { left: 0, top: 0, width: 1, height: 1, viewBox: "0 0 1 1" };
  }

  const inset = Math.max(0, Number(padding) || 0);
  const left = Math.floor(Math.min(...coordinates.map((point) => point.x)) - inset);
  const top = Math.floor(Math.min(...coordinates.map((point) => point.y)) - inset);
  const right = Math.ceil(Math.max(...coordinates.map((point) => point.x)) + inset);
  const bottom = Math.ceil(Math.max(...coordinates.map((point) => point.y)) + inset);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  return {
    left,
    top,
    width,
    height,
    viewBox: `${left} ${top} ${width} ${height}`
  };
}

export function mergeMeasuredPortPositions(current = {}, measured = {}, connectedKeys = []) {
  const next = { ...(measured || {}) };
  const keys = connectedKeys instanceof Set ? connectedKeys : new Set(connectedKeys || []);
  keys.forEach((key) => {
    if (!next[key] && current?.[key]) next[key] = current[key];
  });
  return next;
}

export function rectsIntersect(first, second) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

export function pointInRect(rect, point) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

export function groupToRect(group) {
  return {
    left: group.x,
    top: group.y,
    right: group.x + group.width,
    bottom: group.y + group.height
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clampContextMenuPosition(x, y, rect, menuSize = contextMenuSize) {
  const width = positiveDimension(menuSize.width, contextMenuSize.width);
  const height = positiveDimension(menuSize.height, contextMenuSize.height);
  const maxX = Math.max(contextMenuSize.inset, rect.width - width - contextMenuSize.inset);
  const maxY = Math.max(contextMenuSize.inset, rect.height - height - contextMenuSize.inset);

  return {
    x: clamp(x, contextMenuSize.inset, maxX),
    y: clamp(y, contextMenuSize.inset, maxY)
  };
}

export function positiveDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function positiveModulo(value, divisor) {
  if (!divisor) return 0;
  return ((value % divisor) + divisor) % divisor;
}
