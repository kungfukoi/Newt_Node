import { buildFlux3MaxRequest } from "../src/flux3Max.js";

export async function generateFlux3Max(body, { isManagedUrl, upload, subscribe }) {
  let endpoint, input;
  try { ({ endpoint, input } = buildFlux3MaxRequest(body)); }
  catch (error) { error.status = 400; throw error; }
  const frames = input.keyframes || [];
  for (const frame of frames) {
    if (!isManagedUrl(frame.image_url)) throw Object.assign(new Error("FLUX 3 Max frames must be managed local images."), { status: 400 });
  }
  if (input.keyframes) {
    for (const frame of input.keyframes) frame.image_url = await upload(frame.image_url);
  }
  const result = await subscribe(endpoint, { input, logs: true });
  if (!result?.data?.video?.url) throw new Error("Fal returned no FLUX 3 Max video. Check Fal history before rerunning.");
  return { endpoint, input, result, remoteVideo: result.data.video };
}
