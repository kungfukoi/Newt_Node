import { outpaintPreparationError, preparedOutpaintSettings } from "../src/outpaintPreparation.js";
import { normalizeVideoOutpaintSettings, planVideoOutpaint, videoOutpaintFingerprint } from "../src/videoOutpaint.js";
import { overlapBlendFilters, inspectFinishedBoundary } from "./outpaint-boundary.js";
import { suppliedCanvasGeometry, suppliedCanvasRatio } from "./outpaint-supplied-canvas.js";
import { alignOutpaintTiming } from "./outpaint-timing.js";
import { inspectOutpaintMotion } from "./outpaint-motion.js";
import { inspectExtensionColor, extensionColorFilter } from "./outpaint-color.js";
import path from "node:path";

export function createVideoOutpaintService({ resolveAsset, probeVideo, createTarget, runFfmpeg, statFile, reviewVisual, reportProgress = () => {} }) {
  async function prepare(body, sourceUrl, timing = {}) {
    const cached = body.videoOutpaintPrepared;
    if (cached && !body.forcePrepareOutpaint) {
      const error = outpaintPreparationError(cached, sourceUrl, body.canvasVideoUrl, normalizeVideoOutpaintSettings(body.videoOutpaint).model);
      if (error) throw new Error(error);
      const urls = [cached.sourceUrl, cached.videoUrl, cached.generationVideoUrl, cached.maskImageUrl, cached.maskVideoUrl, cached.loopedSourceUrl].filter(Boolean);
      try {
        for (const url of new Set(urls)) {
          const asset = await resolveAsset(url);
          if (!(await statFile(asset.filePath)).size) throw new Error("Empty asset");
        }
      } catch {
        throw new Error("The saved canvas has missing or unreadable files. Prepare a new canvas before running.");
      }
      reportProgress("Using the last prepared canvas…");
      return { ...cached, plan: { ...cached.plan, settings: preparedOutpaintSettings(cached, body.videoOutpaint) } };
    }
    const originalSourceUrl = sourceUrl;
    if (body.canvasVideoUrl) sourceUrl = body.canvasVideoUrl;
    if (!sourceUrl) throw new Error("Connect a source video before preparing outpainting.");
    const asset = await resolveAsset(sourceUrl);
    let metadata = await probeVideo(asset.filePath);
    if (body.videoOutpaint?.model === "seedance-2.5" && !(metadata.num_frames > 0 || metadata.frames > 0)) metadata = { ...metadata, ...await probeVideo(asset.filePath, { countFrames: true }) };
    if (body.videoOutpaint?.model === "seedance-2.5" && !(metadata.num_frames > 0 || metadata.frames > 0)) throw new Error("Could not count the source video frames. No generation was submitted; use a readable local video with a valid frame count.");
    const plan = planVideoOutpaint(metadata, body.canvasVideoUrl ? { ...body.videoOutpaint, frame: null, aspectRatio: suppliedCanvasRatio(metadata) } : body.videoOutpaint, timing);
    // New canvases share one explicit SDR working space. Retained raw jobs keep
    // their original plan and are never silently rebuilt or reinterpreted.
    plan.colorPipeline = { version: 1, matrix: "bt709", primaries: "bt709", transfer: "bt709", range: "tv", container: "mp4", codec: "h264" };
    const originalAsset = originalSourceUrl && originalSourceUrl !== sourceUrl ? await resolveAsset(originalSourceUrl) : asset;
    const originalMetadata = originalAsset === asset ? metadata : await probeVideo(originalAsset.filePath);
    plan.sourceFormat = { sourceUrl: originalSourceUrl || sourceUrl, extension: path.extname(originalAsset.filePath).toLowerCase(), codecName: originalMetadata.codecName || originalMetadata.codec_name || "", pixelFormat: originalMetadata.pixelFormat || originalMetadata.pix_fmt || "" };
    if (body.canvasVideoUrl) {
      const detected = await runFfmpeg(["-hide_banner", "-ss", String(plan.sourceStartSeconds ?? plan.settings.start), "-i", asset.filePath, "-t", String(plan.outputDuration || Math.min(plan.settings.duration, metadata.duration - plan.settings.start)), "-vf", "cropdetect=limit=24:round=2:reset=1:skip=0", "-an", "-f", "null", "-"], "Detect supplied canvas picture", 120000);
      Object.assign(plan, suppliedCanvasGeometry(metadata, plan, detected.stderr), { suppliedCanvas: true });
    }
    if (plan.tailPadded && Number.isInteger(timing.prerollFrames) && timing.prerollFrames >= 0) {
      if (Number.isInteger(timing.outputFrames) && timing.outputFrames > 0) {
        plan.outputFrames = timing.outputFrames;
        plan.sourceFps = timing.sourceFps || plan.fps;
        plan.sourceFrameRate = timing.sourceFrameRate || String(plan.sourceFps);
        plan.outputDuration = timing.outputDuration || plan.outputFrames / plan.sourceFps;
      }
      plan.prerollFrames = timing.prerollFrames;
      plan.frames = Math.max(4 * plan.fps, plan.prerollFrames + plan.outputFrames + Math.ceil(0.5 * plan.fps));
      // Retained raw media must use its original submission clock, not today's
      // frame-grid preparation policy.
      if (Number.isInteger(timing.frames) && timing.frames >= plan.prerollFrames + plan.outputFrames) plan.frames = timing.frames;
      plan.duration = plan.frames / plan.fps;
      plan.loopFrames = plan.frames; plan.loopDuration = plan.duration;
    }
    const { width, height, sourceWidth, sourceHeight, left, top, fps, frames, settings } = plan;
    const padded = await createTarget(body, "outpaint-source", ".mp4", true);
    const maskIsImage = settings.model === "seedance-2.5";
    const mask = await createTarget(body, "outpaint-mask", maskIsImage ? ".png" : ".mp4", true);
    const poster = await createTarget(body, "outpaint-canvas", ".png", true);
    const crop = plan.sourceCrop;
    const cropFilter = crop ? `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},` : "";
    const colorTags = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];
    const normalizeColor = "scale=out_color_matrix=bt709:out_range=tv,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709";
    const encode = ["-an", "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", ...colorTags, "-movflags", "+faststart"];
    let preparedSource = asset.filePath;
    let sourceStart = plan.sourceStartSeconds ?? settings.start;
    let loopedSourceUrl;
    if (plan.looped) {
      const segment = await createTarget(body, "outpaint-loop-segment", ".mp4", true);
      const loopedSource = await createTarget(body, "outpaint-loop-source", ".mp4", true);
      const withAudio = ["-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"];
      await runFfmpeg(["-y", "-ss", String(settings.start), "-i", asset.filePath, "-map", "0:v:0", "-map", "0:a?", "-vf", `fps=${fps},setsar=1`, "-af", `apad,atrim=duration=${plan.loopDuration},asetpts=PTS-STARTPTS`, "-t", String(plan.loopDuration), "-frames:v", String(plan.loopFrames), ...withAudio, segment.filePath], "Prepare short outpaint segment", 120000);
      await runFfmpeg(["-y", "-i", segment.filePath, "-map", "0:v:0", "-map", "0:a?", "-vf", `loop=loop=-1:size=${plan.loopFrames}:start=0,setpts=N/(${fps}*TB)`, "-af", `aresample=48000,apad,atrim=duration=${plan.loopDuration},aloop=loop=-1:size=${Math.round(plan.loopDuration * 48000)},asetpts=N/SR/TB`, "-t", String(plan.duration), "-frames:v", String(frames), ...withAudio, loopedSource.filePath], "Loop short outpaint source", 120000);
      preparedSource = loopedSource.filePath;
      sourceStart = 0;
      loopedSourceUrl = loopedSource.publicPath;
    }
    const repeat = settings.repeatCount > 1 ? `loop=loop=${settings.repeatCount - 1}:size=${plan.outputFrames}:start=0,setpts=N/(${fps}*TB),` : "";
    const temporalPad = plan.tailPadded ? `trim=end_frame=${plan.outputFrames},setpts=PTS-STARTPTS,${repeat}tpad=start_mode=clone:start_duration=${settings.repeatCount > 1 ? 0 : (plan.prerollFrames || 0) / fps}:stop_mode=clone:stop_duration=${plan.duration},` : "";
    await runFfmpeg(["-y", "-ss", String(sourceStart), "-i", preparedSource, "-vf", `${plan.sourceFps ? `setpts=N/(${fps}*TB),` : ""}fps=${fps},${temporalPad}${cropFilter}scale=${sourceWidth}:${sourceHeight},${normalizeColor},setsar=1,pad=${width}:${height}:${left}:${top}:black`, "-frames:v", String(frames), ...encode, padded.filePath], "Prepare outpaint source", 120000);
    if (settings.model === "seedance-2.5" && (await statFile(padded.filePath)).size > 200 * 1024 * 1024) throw new Error("The full-resolution Seedance canvas exceeds the provider's 200 MB input limit. Choose a shorter source segment before generating.");
    // Reserve real generated pixels beneath the inward source-edge feather.
    const overlap = settings.restoreSource ? Math.ceil(settings.feather * width / plan.outputWidth) : 0;
    const ml = left > 0 ? Math.min(overlap, Math.floor(sourceWidth / 2) - 1) : 0;
    const mr = left + sourceWidth < width ? Math.min(overlap, Math.floor(sourceWidth / 2) - 1) : 0;
    const mt = top > 0 ? Math.min(overlap, Math.floor(sourceHeight / 2) - 1) : 0;
    const mb = top + sourceHeight < height ? Math.min(overlap, Math.floor(sourceHeight / 2) - 1) : 0;
    let generationVideo;
    if (maskIsImage) {
      plan.generationPaddingColor = "green";
      plan.generationOverlap = { left: ml, right: mr, top: mt, bottom: mb };
      plan.generationContentRect = { x: left + ml, y: top + mt, width: sourceWidth - ml - mr, height: sourceHeight - mt - mb };
      generationVideo = await createTarget(body, "outpaint-generation-canvas", ".mp4", true);
      const { x: cx, y: cy, width: cw, height: ch } = plan.generationContentRect;
      const regions = [[0, 0, width, cy], [0, cy + ch, width, height - cy - ch], [0, cy, cx, ch], [cx + cw, cy, width - cx - cw, ch]];
      const bands = regions.filter(([, , w, h]) => w > 0 && h > 0).map(([x, y, w, h]) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=0x00ff00:t=fill`);
      // drawbox's named RGB colors use 601 YUV coefficients. Draw in that
      // matrix, then convert values back to 709; merely tagging them is wrong.
      const greenCanvas = `scale=out_color_matrix=bt601,setparams=colorspace=smpte170m,${bands.join(",") || "null"},scale=in_color_matrix=bt601:out_color_matrix=bt709:out_range=tv,setparams=colorspace=bt709`;
      await runFfmpeg(["-y", "-i", padded.filePath, "-vf", greenCanvas, "-frames:v", String(frames), ...encode, generationVideo.filePath], "Prepare Seedance green padding and inward overlap", 120000);
      if ((await statFile(generationVideo.filePath)).size > 200 * 1024 * 1024) throw new Error("The generation canvas exceeds the provider's 200 MB input limit. Choose a shorter source segment.");
    }
    await runFfmpeg(["-y", "-f", "lavfi", "-i", `color=white:s=${width}x${height}:r=${fps}`, "-vf", `drawbox=x=${left + ml}:y=${top + mt}:w=${sourceWidth - ml - mr}:h=${sourceHeight - mt - mb}:color=black:t=fill`, "-frames:v", maskIsImage ? "1" : String(frames), ...(maskIsImage ? [] : [...encode, "-crf", "0"]), mask.filePath], "Prepare local outpaint mask", 120000);
    let analysisMask;
    if (!maskIsImage) {
      // VACE's preprocessed input uses neutral gray for unknown pixels, including
      // the inward overlap. Keep the original canvas for analysis/restoration.
      generationVideo = await createTarget(body, "outpaint-vace-conditioning", ".mp4", true);
      const cx = left + ml, cy = top + mt, cw = sourceWidth - ml - mr, ch = sourceHeight - mt - mb;
      const regions = [[0, 0, width, cy], [0, cy + ch, width, height - cy - ch], [0, cy, cx, ch], [cx + cw, cy, width - cx - cw, ch]];
      const bands = regions.filter(([, , w, h]) => w > 0 && h > 0).map(([x, y, w, h]) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=0x7f7f7f:t=fill`);
      await runFfmpeg(["-y", "-i", padded.filePath, "-vf", bands.join(",") || "null", "-frames:v", String(frames), ...encode, generationVideo.filePath], "Prepare VACE neutral-gray conditioning", 120000);
      analysisMask = await createTarget(body, "outpaint-analysis-mask", ".png", true);
      await runFfmpeg(["-y", "-i", mask.filePath, "-frames:v", "1", analysisMask.filePath], "Prepare VACE analysis mask", 30000);
    }
    await runFfmpeg(["-y", "-i", generationVideo?.filePath || padded.filePath, "-frames:v", "1", poster.filePath], "Preview outpaint canvas", 30000);
    return { sourceUrl, ...(body.canvasVideoUrl ? { canvasVideoUrl: body.canvasVideoUrl } : {}), ...(loopedSourceUrl ? { loopedSourceUrl } : {}), videoUrl: padded.publicPath, ...(generationVideo ? { generationVideoUrl: generationVideo.publicPath } : {}), ...(maskIsImage ? { maskImageUrl: mask.publicPath } : { maskVideoUrl: mask.publicPath, maskImageUrl: analysisMask.publicPath }), previewUrl: poster.publicPath, fingerprint: videoOutpaintFingerprint(originalSourceUrl || "", body.videoOutpaint, body.canvasVideoUrl), plan };
  }
  async function finish(body, prepared, generated) {
    reportProgress("Finish: Blending the original source overlap…");
    const submissionPlan = prepared.plan;
    const settings = normalizeVideoOutpaintSettings(submissionPlan.settings);
    const allRepeats = submissionPlan.tailPadded && settings.repeatCount > 1 && settings.keepAllRepeats;
    const deliveryFrames = allRepeats ? submissionPlan.frames : submissionPlan.outputFrames;
    const deliveryFps = submissionPlan.sourceFps || submissionPlan.fps;
    const deliveryFrameRate = submissionPlan.sourceFrameRate || String(deliveryFps);
    const checkedPlan = allRepeats ? { ...submissionPlan, prerollFrames: 0, outputFrames: deliveryFrames, outputDuration: deliveryFrames / deliveryFps } : submissionPlan;
    const plan = checkedPlan.tailPadded ? { ...checkedPlan, fps: deliveryFps, frames: checkedPlan.outputFrames, duration: checkedPlan.outputFrames / deliveryFps } : checkedPlan;
    const native = await probeVideo(generated.filePath);
    const seedance = settings.model === "seedance-2.5";
    let preroll = (plan.prerollFrames || 0) / submissionPlan.fps;
    let temporalAlignment = { applied: false, offsetFrames: 0 };
    let motionValidation;
    if (seedance && submissionPlan.tailPadded && settings.restoreSource && prepared.videoUrl) {
      const reference = await resolveAsset(prepared.videoUrl);
      temporalAlignment = allRepeats ? { applied: false, offsetFrames: 0, reason: "Debug output preserves all repeats from frame zero" } : await alignOutpaintTiming({ referencePath: reference.filePath, generatedPath: generated.filePath, plan: submissionPlan, runFfmpeg });
      preroll += temporalAlignment.offsetFrames / submissionPlan.fps;
      reportProgress("Finish: Checking source motion and boundary correspondence in every frame…");
      motionValidation = await inspectOutpaintMotion({ referencePath: reference.filePath, generatedPath: generated.filePath, plan: checkedPlan, offset: temporalAlignment.offsetFrames, runFfmpeg });
      if (temporalAlignment.status === "needs_review") {
        motionValidation.status = "needs_review";
        motionValidation.reason = temporalAlignment.reason + ". " + motionValidation.reason;
      }
    }
    if (!Number.isFinite(Number(native.duration)) || (submissionPlan.tailPadded ? Number(native.duration) + 0.5 / submissionPlan.fps < preroll + plan.frames / submissionPlan.fps : Math.abs(Number(native.duration) - plan.duration) > (seedance ? 0.35 : 0.15))) throw new Error("Generated timing does not cover the source segment; the raw result was kept instead of freezing or repeating delivery frames.");
    if (seedance && Math.abs(Number(native.width) / Number(native.height) - plan.width / plan.height) > 0.02) throw new Error("Seedance changed the canvas aspect ratio; the raw result was kept for review.");
    const source = await resolveAsset(prepared.loopedSourceUrl || prepared.sourceUrl);
    const sourceMetadata = await probeVideo(source.filePath);
    const sourceMatrix = sourceMetadata.colorSpace || sourceMetadata.color_space;
    // Unspecified legacy SD sources retain their conventional 601 YUV values.
    const matrix = submissionPlan.colorPipeline?.matrix || (["bt709", "bt470bg", "smpte170m"].includes(sourceMatrix) ? sourceMatrix : "smpte170m");
    const mp4Delivery = submissionPlan.colorPipeline?.container === "mp4";
    const deliveryExtension = mp4Delivery ? ".mp4" : ".mov";
    const sourceStart = prepared.loopedSourceUrl ? 0 : submissionPlan.sourceStartSeconds ?? settings.start;
    // Rejected candidates are dependencies, never the requested export target.
    const motionRejected = !allRepeats && motionValidation?.status === "needs_review";
    const checkSeams = seedance && settings.restoreSource && plan.needsOutpaint;
    let target = await createTarget(body, motionRejected ? "outpaint-motion-candidate" : checkSeams ? "outpaint-finish-candidate" : "video-outpaint", deliveryExtension, motionRejected || checkSeams);
    const { outputWidth: w, outputHeight: h } = plan;
    const sw = Math.round(plan.sourceWidth / plan.width * w / 2) * 2;
    const sh = Math.round(plan.sourceHeight / plan.height * h / 2) * 2;
    const x = Math.round(plan.left / plan.width * w), y = Math.round(plan.top / plan.height * h);
    const overlapWidth = Math.max(0, Math.min(settings.feather, Math.floor(sw / 2) - 1, Math.floor(sh / 2) - 1));
    const feather = settings.restoreSource && plan.needsOutpaint ? overlapWidth : 0;
    let colorMatching = { requested: settings.matchExtensionColor, applied: false, reason: "Extension color matching is disabled" };
    if (seedance && settings.matchExtensionColor && feather > 0 && prepared.videoUrl) {
      reportProgress("Finish: Matching extension color to corresponding source surfaces…");
      try {
        const reference = await resolveAsset(prepared.videoUrl);
        colorMatching = await inspectExtensionColor({ referencePath: reference.filePath, generatedPath: generated.filePath, plan: checkedPlan, offset: temporalAlignment.offsetFrames, runFfmpeg });
      } catch {
        colorMatching = { requested: true, applied: false, reason: "Color analysis unavailable; source restoration and ungraded extension retained" };
      }
    } else if (settings.matchExtensionColor) colorMatching.reason = "Color matching requires Seedance, source restoration and a nonzero overlap";
    const colorFilter = extensionColorFilter(colorMatching, { w, h, sw, sh, x, y });
    const crop = plan.sourceCrop;
    const cropFilter = crop ? `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},` : "";
    // RGB matching drops YUV matrix metadata. Convert it back explicitly before
    // overlaying the BT.709 source; otherwise FFmpeg may mix 601 and 709 values.
    const compositeColor = `format=yuv444p10le,setparams=range=limited:color_primaries=${matrix}:color_trc=${matrix === "bt470bg" ? "gamma28" : matrix}:colorspace=${matrix}`;
    const filters = [`[0:v]fps=${submissionPlan.fps},${seedance && !submissionPlan.tailPadded ? "tpad=stop_mode=clone:stop_duration=0.35," : ""}scale=${w}:${h},${colorFilter},scale=out_color_matrix=${matrix}:out_range=tv,${compositeColor},setsar=1,${submissionPlan.sourceFps ? `settb=AVTB,setpts=N/(${deliveryFrameRate}*TB)` : "setpts=PTS-STARTPTS"}[bg]`];
    const repeatSource = allRepeats ? `trim=end_frame=${submissionPlan.outputFrames},setpts=PTS-STARTPTS,loop=loop=${settings.repeatCount - 1}:size=${submissionPlan.outputFrames}:start=0,setpts=N/(${plan.fps}*TB),tpad=stop_mode=clone:stop_duration=${plan.duration},` : "";
    const repeatAudio = allRepeats ? ["-af", `atrim=duration=${submissionPlan.outputDuration},asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=duration=${submissionPlan.outputDuration},aloop=loop=${settings.repeatCount - 1}:size=${Math.round(submissionPlan.outputDuration * 48000)},asetpts=N/SR/TB,apad,atrim=duration=${plan.duration}`] : [];
    if (settings.restoreSource) {
      // Decode the original plate, never the black padded conditioning canvas.
      filters.push(`[1:v]fps=${plan.fps},${repeatSource}${cropFilter}scale=${sw}:${sh}:out_color_matrix=${matrix}:out_range=tv,${compositeColor},setsar=1,${submissionPlan.sourceFps ? `settb=AVTB,setpts=N/(${deliveryFrameRate}*TB)` : "setpts=PTS-STARTPTS"}[source]`);
      filters.push(...overlapBlendFilters({ w, h, sw, sh, x, y, feather }));
    }
    const deliveryEncode = mp4Delivery
      ? ["-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "320k"]
      : ["-c:v", "prores_ks", "-profile:v", "5", "-pix_fmt", "yuv444p10le", "-c:a", "pcm_s24le"];
    await runFfmpeg(["-y", ...(preroll ? ["-ss", String(preroll)] : []), "-i", generated.filePath, "-ss", String(sourceStart), "-i", source.filePath, "-filter_complex", filters.join(";"), "-map", settings.restoreSource ? "[out]" : "[bg]", "-map", "1:a?", ...repeatAudio, "-t", String(plan.duration), "-frames:v", String(plan.frames), "-r", deliveryFrameRate, ...deliveryEncode, "-colorspace", matrix, "-color_primaries", matrix, "-color_trc", matrix === "bt470bg" ? "gamma28" : matrix, "-color_range", "tv", "-movflags", "+faststart", target.filePath], "Blend source overlap and finish video outpaint", 600000);
    let seamValidation;
    if (checkSeams) {
      reportProgress("Finish: Checking the finished color joins in every frame…");
      seamValidation = await inspectFinishedBoundary({ filePath: target.filePath, plan, runFfmpeg });
      if ((!motionRejected && seamValidation.status !== "needs_review") || allRepeats) {
        const accepted = await createTarget(body, "video-outpaint", deliveryExtension, false);
        await runFfmpeg(["-y", "-i", target.filePath, "-map", "0", "-c", "copy", "-movflags", "+faststart", accepted.filePath], "Retain checked outpaint master", 120000);
        target = accepted;
      }
    }
    const stat = await statFile(target.filePath);
    const issues = [temporalAlignment.status === "needs_review" && temporalAlignment.reason, motionValidation?.status === "needs_review" && `${motionValidation.flaggedFrames} frames failed source correspondence; ${motionValidation.coverage?.missingFillFrames || 0} frames have possible unfilled outer bands`, seamValidation?.status === "needs_review" && "Finished edge seams need review"].filter(Boolean).join(". ");
    const warning = allRepeats ? `Debug outpaint: all ${settings.repeatCount} copies and the held tail are retained from frame zero for inspection.${issues ? " " + issues + "." : ""}` : issues ? `Outpaint needs review: ${issues}. The candidate and paid raw result are retained; this candidate cannot replace an accepted Output.` : "";
    return { ...target, bytes: stat.size, outputFormat: mp4Delivery ? "H.264 MP4 (BT.709 SDR)" : "ProRes 4444 XQ MOV (10-bit processing)", mimeType: mp4Delivery ? "video/mp4" : "video/quicktime", warning,
      matching: { finishVersion: 3, requested: colorMatching.requested, applied: colorMatching.applied, colorMatching, repeatOutput: allRepeats ? "all" : "last", deliveredFrames: plan.frames, deliveredFps: deliveryFps, deliveredFrameRate: deliveryFrameRate, temporalAlignment, motionValidation, seamValidation, localApplied: feather > 0, blendWidth: feather, colorFalloffWidth: 0, overlapLimit: overlapWidth, registration: { applied: false },
        method: colorMatching.applied ? "Shot-stable extension color matching followed by smooth inward source overlap" : "Smooth inward source overlap; generated background outside the original rectangle is unchanged",
        sourcePolicy: settings.restoreSource ? "Original core is fully opaque. Only the authorized inward edge overlap mixes generated pixels; working-space conversion, delivery scaling and encoding still apply." : "Source restoration is disabled." },
      qc: { status: "off", flags: [], segments: [] } };

  }
  return { prepare, finish };
}
