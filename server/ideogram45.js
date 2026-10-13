import sharp from "sharp";
import { buildIdeogram45Request, ideogram45UnpricedCost } from "../src/ideogram45.js";

const maxInputBytes = 25 * 1024 * 1024;

export async function prepareIdeogram45Upload(image, index, { maxBytes = maxInputBytes } = {}) {
  const input = Buffer.isBuffer(image)
    ? { buffer: image, mimeType: "image/png", fileName: `ideogram-reference-${index + 1}.png` } : image;
  if (!input?.buffer || input.buffer.length <= maxBytes) return input;
  // Recompress a provider-only copy losslessly; never resize source/mask geometry.
  const buffer = await sharp(input.buffer, { limitInputPixels: 24000000, animated: false, failOn: "error" })
    .png({ compressionLevel: 9, effort: 10 }).toBuffer();
  if (buffer.length > maxBytes) throw Object.assign(new Error("Ideogram input exceeds 25 MB even after lossless compression. Use a smaller source image before generating."), { status: 400 });
  return { ...input, buffer, mimeType: "image/png", fileName: `ideogram-reference-${index + 1}.png` };
}

export async function generateIdeogram45({ images = [], mask, ...options }, { upload, subscribe, firstImage }) {
  if (images.length > (mask ? 4 : 5)) throw Object.assign(new Error("Ideogram 4.5 reference limit exceeded."), { status: 400 });
  buildIdeogram45Request({ ...options, imageUrls: images.map(() => "reference"), maskUrl: mask ? "mask" : "" });
  const inputs = [];
  for (const [index, image] of images.entries()) inputs.push(await prepareIdeogram45Upload(image, index));
  const maskInput = mask ? await prepareIdeogram45Upload({ buffer: mask, mimeType: "image/png", fileName: "ideogram-mask.png" }, images.length) : null;
  const imageUrls = await Promise.all(inputs.map((image, index) => upload(image, index)));
  const maskUrl = maskInput ? await upload(maskInput, images.length) : "";
  const request = buildIdeogram45Request({ ...options, imageUrls, maskUrl });
  const result = await subscribe(request.endpoint, { input: request.input, logs: true });
  const remoteImage = firstImage(result?.data);
  if (!remoteImage?.url) throw new Error("Fal returned no Ideogram 4.5 image. Check Fal history before rerunning.");
  return { ...request, remoteImage, provider: "fal.ai", requestId: result?.requestId || result?.request_id || "",
    cost: ideogram45UnpricedCost({ endpoint: request.endpoint, quality: request.input.quality }) };
}
