import { buildIdeogram45Request, ideogram45UnpricedCost } from "../src/ideogram45.js";

export async function generateIdeogram45({ images = [], mask, ...options }, { upload, subscribe, firstImage }) {
  if (images.length > (mask ? 4 : 5)) throw Object.assign(new Error("Ideogram 4.5 reference limit exceeded."), { status: 400 });
  buildIdeogram45Request({ ...options, imageUrls: images.map(() => "reference"), maskUrl: mask ? "mask" : "" });
  const imageUrls = await Promise.all(images.map((image, index) => upload(Buffer.isBuffer(image)
    ? { buffer: image, mimeType: "image/png", fileName: `ideogram-reference-${index + 1}.png` } : image, index)));
  const maskUrl = mask ? await upload({ buffer: mask, mimeType: "image/png", fileName: "ideogram-mask.png" }, images.length) : "";
  const request = buildIdeogram45Request({ ...options, imageUrls, maskUrl });
  const result = await subscribe(request.endpoint, { input: request.input, logs: true });
  const remoteImage = firstImage(result?.data);
  if (!remoteImage?.url) throw new Error("Fal returned no Ideogram 4.5 image. Check Fal history before rerunning.");
  return { ...request, remoteImage, provider: "fal.ai", requestId: result?.requestId || result?.request_id || "",
    cost: ideogram45UnpricedCost({ endpoint: request.endpoint, quality: request.input.quality }) };
}
