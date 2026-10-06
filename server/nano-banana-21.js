import { buildNanoBanana21Request, estimateNanoBanana21Cost } from "../src/nanoBanana21.js";

export async function generateNanoBanana21({ images = [], mask, ...options }, { upload, subscribe, firstImage }) {
  // The API has no native mask: the final reference is a selection guide.
  const sources = mask ? [...images, mask] : images;
  buildNanoBanana21Request({ ...options, imageUrls: sources.map(() => "https://reference.invalid/image.png") });
  const imageUrls = [];
  for (const [index, image] of sources.entries()) {
    imageUrls.push(await upload(Buffer.isBuffer(image) ? { buffer: image, mimeType: "image/png", fileName: `nano-banana-21-reference-${index + 1}.png` } : image, index));
  }
  const request = buildNanoBanana21Request({ ...options, imageUrls });
  const result = await subscribe(request.endpoint, { input: request.input, logs: true });
  const remoteImage = firstImage(result?.data);
  if (!remoteImage?.url) throw new Error("Fal returned no Nano Banana 2.1 image. Check Fal history before rerunning.");
  return { ...request, remoteImage, resultText: result?.data?.description || "", provider: "fal.ai",
    requestId: result?.requestId || result?.request_id || "",
    cost: estimateNanoBanana21Cost({ endpoint: request.endpoint, resolution: request.input.resolution }) };
}
