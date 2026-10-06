export const canvasGridSize = 28;
export const canvasSnapGrid = [canvasGridSize, canvasGridSize];
export const snapCanvasCoordinate = value => Math.round(value / canvasGridSize) * canvasGridSize || 0;

// Translate the selection as one unit so node and group spacing stays intact.
export function canvasDragDelta(anchor, delta, enabled) {
  if (!enabled || (!delta.x && !delta.y)) return delta;
  return { x: snapCanvasCoordinate(anchor.x + delta.x) - anchor.x,
    y: snapCanvasCoordinate(anchor.y + delta.y) - anchor.y };
}
export function canvasDragAnchor(nodes) {
  return { x: Math.min(...nodes.map(node => node.x)), y: Math.min(...nodes.map(node => node.y)) };
}
