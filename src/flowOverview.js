export const flowOverviewNodeCountThreshold = 80;
export const flowMapEnterZoomThreshold = 0.06;
export const flowMapExitZoomThreshold = 0.08;
export const flowDetailEnterZoomThreshold = 0.18;
export const flowDetailExitZoomThreshold = 0.15;
export const flowOverviewEnabled = false;
export const flowOnlyRenderVisibleElements = false;

export function flowRenderMode(nodeCount, zoom, previousMode = "detail") {
  if (!flowOverviewEnabled) return "detail";
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
