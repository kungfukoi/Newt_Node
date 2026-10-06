import sharp from "sharp";

export async function prepareObjectSource(buffer) {
  return sharp(buffer, { limitInputPixels: 24000000 }).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
}

export async function encodeObjectMask(buffer, width, height, id) {
  // Fal's apply_mask:false masks are white foreground on black; alpha also gates coverage.
  const { data } = await sharp(buffer, { limitInputPixels: 24000000 }).resize(width, height, { fit: "fill", kernel: "nearest" }).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const runs = []; let start = -1, area = 0;
  for (let i = 0; i <= width * height; i++) {
    const on = i < width * height && data[i * 4 + 3] >= 128 && Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) >= 128;
    if (on) { area++; if (start < 0) start = i; }
    else if (start >= 0) { runs.push(start, i - start); start = -1; }
  }
  return { id, width, height, runs, area };
}

export async function readObjectMask(url, signal) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Fal returned an unsupported mask URL.");
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000) });
  if (!response.ok || !response.body) throw new Error("Could not download the object mask.");
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 16 * 1024 * 1024) throw new Error("Object mask exceeded 16 MB.");
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}
