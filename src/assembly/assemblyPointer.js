import { minimumAssemblyZoom } from "./assemblyZoom.js";

export function assemblyLocalX(element, clientX) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect) return 0;
  const left = Number(rect.left) || 0;
  const renderedWidth = Number(rect.width) || 0;
  const layoutWidth = Number(element.offsetWidth || element.clientWidth) || renderedWidth || 1;
  const scaleX = renderedWidth > 0 && layoutWidth > 0 ? renderedWidth / layoutWidth : 1;
  const pointerX = Number(clientX);
  return ((Number.isFinite(pointerX) ? pointerX : left) - left) / scaleX;
}

export function assemblyTimeAtClientX(element, clientX, pixelsPerSecond) {
  const scale = Math.max(minimumAssemblyZoom, Number(pixelsPerSecond) || minimumAssemblyZoom);
  return Math.max(0, assemblyLocalX(element, clientX) / scale);
}
