import { normalizeVideoOutpaintSettings, planVideoOutpaint, videoOutpaintFingerprint } from "../src/videoOutpaint.js";

export function createVideoOutpaintService({ resolveAsset, probeVideo, createTarget, runFfmpeg, statFile }) {
  async function prepare(body, sourceUrl) {
    if (!sourceUrl) throw new Error("Connect a source video before preparing outpainting.");
    const asset = await resolveAsset(sourceUrl);
    const metadata = await probeVideo(asset.filePath);
    const plan = planVideoOutpaint(metadata, body.videoOutpaint);
    const { width, height, sourceWidth, sourceHeight, left, top, fps, frames, settings } = plan;
    const padded = await createTarget(body, "outpaint-source", ".mp4", true);
    const mask = await createTarget(body, "outpaint-mask", ".mp4", true);
    const poster = await createTarget(body, "outpaint-canvas", ".png", true);
    const crop = plan.sourceCrop;
    const cropFilter = crop ? `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},` : "";
    const encode = ["-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
    await runFfmpeg(["-y", "-ss", String(settings.start), "-i", asset.filePath, "-vf", `fps=${fps},${cropFilter}scale=${sourceWidth}:${sourceHeight},setsar=1,pad=${width}:${height}:${left}:${top}:black`, "-frames:v", String(frames), ...encode, padded.filePath], "Prepare outpaint source", 120000);
    await runFfmpeg(["-y", "-f", "lavfi", "-i", `color=white:s=${width}x${height}:r=${fps}`, "-vf", `drawbox=x=${left}:y=${top}:w=${sourceWidth}:h=${sourceHeight}:color=black:t=fill`, "-frames:v", String(frames), ...encode, mask.filePath], "Prepare outpaint mask", 120000);
    await runFfmpeg(["-y", "-i", padded.filePath, "-frames:v", "1", poster.filePath], "Preview outpaint canvas", 30000);
    return { sourceUrl, videoUrl: padded.publicPath, maskVideoUrl: mask.publicPath, previewUrl: poster.publicPath, fingerprint: videoOutpaintFingerprint(sourceUrl, settings), plan };
  }
  async function finish(body, prepared, generated) {
    const plan = prepared.plan;
    const settings = normalizeVideoOutpaintSettings(plan.settings);
    const native = await probeVideo(generated.filePath);
    if (!Number.isFinite(Number(native.duration)) || Math.abs(Number(native.duration) - plan.duration) > 0.15) throw new Error("Generated timing differs from the source segment; the raw result was kept for review.");
    const source = await resolveAsset(prepared.sourceUrl);
    const target = await createTarget(body, "video-outpaint", ".mp4", false);
    const { outputWidth: w, outputHeight: h } = plan;
    const sw = Math.round(plan.sourceWidth / plan.width * w / 2) * 2;
    const sh = Math.round(plan.sourceHeight / plan.height * h / 2) * 2;
    const x = Math.round(plan.left / plan.width * w), y = Math.round(plan.top / plan.height * h);
    const feather = settings.feather;
    const alpha = feather > 0 ? `,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*min(1,min(min(X/${feather},(W-1-X)/${feather}),min(Y/${feather},(H-1-Y)/${feather})))'` : "";
    const filters = [`[0:v]fps=${plan.fps},scale=${w}:${h},setsar=1,setpts=PTS-STARTPTS[bg]`];
    const crop = plan.sourceCrop;
    const cropFilter = crop ? `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},` : "";
    if (settings.restoreSource) filters.push(`[1:v]fps=${plan.fps},${cropFilter}scale=${sw}:${sh},setsar=1,setpts=PTS-STARTPTS${alpha}[source]`, `[bg][source]overlay=${x}:${y}:shortest=1[out]`);
    await runFfmpeg(["-y", "-i", generated.filePath, "-ss", String(settings.start), "-i", source.filePath, "-filter_complex", filters.join(";"), "-map", settings.restoreSource ? "[out]" : "[bg]", "-map", "1:a?", "-t", String(plan.duration), "-frames:v", String(plan.frames), "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", target.filePath], "Finish video outpaint", 600000);
    const stat = await statFile(target.filePath);
    return { ...target, bytes: stat.size };
  }
  return { prepare, finish };
}
