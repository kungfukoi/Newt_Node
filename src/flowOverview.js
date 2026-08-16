export const flowOverviewNodeCountThreshold = 80;
export const flowMapEnterZoomThreshold = 0.12;
export const flowMapExitZoomThreshold = 0.16;
export const flowDetailEnterZoomThreshold = 0.3;
export const flowDetailExitZoomThreshold = 0.24;

export function flowRenderMode(nodeCount, zoom, previousMode = "detail") {
  const count = Math.max(0, Number(nodeCount) || 0);
  const scale = Number(zoom);
  if (count < flowOverviewNodeCountThreshold || !Number.isFinite(scale)) return "detail";

  if (previousMode === "map" && scale < flowMapExitZoomThreshold) return "map";
  if (scale <= flowMapEnterZoomThreshold) return "map";

  if (previousMode === "detail" && scale > flowDetailExitZoomThreshold) return "detail";
  if (scale >= flowDetailEnterZoomThreshold) return "detail";

  return "compact";
}

export function shouldUseFlowOverview(nodeCount, zoom, previousMode = "detail") {
  return flowRenderMode(nodeCount, zoom, previousMode) === "map";
}
