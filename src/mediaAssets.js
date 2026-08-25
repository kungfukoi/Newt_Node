export const outputDragMime = "application/x-newtnode-output";
export const outputDragEndEvent = "newtnode-output-drag-end";
export const fullResolutionContextPreparedAttribute = "data-full-resolution-context-prepared";
export const fullResolutionPreviewSourceAttribute = "data-full-resolution-preview-source";
export const fullResolutionFallbackAttemptAttribute = "data-full-resolution-fallback-attempt";
const outputDragWindowKey = "__newtNodeDraggedOutputItem";
const externalOutputsPrefix = "/external-outputs/";
const localApiPort = String(import.meta.env?.VITE_API_PORT || "3336");

const outputMediaTypes = new Set(["image", "video", "audio", "model3d", "text"]);
const imageFileExtensionPattern = /\.(png|jpe?g|webp|gif)$/i;
const videoFileExtensionPattern = /\.(mp4|mov|qt|webm)$/i;
const audioFileExtensionPattern = /\.(mp3|wav|m4a|aac|ogg)$/i;
const localHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);

export function isLocalOutputUrl(value) {
  if (typeof value !== "string") return false;
  return value.startsWith("/outputs/") || value.startsWith(externalOutputsPrefix) || /^\/workflow-assets\/[^/]+\/outputs\//.test(value);
}

export function isLocalThumbnailUrl(value) {
  if (typeof value !== "string") return false;
  const clean = value.split("?")[0].split("#")[0];
  return /(?:^|\/)thumbnails\//i.test(clean)
    || /-preview(?:-\d+)?\.jpe?g$/i.test(clean);
}

export function isLocalDraggableMediaUrl(value) {
  if (typeof value !== "string") return false;
  if (isLocalThumbnailUrl(value)) return false;
  return value.startsWith("/uploads/")
    || value.startsWith("/outputs/")
    || value.startsWith(externalOutputsPrefix)
    || /^\/workflow-assets\/[^/]+\//.test(value);
}

export function outputMediaTypeForUrl(url, fallbackType) {
  const extension = fileNameFromLocalUrl(url).toLowerCase();
  if (/\.(glb|gltf)$/.test(extension)) return "model3d";
  if (/\.(mp4|mov|qt|webm)$/.test(extension)) return "video";
  if (/\.(mp3|wav|m4a|aac|ogg)$/.test(extension)) return "audio";
  if (/\.(txt|md|markdown|json|csv|tsv|xml|yaml|yml)$/.test(extension)) return "text";
  if (/\.(png|jpe?g|webp|gif)$/.test(extension)) return "image";
  return outputMediaTypes.has(fallbackType) ? fallbackType : "";
}

export function previewImageUrl(itemOrUrl, thumbnailUrl = "") {
  const item = itemOrUrl && typeof itemOrUrl === "object" ? itemOrUrl : null;
  const explicitThumbnail = String(
    thumbnailUrl
      || item?.thumbnailUrl
      || item?.thumbnailPublicPath
      || ""
  ).trim();
  if (explicitThumbnail) return explicitThumbnail;

  const sourceUrl = String(
    item?.url
      || item?.localUrl
      || item?.resultUrl
      || itemOrUrl
      || ""
  ).trim();
  if (!sourceUrl || isLocalThumbnailUrl(sourceUrl)) return sourceUrl;

  const cleanPath = sourceUrl.split("?")[0].split("#")[0];
  const isLocalImage = outputMediaTypeForUrl(cleanPath, "") === "image"
    && (
      isLocalDraggableMediaUrl(cleanPath)
      || cleanPath.startsWith("/storyboard/")
    );
  if (!isLocalImage) return sourceUrl;

  return `/api/media-thumbnail?url=${encodeURIComponent(sourceUrl)}`;
}

export function fullResolutionImageUrl(itemOrUrl) {
  const item = itemOrUrl && typeof itemOrUrl === "object" ? itemOrUrl : null;
  if (item) {
    const fullItem = fullResolutionOutputItem({ ...item, type: item.type || "image" });
    if (fullItem?.url) return fullItem.url;
    return String(item.url || item.localUrl || item.resultUrl || "").trim();
  }

  return String(itemOrUrl || "").trim();
}

export function displayMediaUrl(itemOrUrl) {
  const item = itemOrUrl && typeof itemOrUrl === "object" ? itemOrUrl : null;
  const sourceUrl = String(
    item?.url
      || item?.localUrl
      || item?.resultUrl
      || itemOrUrl
      || ""
  ).trim();
  if (!sourceUrl || /^(?:blob:|data:)/i.test(sourceUrl)) return sourceUrl;

  const displayUrl = shouldUseLocalVideoPreview(sourceUrl)
    ? `/api/video-preview?url=${encodeURIComponent(sourceUrl)}`
    : sourceUrl;
  const localPath = localApiServedMediaPath(displayUrl);
  if (!localPath) return displayUrl;
  if (typeof window === "undefined" || !window.location) return sourceUrl;

  if (!localHosts.has(window.location.hostname)) return sourceUrl;
  const absoluteLocalUrl = /^https?:\/\//i.test(displayUrl);
  if (!localApiPort || (window.location.port === localApiPort && !absoluteLocalUrl)) return displayUrl;

  return `${window.location.protocol}//${window.location.hostname}:${localApiPort}${localPath}`;
}

function localApiServedMediaPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isApiServedMediaPath(raw)) return raw;

  try {
    const parsed = new URL(raw, "http://newtnode.local");
    if (!localHosts.has(parsed.hostname)) return "";
    const pathWithQuery = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return isApiServedMediaPath(pathWithQuery) ? pathWithQuery : "";
  } catch {
    return "";
  }
}

function isApiServedMediaPath(value) {
  const clean = String(value || "").split("?")[0].split("#")[0];
  return clean === "/api/media-thumbnail"
    || clean === "/api/video-preview"
    || clean.startsWith("/uploads/")
    || clean.startsWith("/outputs/")
    || clean.startsWith(externalOutputsPrefix)
    || /^\/workflow-assets\/[^/]+\//.test(clean);
}

function shouldUseLocalVideoPreview(value) {
  const cleanPath = String(value || "").split("?")[0].split("#")[0];
  return /\.(mov|qt)$/i.test(cleanPath) && isLocalDraggableMediaUrl(cleanPath);
}

export function fullResolutionImageProps(itemOrUrl, fileName = "") {
  const item = itemOrUrl && typeof itemOrUrl === "object" ? itemOrUrl : null;
  const sourceUrl = [
    item?.fullResolutionUrl,
    item?.originalUrl,
    item?.resultUrl,
    item?.url,
    item?.localUrl,
    item ? "" : itemOrUrl
  ]
    .map((candidate) => String(candidate || "").trim())
    .find((candidate) => candidate && !isLocalThumbnailUrl(candidate));

  if (!sourceUrl) return {};

  return {
    "data-full-resolution-url": sourceUrl,
    "data-full-resolution-file-name": String(
      fileName
        || item?.fileName
        || item?.storedFileName
        || fileNameFromLocalUrl(sourceUrl)
        || "image"
    ).trim()
  };
}

export function nextFullResolutionImageFallback(currentUrl, fullResolutionUrl, attemptedUrl = "") {
  const current = comparableMediaUrl(currentUrl);
  const fullResolution = comparableMediaUrl(fullResolutionUrl);
  const attempted = comparableMediaUrl(attemptedUrl);
  if (!fullResolution || current === fullResolution || attempted === fullResolution) return "";
  return String(fullResolutionUrl || "").trim();
}

function comparableMediaUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";

  try {
    const parsed = new URL(source, "http://newtnode.local");
    if (parsed.origin === "http://newtnode.local" || ["127.0.0.1", "localhost", "0.0.0.0"].includes(parsed.hostname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.href;
  } catch {
    return source;
  }
}

export function prepareFullResolutionImageForNativeSave(image) {
  const fullResolutionUrl = String(
    image?.dataset?.fullResolutionUrl
      || image?.getAttribute?.("data-full-resolution-url")
      || ""
  ).trim();
  const previewSource = String(image?.getAttribute?.("src") || "").trim();
  if (!fullResolutionUrl || !previewSource || previewSource === fullResolutionUrl) return false;

  image.setAttribute(fullResolutionPreviewSourceAttribute, previewSource);
  image.setAttribute(fullResolutionContextPreparedAttribute, "true");
  image.setAttribute("src", fullResolutionUrl);
  return true;
}

export function restoreFullResolutionImagePreview(image) {
  const previewSource = String(image?.getAttribute?.(fullResolutionPreviewSourceAttribute) || "").trim();
  image?.removeAttribute?.(fullResolutionContextPreparedAttribute);
  image?.removeAttribute?.(fullResolutionPreviewSourceAttribute);
  if (!previewSource) return false;
  image.setAttribute("src", previewSource);
  return true;
}

export function hasOutputItemDragData(dataTransfer) {
  const types = Array.from(dataTransfer?.types || []);
  return types.includes(outputDragMime)
    || types.includes("text/uri-list")
    || types.includes("text/plain")
    || types.includes("DownloadURL")
    || types.includes("text/html")
    || Boolean(currentDraggedOutputItem());
}

export function outputItemFromDataTransfer(dataTransfer) {
  const raw = dataTransfer?.getData(outputDragMime);
  if (raw) {
    try {
      const item = fullResolutionOutputItem(JSON.parse(raw));
      if (item?.url && item?.type) return item;
    } catch {
      // Fall through to URL payloads below.
    }
  }

  const url = localOutputUrlFromDataTransfer(dataTransfer);
  const type = outputMediaTypeForUrl(url, "");
  if (!url || !type) return currentDraggedOutputItem();

  const fileName = fileNameFromLocalUrl(url);
  return {
    id: `dragged-url:${url}`,
    url,
    type,
    label: fileName || `${capitalizeMediaType(type)} output`,
    fileName,
    mimeType: mimeForOutputItem({ url, type })
  };
}

export function setOutputItemDragData(dataTransfer, item, mimeType = outputDragMime) {
  clearOutputItemDragData();
  const dragItem = fullResolutionOutputItem(item);
  if (!dragItem?.url || !dragItem?.type) return null;

  if (typeof window !== "undefined") {
    window[outputDragWindowKey] = dragItem;
  }

  dataTransfer.effectAllowed = "copy";
  dataTransfer.setData(mimeType, JSON.stringify(dragItem));
  dataTransfer.setData("text/plain", dragItem.url);
  dataTransfer.setData("text/uri-list", dragItem.url);
  return dragItem;
}

export function clearOutputItemDragData(item) {
  if (typeof window === "undefined") return;
  const current = currentDraggedOutputItem();
  if (!item || current?.id === item.id || current?.url === item.url) {
    window[outputDragWindowKey] = null;
  }
}

export function finishOutputItemDragData(item, event) {
  if (typeof window === "undefined") return;
  const activeItem = currentDraggedOutputItem() || item;
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (activeItem?.url && activeItem?.type && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    window.dispatchEvent(new CustomEvent(outputDragEndEvent, {
      detail: {
        item: activeItem,
        clientX,
        clientY
      }
    }));
  }
  // Drag state is one browser interaction. End it even if the source rerendered
  // and replaced the item object while the pointer was down.
  clearOutputItemDragData();
}

export function currentDraggedOutputItem() {
  if (typeof window === "undefined") return null;
  return fullResolutionOutputItem(window[outputDragWindowKey]);
}

export function fullResolutionOutputItem(item) {
  if (!item?.type) return null;
  const candidates = [item.fullResolutionUrl, item.originalUrl, item.resultUrl, item.url];
  const url = candidates
    .map((candidate) => normalizeDroppedLocalOutputUrl(candidate))
    .find(Boolean);
  if (!url) return null;
  return { ...item, url };
}

export function localOutputUrlFromDataTransfer(dataTransfer) {
  const downloadUrl = String(dataTransfer?.getData("DownloadURL") || "").split(":").slice(2).join(":");
  const htmlUrl = localOutputUrlFromHtml(dataTransfer?.getData("text/html"));
  const rawValues = [dataTransfer?.getData("text/uri-list"), dataTransfer?.getData("text/plain"), downloadUrl, htmlUrl];
  for (const rawValue of rawValues) {
    const candidates = String(rawValue || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    for (const candidate of candidates) {
      const localUrl = normalizeDroppedLocalOutputUrl(candidate);
      if (localUrl) return localUrl;
    }
  }

  return "";
}

function localOutputUrlFromHtml(html) {
  const source = String(html || "");
  if (!source) return "";
  const match = source.match(/\b(?:src|href)=["']([^"']+)["']/i);
  return match?.[1] || "";
}

export function normalizeDroppedLocalOutputUrl(value) {
  const candidate = String(value || "").trim();
  if (isLocalDraggableMediaUrl(candidate)) return candidate;

  try {
    const parsed = new URL(candidate, window.location.origin);
    if (parsed.origin === window.location.origin && isLocalDraggableMediaUrl(parsed.pathname)) {
      return parsed.pathname;
    }
    const localHosts = new Set(["127.0.0.1", "localhost", "0.0.0.0"]);
    if (localHosts.has(parsed.hostname) && isLocalDraggableMediaUrl(parsed.pathname)) {
      return parsed.pathname;
    }
  } catch {
    return "";
  }

  return "";
}

export function isOutputItemCompatibleWithNode(item, nodeType) {
  if (!item?.type) return false;
  if (nodeType === "model3d") return item.type === "model3d";
  return item.type === nodeType;
}

export function assetFromOutputItem(item) {
  const fullResolutionItem = fullResolutionOutputItem(item);
  if (!fullResolutionItem) return null;
  return {
    fileName: fullResolutionItem.fileName || fileNameFromLocalUrl(fullResolutionItem.url),
    storedFileName: "",
    mimeType: fullResolutionItem.mimeType || mimeForOutputItem(fullResolutionItem),
    mediaType: fullResolutionItem.type,
    localUrl: fullResolutionItem.url,
    thumbnailUrl: fullResolutionItem.thumbnailUrl || ""
  };
}

export function mimeForOutputItem(item) {
  const fileName = fileNameFromLocalUrl(item?.url || item?.fileName || "");
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov") || lower.endsWith(".qt")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".glb")) return "model/gltf-binary";
  if (lower.endsWith(".gltf")) return "model/gltf+json";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  if (item?.type === "video") return "video/mp4";
  if (item?.type === "audio") return "audio/mpeg";
  if (item?.type === "model3d") return "model/gltf-binary";
  return "image/png";
}

export function fileNameFromLocalUrl(url) {
  const clean = String(url || "").split("?")[0].split("#")[0];
  const fileName = clean.split("/").pop() || "output";
  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

export function capitalizeMediaType(type) {
  if (type === "model3d") return "3D";
  const value = String(type || "Media");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function mediaAccept(type) {
  if (type === "image") return "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.gif";
  if (type === "video") return "video/mp4,video/quicktime,video/webm,.mp4,.mov,.qt,.webm";
  return "audio/mpeg,audio/wav,audio/mp4,.mp3,.wav,.m4a,.aac,.ogg";
}

export function allowFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
}

export function firstAcceptedFile(fileList, type) {
  const files = Array.from(fileList || []);
  if (type === "image") return files.find((file) => nodeTypeForDroppedFile(file) === "image");
  if (type === "video") return files.find((file) => nodeTypeForDroppedFile(file) === "video");
  if (type === "audio") return files.find((file) => nodeTypeForDroppedFile(file) === "audio");
  if (type === "model3d") return files.find(isModel3DFile);
  return files[0];
}

export async function supportedFilesFromDataTransfer(dataTransfer, maxFiles = 32) {
  const directFiles = Array.from(dataTransfer?.files || [])
    .filter((file) => nodeTypeForDroppedFile(file));
  const items = Array.from(dataTransfer?.items || []);
  const itemFiles = [];
  if (items.length) {
    for (const item of items) {
      if (itemFiles.length >= maxFiles) break;
      await collectDataTransferItemFiles(item, itemFiles, maxFiles);
    }
  }

  const merged = directFiles.slice(0, maxFiles);
  const signatures = new Set(merged.map(droppedFileSignature));
  for (const file of itemFiles) {
    if (merged.length >= maxFiles) break;
    const signature = droppedFileSignature(file);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    merged.push(file);
  }
  return merged;
}

function droppedFileSignature(file) {
  return [file?.name || "", file?.size || 0, file?.lastModified || 0, file?.type || ""].join(":");
}

async function collectDataTransferItemFiles(item, files, maxFiles) {
  if (!item || (item.kind && item.kind !== "file") || files.length >= maxFiles) return;
  const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
  if (entry) {
    await collectDroppedEntryFiles(entry, files, maxFiles);
    return;
  }

  const file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
  if (nodeTypeForDroppedFile(file)) files.push(file);
}

async function collectDroppedEntryFiles(entry, files, maxFiles) {
  if (!entry || files.length >= maxFiles) return;

  if (entry.isFile) {
    const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
    if (nodeTypeForDroppedFile(file)) files.push(file);
    return;
  }

  if (!entry.isDirectory || typeof entry.createReader !== "function") return;
  const reader = entry.createReader();
  let entries = await readDirectoryEntries(reader);
  while (entries.length && files.length < maxFiles) {
    for (const child of entries) {
      if (files.length >= maxFiles) break;
      await collectDroppedEntryFiles(child, files, maxFiles);
    }
    entries = await readDirectoryEntries(reader);
  }
}

function readDirectoryEntries(reader) {
  return new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
}

export function hasSupportedDroppedFile(value) {
  return Array.from(value || []).some((item) => {
    if (item.kind && item.kind !== "file") return false;
    if (item.kind === "file") {
      const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
      if (entry?.isDirectory) return true;
      const file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
      return Boolean(nodeTypeForDroppedFile(file) || nodeTypeForDroppedFile({ type: item.type || "", name: file?.name || "" }));
    }
    if (item.getAsFile) return Boolean(nodeTypeForDroppedFile(item.getAsFile()) || nodeTypeForDroppedFile({ type: item.type || "", name: "" }));
    return Boolean(nodeTypeForDroppedFile(item));
  });
}

export function nodeTypeForDroppedFile(file) {
  if (!file) return "";
  const mimeType = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (imageFileExtensionPattern.test(name)) return "image";
  if (videoFileExtensionPattern.test(name)) return "video";
  if (audioFileExtensionPattern.test(name)) return "audio";
  if (isModel3DFile(file)) return "model3d";
  if (isTextFile(file)) return "plainText";
  return "";
}

export function isModel3DFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const mimeType = String(file?.type || "").toLowerCase();
  return mimeType.startsWith("model/") || /\.(glb|gltf)$/i.test(name);
}

export function isTextFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const mimeType = String(file?.type || "").toLowerCase();
  if (mimeType.startsWith("text/")) return true;
  if (["application/json", "application/xml", "application/yaml", "application/x-yaml"].includes(mimeType)) return true;
  return /\.(txt|md|markdown|json|csv|tsv|xml|yaml|yml|srt|vtt|html|css|js|jsx|ts|tsx|py|sh|bat|ps1|log)$/i.test(name);
}

export function fileBaseName(fileName) {
  return String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .trim();
}
