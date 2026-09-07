import { fileNameFromLocalUrl, mimeForOutputItem } from "./mediaAssets.js";

const previewLayoutMediaTypes = new Set(["image", "video"]);

export function normalizedPreviewLayoutItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => normalizePreviewLayoutItem(item, index))
    .filter(Boolean);
}

export function createPreviewLayoutItem(item = {}) {
  return normalizePreviewLayoutItem({
    ...item,
    id: `layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }, 0);
}

export function normalizedPreviewLayoutHiddenUrls(urls = []) {
  return [...new Set((Array.isArray(urls) ? urls : [])
    .map((url) => String(url || "").trim())
    .filter(Boolean))];
}

export function previewLayoutMediaItems(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item, index) => normalizePreviewLayoutItem(item, index))
    .filter(Boolean)
    .map((item) => ({ ...item, sourceUrl: item.sourceUrl || item.url }))
    .filter((item) => {
      const key = String(item.sourceUrl || item.url || "").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function previewLayoutSourceItems(source = null) {
  const items = Array.isArray(source?.items) ? source.items : [];
  const storyboardLayoutItems = items.flatMap((item) => (
    Array.isArray(item?.layoutItems) ? item.layoutItems : []
  ));
  return previewLayoutMediaItems(storyboardLayoutItems.length ? storyboardLayoutItems : items);
}

export function mergePreviewMediaIntoLayout(layoutItems = [], sourceItems = [], hiddenUrls = []) {
  const hidden = new Set(normalizedPreviewLayoutHiddenUrls(hiddenUrls));
  const existing = new Set();
  const nextItems = normalizedPreviewLayoutItems(layoutItems);
  nextItems.forEach((item) => {
    if (item.url) existing.add(item.url);
    if (item.sourceUrl) existing.add(item.sourceUrl);
  });

  previewLayoutMediaItems(sourceItems).forEach((item) => {
    const sourceUrl = String(item.sourceUrl || item.url || "").trim();
    if (!sourceUrl || hidden.has(sourceUrl) || hidden.has(item.url) || existing.has(sourceUrl) || existing.has(item.url)) return;
    const nextItem = createPreviewLayoutItem({ ...item, sourceUrl });
    if (!nextItem) return;
    nextItems.push(nextItem);
    existing.add(nextItem.url);
    existing.add(nextItem.sourceUrl);
  });

  return nextItems;
}

export function movePreviewLayoutItem(items = [], fromId, beforeId = "") {
  const currentItems = normalizedPreviewLayoutItems(items);
  if (!fromId || fromId === beforeId) return currentItems;
  const fromIndex = currentItems.findIndex((item) => item.id === fromId);
  if (fromIndex < 0) return currentItems;
  const nextItems = [...currentItems];
  const [moved] = nextItems.splice(fromIndex, 1);
  const toIndex = beforeId ? nextItems.findIndex((item) => item.id === beforeId) : -1;
  if (toIndex >= 0) nextItems.splice(toIndex, 0, moved);
  else nextItems.push(moved);
  return nextItems;
}

export function previewLayoutDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

export function previewLayoutAspectValue(item = {}) {
  const width = previewLayoutDimension(item.width);
  const height = previewLayoutDimension(item.height);
  return width && height ? `${width} / ${height}` : "16 / 9";
}

export function previewLayoutColumnCount(items = []) {
  return Math.max(1, Math.min(3, items.length || 1));
}

export function previewLayoutExportCaption(item, index = 0) {
  const label = String(item?.label || "").replace(/\s+/g, " ").trim();
  if (isUsefulPreviewLayoutCaption(label, item)) return label;
  return `Frame ${index + 1}.`;
}

export function samePreviewLayoutItems(first = [], second = []) {
  if (first.length !== second.length) return false;
  return first.every((item, index) => {
    const other = second[index];
    return item.id === other?.id
      && item.url === other?.url
      && item.sourceUrl === other?.sourceUrl
      && item.type === other?.type
      && item.label === other?.label
      && item.thumbnailUrl === other?.thumbnailUrl
      && item.width === other?.width
      && item.height === other?.height;
  });
}

export function previewLayoutVideoPosterUrl(item = {}) {
  const thumbnailUrl = String(item.thumbnailUrl || "").trim();
  if (thumbnailUrl && /\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(thumbnailUrl)) return thumbnailUrl;
  const url = String(item.url || "").trim();
  return url ? `/api/video-poster?url=${encodeURIComponent(url)}` : "";
}

function normalizePreviewLayoutItem(item = {}, index = 0) {
  const url = String(item?.url || "").trim();
  if (!url) return null;
  const type = previewLayoutMediaType(item);
  if (!type) return null;
  const width = previewLayoutDimension(item?.width || item?.naturalWidth);
  const height = previewLayoutDimension(item?.height || item?.naturalHeight);
  const sourceUrl = String(item?.sourceUrl || url).trim();
  const fileName = item?.fileName || fileNameFromLocalUrl(url);
  return {
    id: String(item?.id || `layout-${index}-${url}`).slice(0, 120),
    url,
    sourceUrl,
    thumbnailUrl: String(item?.thumbnailUrl || item?.thumbnailPublicPath || "").trim(),
    type,
    label: item?.label || fileName || `Layout ${type} ${index + 1}`,
    fileName,
    mimeType: item?.mimeType || mimeForOutputItem({ url, type }),
    ...(width && height ? { width, height } : {})
  };
}

function previewLayoutMediaType(item = {}) {
  if (previewLayoutMediaTypes.has(item.type)) return item.type;
  if (item.type) return "";
  const mimeType = String(item.mimeType || "").toLowerCase();
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  const inferredMimeType = mimeForOutputItem(item);
  if (inferredMimeType.startsWith("video/")) return "video";
  if (inferredMimeType.startsWith("image/")) return "image";
  return "";
}

function isUsefulPreviewLayoutCaption(label = "", item = {}) {
  if (!label) return false;
  const fileName = String(item?.fileName || fileNameFromLocalUrl(item?.url) || "").trim();
  const fileBase = fileName ? fileName.replace(/\.[A-Za-z0-9]+$/, "") : "";
  if (label === fileName || label === fileBase) return false;
  if (/\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i.test(label)) return false;
  if (/^20\d{2}-\d{2}-\d{2}T\d{2}/.test(label)) return false;
  if (/\bgenerated\s+(image|video)\s*,?\s+unique\s+id\b/i.test(label)) return false;
  return true;
}
