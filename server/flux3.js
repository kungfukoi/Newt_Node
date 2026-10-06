import sharp from "sharp";
import { buildFlux3Request, estimateFlux3Cost } from "../src/flux3.js";

export async function prepareFlux3Reference(image) {
  const buffer = Buffer.isBuffer(image) ? image : image?.buffer;
  const source = sharp(buffer, { limitInputPixels: 24000000, animated: false, failOn: "error" }).rotate();
  const normalized = await source.png().toBuffer();
  const { width, height } = await sharp(normalized).metadata();
  const scale = Math.min(Math.max(1, 256 / Math.min(width, height)), Math.sqrt(4000000 / (width * height)));
  const w = Math.floor(width * scale), h = Math.floor(height * scale);
  if (Math.min(w, h) < 256) throw new Error("This reference is too narrow for Flux 3. Crop it before generating.");
  return { buffer: await sharp(normalized).resize(w, h, { fit: "fill" }).png().toBuffer(), mimeType: "image/png", fileName: "flux3-reference.png" };
}

export async function generateFlux3({ images = [], mask, ...options }, { upload, subscribe, firstImage }) {
  const sources = mask ? [...images, mask] : images;
  // Validate every control and image before uploading or submitting any work.
  buildFlux3Request({ ...options, imageUrls: sources.map(() => "https://reference.invalid/image.png") });
  const prepared = await Promise.all(sources.map(prepareFlux3Reference));
  const imageUrls = [];
  for (const [index, image] of prepared.entries()) imageUrls.push(await upload(image, index));
  const request = buildFlux3Request({ ...options, imageUrls });
  const result = await subscribe(request.endpoint, { input: request.input, logs: true });
  const remoteImage = firstImage(result?.data);
  if (!remoteImage?.url) throw new Error("Fal returned no Flux 3 image. Check Fal history before rerunning.");
  return { ...request, remoteImage, provider: "fal.ai", requestId: result?.requestId || result?.request_id || "",
    cost: estimateFlux3Cost({ endpoint: request.endpoint, resolution: request.input.resolution }) };
}
