import { buildKling4Request, kling4Cost } from "../src/kling4.js";

export async function generateKling4(body, provider, { isManagedUrl, upload, subscribe, atlasGenerate, quoteInput = async () => null }) {
  const { endpoint, input } = buildKling4Request(body, provider);
  const fields = provider === "atlas" ? ["image", "last_image", "middle_images"] : ["start_image_url", "end_image_url", "middle_image_urls"];
  for (const field of fields) {
    for (const url of [input[field]].flat().filter(Boolean)) {
      if (!isManagedUrl(url)) throw Object.assign(new Error("Kling 4.0 keyframes must be managed local images."), { status: 400 });
    }
  }
  for (const field of fields) {
    if (Array.isArray(input[field])) input[field] = await Promise.all(input[field].map(upload));
    else if (input[field]) input[field] = await upload(input[field]);
  }
  let result, remoteVideo, quote;
  if (provider === "atlas") {
    quote = await quoteInput(input).catch(() => null);
    result = await atlasGenerate(input);
    remoteVideo = result.url ? { url: result.url, content_type: "video/mp4" } : null;
  } else {
    result = await subscribe(endpoint, { input, logs: true });
    remoteVideo = result?.data?.video;
  }
  if (!remoteVideo?.url) throw Object.assign(new Error("Kling 4.0 returned no video. Check provider history before rerunning."), { status: 502 });
  return { endpoint, input, result, remoteVideo, cost: { ...kling4Cost(endpoint, input.duration), ...quote } };
}

export function kling4HistorySettings(body, provider, input) {
  return { provider, route: "image-to-video", duration: input.duration, resolution: input.resolution, aspectRatio: "source image",
    startFrameCount: 1, endFrameCount: body.endFrameUrls?.length || 0, middleImageCount: body.referenceImageUrls?.length || 0,
    referenceImageCount: body.referenceImageUrls?.length || 0, referenceImageNames: body.referenceImageLabels || [],
    audioControl: "not exposed by provider", startFrameUrls: body.startFrameUrls, endFrameUrls: body.endFrameUrls || [], middleImageUrls: body.referenceImageUrls || [] };
}
