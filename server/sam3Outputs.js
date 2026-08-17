function normalizeRemoteImage(value) {
  if (!value) return null;
  if (typeof value === "string") return { url: value };
  if (typeof value.url === "string") return value;
  if (typeof value.file_url === "string") return { ...value, url: value.file_url };
  if (typeof value.image_url === "string") return { ...value, url: value.image_url };
  if (typeof value.download_url === "string") return { ...value, url: value.download_url };
  if (typeof value.public_url === "string") return { ...value, url: value.public_url };
  return null;
}

export function sam3ImageOutputs(data = {}) {
  const masks = (Array.isArray(data.masks) ? data.masks : [data.mask])
    .map(normalizeRemoteImage)
    .filter((image) => image?.url);
  const preview = normalizeRemoteImage(data.image);

  return {
    masks,
    preview: preview?.url && !masks.some((mask) => mask.url === preview.url) ? preview : null
  };
}