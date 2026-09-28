import { fileNameFromLocalUrl } from "./mediaAssets.js";

export const outputTokenOptions = Object.freeze(["$node", "$filename", "$date", "$index", "$time"]);

export function outputSourceNodeTitle(source, fallback = "source") {
  const title = String(source?.data?.title || "").trim();
  if (title) return title;
  return String(fallback || source?.type || "source").trim() || "source";
}

export function outputSourceFileName(source, outputItem = null, incomingByNode = {}) {
  const upstreamFileName = singleUpstreamVideoFileName(source, incomingByNode, new Set());
  if (upstreamFileName) return upstreamFileName;
  return sourceOwnFileName(source, outputItem);
}

function singleUpstreamVideoFileName(source, incomingByNode, visitedNodeIds) {
  const sourceId = String(source?.id || "");
  if (!sourceId || visitedNodeIds.has(sourceId)) return "";
  visitedNodeIds.add(sourceId);

  const incoming = incomingByNode?.[sourceId] || {};
  const videoConnections = orderedVideoInputConnections(incoming);
  if (videoConnections.length !== 1) return "";

  const upstreamSource = videoConnections[0]?.source;
  if (!upstreamSource) return "";
  return singleUpstreamVideoFileName(upstreamSource, incomingByNode, visitedNodeIds)
    || sourceOwnFileName(upstreamSource);
}

function orderedVideoInputConnections(incoming = {}) {
  const primaryPortIds = ["videoIn", "referenceVideoIn"];
  const matchingPortIds = Object.keys(incoming).filter((portId) =>
    /video/i.test(portId)
    && !primaryPortIds.includes(portId)
    && !/(mask|control)/i.test(portId)
  );
  return [...primaryPortIds, ...matchingPortIds]
    .flatMap((portId) => Array.isArray(incoming[portId]) ? incoming[portId] : []);
}

function sourceOwnFileName(source, outputItem = null) {
  const data = source?.data || {};
  const resultItems = Array.isArray(data.resultItems) ? data.resultItems.filter((item) => item?.url) : [];
  const currentItem = resultItems.find((item) => item.url === data.resultUrl);
  const selectedIndex = Math.trunc(Number(data.selectedResultIndex));
  const selectedItem = Number.isFinite(selectedIndex) && selectedIndex >= 0 ? resultItems[selectedIndex] : null;
  const resultItem = currentItem || selectedItem || resultItems.at(-1) || null;
  const sourceUrl = outputItem?.url || resultItem?.url || data.resultUrl || "";
  return String(
    data.fileName
      || outputItem?.fileName
      || resultItem?.fileName
      || (sourceUrl ? fileNameFromLocalUrl(sourceUrl) : "")
      || ""
  ).trim();
}

export function insertOutputToken(value, token, selectionStart, selectionEnd = selectionStart) {
  const text = String(value || "");
  const cleanToken = outputTokenOptions.includes(token) ? token : "";
  const start = clampSelection(selectionStart, text.length);
  const end = Math.max(start, clampSelection(selectionEnd, text.length));
  if (!cleanToken) return { value: text, cursor: start };

  return {
    value: `${text.slice(0, start)}${cleanToken}${text.slice(end)}`,
    cursor: start + cleanToken.length
  };
}

function clampSelection(value, length) {
  const number = Number(value);
  if (!Number.isFinite(number)) return length;
  return Math.max(0, Math.min(length, Math.round(number)));
}
