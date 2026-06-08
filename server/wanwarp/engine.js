import path from "node:path";
import { File } from "node:buffer";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const comfyBaseUrl = (process.env.WANWARP_COMFY_URL || "http://127.0.0.1:8188").replace(/\/+$/, "");
const defaultComfyTimeoutMs = 4 * 60 * 60 * 1000;
const comfyPollIntervalMs = 2000;
const templatePath = new URL("./templates/creator-locked-seg-a.json", import.meta.url);
const fullTemplatePath = new URL("./templates/creator-locked-full.json", import.meta.url);
const blendRefineTemplatePath = new URL("./templates/wanblend-refine.json", import.meta.url);
const wanWarpOutputNodeId = "2590";
const wanWarpFullOutputNodeId = "3138";
const wanWarpBlendRefineOutputNodeId = "3138";

const imageMimeTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);
const comfySchedulerOptions = new Set(["simple", "sgm_uniform", "karras", "exponential", "ddim_uniform", "beta", "normal", "linear_quadratic", "kl_optimal", "bong_tangent", "beta57"]);
const comfyUpscaleMethodOptions = new Set(["nearest-exact", "bilinear", "area", "bicubic", "lanczos"]);
const comfyCropOptions = new Set(["disabled", "center"]);
const comfyImageBlendModeOptions = new Set(["normal", "multiply", "screen", "overlay", "soft_light", "difference"]);
const creatorDefaultKeyTrimFrames = 5;
const creatorDefaultBlendFrames = 4;
const creatorDefaultSamplerSteps = 2;
const creatorDefaultSamplerStepsToRun = 1;
const creatorDefaultCrf = 6;
const wanBlendRefineLegacyStrengthSchedule = "0.45, 0.55#20, 0.45";
const wanBlendRefinePreserveDefaults = {
  refineDenoise: 0.3,
  controlBlend: 0.05,
  depthMotionBlend: 0.04,
  vaceRefStrength: 1
};
const wanBlendRefinePreviousDefaults = {
  refineDenoise: 0.45,
  controlBlend: 0.12,
  depthMotionBlend: 0.1,
  vaceRefStrength: 0.75
};
const wanBlendRefineDefaultStrengthCurve = [
  { x: 0, y: 0.45, mode: "ease" },
  { x: 0.5, y: 0.55, mode: "ease" },
  { x: 1, y: 0.45, mode: "ease" }
];
const creatorDefaultLoraStrengths = {
  distillHigh: 2,
  distillLow: 1,
  motionHigh: 1.5,
  motionLow: 0.5
};
const fullWorkflowSharkSamplerNodeIds = ["2588", "3624", "3715", "3799"];
const highModelLoraLoaderNodeId = "2632";
const lowModelLoraLoaderNodeId = "2633";

export async function createWanWarpFullWorkflowResult({
  body,
  segments = [],
  selectedVideoModel = null,
  helpers
}) {
  const requestId = randomUUID();
  const options = normalizeWanWarpOptions(body.transitionBuilder || {}, body);
  const stitchOptions = body.videoStitch && typeof body.videoStitch === "object" ? body.videoStitch : {};
  const loop = Boolean(stitchOptions.loop);
  const wanBlendVideoUrl = isNewtLocalAssetUrl(stitchOptions.wanBlendVideoUrl) ? stitchOptions.wanBlendVideoUrl : "";
  const usesWanBlendKeyframes = Boolean(wanBlendVideoUrl);
  const wanBlendFrameIndices = normalizeWanBlendFrameIndices(stitchOptions.wanBlendFrameIndices);
  const orderedSegments = normalizeFullWorkflowSegments(segments, loop);
  const segmentA = orderedSegments.find((segment) => segment.role === "A");
  const segmentB = orderedSegments.find((segment) => segment.role === "B");
  const segmentC = orderedSegments.find((segment) => segment.role === "C");
  const segmentD = orderedSegments.find((segment) => segment.role === "D");

  if (!segmentA) {
    const error = new Error("WanWarp requires a connected WanSegment A.");
    error.status = 400;
    throw error;
  }
  if (!usesWanBlendKeyframes && (!segmentA.startImageUrl || !segmentA.endImageUrl)) {
    const error = new Error("WanSegment A requires Start and End images.");
    error.status = 400;
    throw error;
  }
  const motionVideoUrl = segmentA.motionVideoUrl || firstSegmentValue(orderedSegments, "motionVideoUrl");
  const depthVideoUrl = segmentA.depthVideoUrl || firstSegmentValue(orderedSegments, "depthVideoUrl") || process.env.WANWARP_DEPTH_VIDEO_PATH || "";
  if (!motionVideoUrl) {
    const error = new Error("WanWarp requires a Motion Map video from WanSegment A.");
    error.status = 400;
    throw error;
  }
  if (!depthVideoUrl) {
    const error = new Error("WanWarp requires a Depth Video from WanSegment A.");
    error.status = 400;
    throw error;
  }
  if (!usesWanBlendKeyframes && segmentB && !segmentB.endImageUrl) {
    const error = new Error("WanSegment B requires an End image.");
    error.status = 400;
    throw error;
  }
  if (segmentC && !segmentB) {
    const error = new Error("WanSegment C requires WanSegment B.");
    error.status = 400;
    throw error;
  }
  if (!usesWanBlendKeyframes && segmentC && !segmentC.endImageUrl) {
    const error = new Error("WanSegment C requires an End image.");
    error.status = 400;
    throw error;
  }
  if (loop && (!segmentB || !segmentC || !segmentD)) {
    const receivedRoles = orderedSegments.map((segment) => segment.role).join(", ") || "none";
    const error = new Error(`WanWarp loop mode requires WanSegments A, B, C, and D. Received: ${receivedRoles}.`);
    error.status = 400;
    throw error;
  }

  await assertComfyAvailable();

  const localAssetTasks = [
    usesWanBlendKeyframes ? Promise.resolve(null) : helpers.resolveLocalAssetPathFromUrl(segmentA.startImageUrl),
    usesWanBlendKeyframes ? Promise.resolve(null) : helpers.resolveLocalAssetPathFromUrl(segmentA.endImageUrl),
    !usesWanBlendKeyframes && segmentB?.endImageUrl ? helpers.resolveLocalAssetPathFromUrl(segmentB.endImageUrl) : Promise.resolve(null),
    !usesWanBlendKeyframes && segmentC?.endImageUrl ? helpers.resolveLocalAssetPathFromUrl(segmentC.endImageUrl) : Promise.resolve(null),
    helpers.resolveLocalAssetPathFromUrl(motionVideoUrl),
    isNewtLocalAssetUrl(depthVideoUrl)
      ? helpers.resolveLocalAssetPathFromUrl(depthVideoUrl)
      : Promise.resolve({ filePath: depthVideoUrl, fileName: path.basename(depthVideoUrl) }),
    usesWanBlendKeyframes ? helpers.resolveLocalAssetPathFromUrl(wanBlendVideoUrl) : Promise.resolve(null)
  ];
  const [startImage, endAImage, endBImage, endCImage, motionVideo, depthVideo, wanBlendVideo] = await Promise.all(localAssetTasks);
  const [comfyStartImage, comfyEndAImage, comfyEndBImage, comfyEndCImage] = await Promise.all([
    startImage ? uploadImageToComfy(startImage.filePath, startImage.fileName) : Promise.resolve(""),
    endAImage ? uploadImageToComfy(endAImage.filePath, endAImage.fileName) : Promise.resolve(""),
    endBImage ? uploadImageToComfy(endBImage.filePath, endBImage.fileName) : Promise.resolve(""),
    endCImage ? uploadImageToComfy(endCImage.filePath, endCImage.fileName) : Promise.resolve("")
  ]);

  const comfyPrompt = await buildFullComfyPrompt({
    requestId,
    segments: { A: segmentA, B: segmentB, C: segmentC, D: segmentD },
    loop,
    options,
    startImageName: comfyStartImage,
    endAImageName: comfyEndAImage,
    endBImageName: comfyEndBImage,
    endCImageName: comfyEndCImage,
    motionVideoPath: motionVideo.filePath,
    depthVideoPath: depthVideo.filePath,
    wanBlendVideoPath: wanBlendVideo?.filePath || "",
    wanBlendFrameIndices
  });

  const queued = await queueComfyPrompt(comfyPrompt, requestId);
  const history = await waitForComfyPrompt(queued.prompt_id || queued.promptId);
  const comfyVideo = findComfyVideo(history, wanWarpFullOutputNodeId);
  if (!comfyVideo) {
    const error = new Error("Comfy completed WanWarp but returned no final video.");
    error.status = 502;
    error.raw = history?.outputs || history;
    throw error;
  }

  const output = await helpers.createManagedAssetTarget({ body }, "wanwarp", "mp4", helpers.workflowPackageOutputDirName);
  await copyComfyVideoToOutput(comfyVideo, output.filePath);
  const segmentVideoSpecs = fullWorkflowSegmentOutputSpecs({ hasB: Boolean(segmentB), hasC: Boolean(segmentC), loop: Boolean(loop && segmentD) });
  const segmentVideos = [];
  for (const spec of segmentVideoSpecs) {
    const comfySegmentVideo = findComfyVideo(history, spec.outputNodeId);
    if (!comfySegmentVideo) continue;
    const segmentOutput = await helpers.createManagedAssetTarget({ body }, `wansegment-${spec.role.toLowerCase()}`, "mp4", helpers.workflowPackageOutputDirName);
    await copyComfyVideoToOutput(comfySegmentVideo, segmentOutput.filePath);
    const [segmentStats, segmentMetadata] = await Promise.all([
      stat(segmentOutput.filePath),
      helpers.probeVideoFile(segmentOutput.filePath)
    ]);
    segmentVideos.push({
      item: helpers.enrichVideoMetadata(
        {
          type: "video",
          label: `Segment ${spec.role}`,
          localUrl: segmentOutput.publicPath,
          fileName: segmentOutput.fileName,
          mimeType: "video/mp4"
        },
        segmentMetadata
      ),
      bytes: segmentStats.size
    });
  }
  const [outputStats, metadata] = await Promise.all([
    stat(output.filePath),
    helpers.probeVideoFile(output.filePath)
  ]);
  const video = helpers.enrichVideoMetadata(
    {
      type: "video",
      label: "WanWarp",
      localUrl: output.publicPath,
      fileName: output.fileName,
      mimeType: "video/mp4",
      seed: segmentA.seed || options.seed || null
    },
    metadata
  );
  const text = loop ? "WanWarp generated the locked ComfyUI A/B/C/D loop workflow." : "WanWarp generated the locked ComfyUI segment workflow.";
  const cost = {
    amountUsd: 0,
    currency: "USD",
    unitRateUsd: 0,
    units: 1,
    unit: "local ComfyUI workflow",
    mediaType: "video",
    pricingBasis: "Local ComfyUI WanWarp run",
    pricingSource: "local-comfyui"
  };

  await helpers.appendHistory({
    id: requestId,
    createdAt: new Date().toISOString(),
    mediaType: "video",
    provider: "local-comfyui",
    modelName: selectedVideoModel?.displayName || "WanWarp",
    endpoint: "local/wanwarp/comfyui/creator-full",
    mode: loop ? "WanWarp locked creator A/B/C/D loop" : "WanWarp locked creator segments",
    prompt: orderedSegments.map((segment) => `${segment.role}: ${segment.prompt}`).join("\n\n"),
    submittedPrompt: orderedSegments.map((segment) => `${segment.role}: ${segment.prompt}`).join("\n\n"),
    project: helpers.projectFromBody(body),
    node: helpers.nodeFromBody(body),
    settings: {
      model: selectedVideoModel?.displayName || "WanWarp",
      comfyUrl: comfyBaseUrl,
      comfyPromptId: queued.prompt_id || queued.promptId || "",
      outputNodeId: wanWarpFullOutputNodeId,
      segmentRoles: orderedSegments.map((segment) => segment.role),
      loop,
      motionVideoUrl,
      depthVideoUrl,
      wanBlendVideoUrl,
      wanBlendFrameIndices,
      fps: options.fps,
      width: options.width,
      height: options.height,
      length: options.length,
      renderLength: fullWorkflowRenderLength(options),
      keyTrimFrames: options.keyTrimFrames,
      blendFrames: options.blendFrames,
      samplerSteps: options.samplerSteps,
      samplerStepsToRun: options.samplerStepsToRun,
      loraStrengths: options.loraStrengths,
      crf: options.crf,
      workflow: "creator-locked-full"
    },
    cost,
    localVideo: video.localUrl,
    localVideos: [video.localUrl, ...segmentVideos.map((segment) => segment.item.localUrl)],
    outputFileName: video.fileName,
    outputFileNames: [video.fileName, ...segmentVideos.map((segment) => segment.item.fileName)],
    outputLabels: [video.label, ...segmentVideos.map((segment) => segment.item.label)],
    outputBytes: outputStats.size + segmentVideos.reduce((sum, segment) => sum + segment.bytes, 0),
    text
  });

  return {
    requestId,
    endpoint: "local/wanwarp/comfyui/creator-full",
    modelName: selectedVideoModel?.displayName || "WanWarp",
    text,
    cost,
    video,
    videos: [video, ...segmentVideos.map((segment) => segment.item)],
    resultItems: [video, ...segmentVideos.map((segment) => segment.item)]
  };
}

export async function createWanWarpBlendRefineResult({
  body,
  prompt = "",
  referenceVideoUrls = [],
  controlVideoUrls = [],
  maskVideoUrls = [],
  selectedVideoModel = null,
  helpers
}) {
  const requestId = randomUUID();
  const promptText = String(prompt || body.prompt || "").trim();
  const stitchOptions = body.videoStitch && typeof body.videoStitch === "object" ? body.videoStitch : {};
  const wanBlendVideoUrl = isNewtLocalAssetUrl(stitchOptions.wanBlendVideoUrl)
    ? stitchOptions.wanBlendVideoUrl
    : helpers.firstLocalOutput(referenceVideoUrls);
  const motionVideoUrl = isNewtLocalAssetUrl(stitchOptions.motionVideoUrl)
    ? stitchOptions.motionVideoUrl
    : helpers.firstLocalOutput(controlVideoUrls);
  const depthVideoUrl = isNewtLocalAssetUrl(stitchOptions.depthVideoUrl)
    ? stitchOptions.depthVideoUrl
    : helpers.firstLocalOutput(maskVideoUrls);

  if (!promptText) {
    const error = new Error("WanWarp Blend Refine requires a prompt.");
    error.status = 400;
    throw error;
  }
  if (!wanBlendVideoUrl) {
    const error = new Error("WanWarp Blend Refine requires a connected WanBlend/reference video.");
    error.status = 400;
    throw error;
  }
  if (!motionVideoUrl) {
    const error = new Error("WanWarp Blend Refine requires a connected Motion Map video.");
    error.status = 400;
    throw error;
  }
  if (!depthVideoUrl) {
    const error = new Error("WanWarp Blend Refine requires a connected Depth Video.");
    error.status = 400;
    throw error;
  }

  await assertComfyAvailable();

  const [wanBlendVideo, motionVideo, depthVideo] = await Promise.all([
    helpers.resolveLocalAssetPathFromUrl(wanBlendVideoUrl),
    helpers.resolveLocalAssetPathFromUrl(motionVideoUrl),
    helpers.resolveLocalAssetPathFromUrl(depthVideoUrl)
  ]);
  const [wanBlendMetadata, motionMetadata, depthMetadata] = await Promise.all([
    helpers.probeVideoFile(wanBlendVideo.filePath),
    helpers.probeVideoFile(motionVideo.filePath),
    helpers.probeVideoFile(depthVideo.filePath)
  ]);
  const sourceFrameCount = videoFrameCountFromMetadata(wanBlendMetadata);
  const sourceFps = positiveNumber(wanBlendMetadata?.fps);
  const options = normalizeWanBlendSampledCreatorOptions(body.videoStitch || {}, body, {
    sourceFrameCount,
    sourceFps,
    motionFrameCount: videoFrameCountFromMetadata(motionMetadata),
    depthFrameCount: videoFrameCountFromMetadata(depthMetadata)
  });

  const comfyPrompt = await buildSampledCreatorComfyPrompt({
    requestId,
    prompt: promptText,
    negativePrompt: options.negativePrompt,
    options,
    wanBlendVideoPath: wanBlendVideo.filePath,
    motionVideoPath: motionVideo.filePath,
    depthVideoPath: depthVideo.filePath
  });

  const queued = await queueComfyPrompt(comfyPrompt, requestId);
  const history = await waitForComfyPrompt(queued.prompt_id || queued.promptId);
  const comfyVideo = findComfyVideo(history, wanWarpBlendRefineOutputNodeId);
  if (!comfyVideo) {
    const error = new Error("Comfy completed WanWarp Blend Refine but returned no final video.");
    error.status = 502;
    error.raw = history?.outputs || history;
    throw error;
  }

  const output = await helpers.createManagedAssetTarget({ body }, "wanwarp-sampled-creator", "mp4", helpers.workflowPackageOutputDirName);
  await copyComfyVideoToOutput(comfyVideo, output.filePath);
  const [outputStats, metadata] = await Promise.all([
    stat(output.filePath),
    helpers.probeVideoFile(output.filePath)
  ]);
  const video = helpers.enrichVideoMetadata(
    {
      type: "video",
      label: "WanWarp Sampled Creator",
      localUrl: output.publicPath,
      fileName: output.fileName,
      mimeType: "video/mp4",
      seed: options.seed ?? null
    },
    metadata
  );
  const text = "WanWarp rebuilt a WanBlend video with sampled creator-style motion/depth segments.";
  const cost = {
    amountUsd: 0,
    currency: "USD",
    unitRateUsd: 0,
    units: 1,
    unit: "local ComfyUI workflow",
    mediaType: "video",
    pricingBasis: "Local ComfyUI WanWarp Blend Refine run",
    pricingSource: "local-comfyui"
  };

  await helpers.appendHistory({
    id: requestId,
    createdAt: new Date().toISOString(),
    mediaType: "video",
    provider: "local-comfyui",
    modelName: selectedVideoModel?.displayName || "WanWarp",
    endpoint: "local/wanwarp/comfyui/wanblend-sampled-creator",
    mode: "WanWarp WanBlend sampled creator rebuild",
    prompt: promptText,
    submittedPrompt: promptText,
    project: helpers.projectFromBody(body),
    node: helpers.nodeFromBody(body),
    settings: {
      model: selectedVideoModel?.displayName || "WanWarp",
      comfyUrl: comfyBaseUrl,
      comfyPromptId: queued.prompt_id || queued.promptId || "",
      outputNodeId: wanWarpBlendRefineOutputNodeId,
      wanBlendVideoUrl,
      motionVideoUrl,
      depthVideoUrl,
      sourceFrameCount,
      sourceFps,
      fps: options.fps,
      width: options.width,
      height: options.height,
      length: options.length,
      loop: options.loop,
      sampledSegmentCount: options.sampledSegmentCount,
      sampledFrameIndices: options.sampledFrameIndices,
      controlRepeat: options.controlRepeat,
      samplerSteps: options.samplerSteps,
      samplerStepsToRun: options.samplerStepsToRun,
      conditioningStrength: options.conditioningStrength,
      strengthCurve: options.strengthCurve,
      strengthSchedule: options.strengthSchedule,
      loraStrengths: options.loraStrengths,
      crf: options.crf,
      workflow: "wanblend-sampled-creator"
    },
    cost,
    localVideo: video.localUrl,
    localVideos: [video.localUrl],
    outputFileName: video.fileName,
    outputFileNames: [video.fileName],
    outputLabels: [video.label],
    outputBytes: outputStats.size,
    text
  });

  return {
    requestId,
    endpoint: "local/wanwarp/comfyui/wanblend-sampled-creator",
    modelName: selectedVideoModel?.displayName || "WanWarp",
    text,
    cost,
    video,
    videos: [video],
    resultItems: [video]
  };
}

export async function createWanWarpComfyResult({
  body,
  referenceImageUrls = [],
  startImageUrl: explicitStartImageUrl = "",
  startFramesUrl: explicitStartFramesUrl = "",
  endImageUrl: explicitEndImageUrl = "",
  maskVideoUrl = "",
  depthVideoUrl = "",
  selectedVideoModel = null,
  helpers
}) {
  // TODO legacy cleanup: retained for the earlier single-segment Comfy runner while WanSegment/WanWarp stabilizes.
  const requestId = randomUUID();
  const prompt = String(body.prompt || "").trim();
  const startFramesUrl = helpers.firstLocalOutput([explicitStartFramesUrl]);
  const startImageUrl = helpers.firstLocalOutput([explicitStartImageUrl]) || (!startFramesUrl ? helpers.firstLocalOutput(referenceImageUrls) : "");
  const endImageUrl =
    helpers.firstLocalOutput([explicitEndImageUrl]) ||
    helpers.firstLocalOutput(startImageUrl ? referenceImageUrls.slice(1) : referenceImageUrls);

  if (!startImageUrl && !startFramesUrl) {
    const error = new Error("WanWarp requires a Start image or Start handoff clip.");
    error.status = 400;
    throw error;
  }
  if (!endImageUrl) {
    const error = new Error("WanWarp requires a connected End keyframe image.");
    error.status = 400;
    throw error;
  }
  if (!maskVideoUrl) {
    const error = new Error("WanWarp requires a connected black and white motion video.");
    error.status = 400;
    throw error;
  }
  if (!depthVideoUrl && !process.env.WANWARP_DEPTH_VIDEO_PATH) {
    const error = new Error("WanWarp requires a connected depth video.");
    error.status = 400;
    throw error;
  }
  if (!prompt) {
    const error = new Error("WanWarp requires a morph prompt.");
    error.status = 400;
    throw error;
  }

  await assertComfyAvailable();

  const [startImage, endImage, maskVideo, depthVideo, startFramesVideo] = await Promise.all([
    startImageUrl ? helpers.resolveLocalAssetPathFromUrl(startImageUrl) : Promise.resolve(null),
    helpers.resolveLocalAssetPathFromUrl(endImageUrl),
    helpers.resolveLocalAssetPathFromUrl(maskVideoUrl),
    depthVideoUrl ? helpers.resolveLocalAssetPathFromUrl(depthVideoUrl) : Promise.resolve(null),
    startFramesUrl ? helpers.resolveLocalAssetPathFromUrl(startFramesUrl) : Promise.resolve(null)
  ]);

  const [comfyStartImage, comfyEndImage] = await Promise.all([
    startImage ? uploadImageToComfy(startImage.filePath, startImage.fileName) : Promise.resolve(""),
    uploadImageToComfy(endImage.filePath, endImage.fileName)
  ]);

  const options = normalizeWanWarpOptions(body.transitionBuilder || {}, body);
  const comfyPrompt = await buildComfyPrompt({
    requestId,
    prompt,
    negativePrompt: options.negativePrompt,
    seed: options.seed,
    fps: options.fps,
    width: options.width,
    height: options.height,
    length: options.length,
    conditioningStrength: options.conditioningStrength,
    strengthSchedule: options.strengthSchedule,
    vaceRefStrengthFirst: options.vaceRefStrengthFirst,
    vaceRefStrengthSecond: options.vaceRefStrengthSecond,
    handoffFrames: options.handoffFrames,
    samplerSteps: options.samplerSteps,
    samplerStepsToRun: options.samplerStepsToRun,
    loraStrengths: options.loraStrengths,
    crf: options.crf,
    startImageName: comfyStartImage || comfyEndImage,
    endImageName: comfyEndImage,
    startFramesPath: startFramesVideo?.filePath || "",
    maskVideoPath: maskVideo.filePath,
    depthVideoPath: depthVideo?.filePath || process.env.WANWARP_DEPTH_VIDEO_PATH || ""
  });

  const queued = await queueComfyPrompt(comfyPrompt, requestId);
  const history = await waitForComfyPrompt(queued.prompt_id || queued.promptId);
  const comfyVideo = findComfyVideo(history, wanWarpOutputNodeId);
  if (!comfyVideo) {
    const error = new Error("Comfy completed WanWarp but returned no video.");
    error.status = 502;
    error.raw = history?.outputs || history;
    throw error;
  }

  const output = await helpers.createManagedAssetTarget({ body }, "wanwarp", "mp4", helpers.workflowPackageOutputDirName);
  await copyComfyVideoToOutput(comfyVideo, output.filePath);
  const [outputStats, metadata] = await Promise.all([
    stat(output.filePath),
    helpers.probeVideoFile(output.filePath)
  ]);
  const endFrameTime = Math.max(0, Number(metadata.duration || 0) - 1 / Math.max(1, Number(metadata.fps || options.fps || 16)));
  const endFrameOutput = await helpers.createVideoFrameOutputFromFile({
    body,
    sourcePath: output.filePath,
    kind: "wanwarp-end-frame",
    frameTime: endFrameTime
  });
  const frameCount = Math.max(1, Math.round(Number(metadata.num_frames || options.length || 0)) || options.length);
  const endFramesStart = Math.max(0, frameCount - (options.handoffFrames + 1));
  const endFramesOutput = await helpers.createVideoClipOutputFromFile({
    body,
    sourcePath: output.filePath,
    kind: "wanwarp-end-frames",
    startFrame: endFramesStart,
    frameCount: options.handoffFrames,
    fps: metadata.fps || options.fps,
    outputFormat: "mp4"
  });

  const video = helpers.enrichVideoMetadata(
    {
      type: "video",
      label: "WanWarp Segment A",
      localUrl: output.publicPath,
      fileName: output.fileName,
      mimeType: "video/mp4",
      seed: options.seed ?? null
    },
    metadata
  );
  const endFrame = {
    type: "image",
    label: "End Frame",
    localUrl: endFrameOutput.publicPath,
    url: endFrameOutput.publicPath,
    fileName: endFrameOutput.fileName,
    mimeType: endFrameOutput.mimeType
  };
  const endFrames = helpers.enrichVideoMetadata(
    {
      type: "video",
      label: "End Frames",
      localUrl: endFramesOutput.publicPath,
      fileName: endFramesOutput.fileName,
      mimeType: endFramesOutput.mimeType,
      seed: options.seed ?? null
    },
    endFramesOutput.metadata
  );

  const text = "WanWarp generated a local ComfyUI Segment A morph.";
  const cost = null;
  await helpers.appendHistory({
    id: requestId,
    createdAt: new Date().toISOString(),
    mediaType: "video",
    provider: "local-comfyui",
    modelName: selectedVideoModel?.displayName || "WanWarp",
    endpoint: "local/wanwarp/comfyui/creator-seg-a",
    mode: "WanWarp local ComfyUI creator Segment A",
    prompt,
    submittedPrompt: prompt,
    project: helpers.projectFromBody(body),
    node: helpers.nodeFromBody(body),
    settings: {
      model: selectedVideoModel?.displayName || "WanWarp",
      comfyUrl: comfyBaseUrl,
      comfyPromptId: queued.prompt_id || queued.promptId || "",
      outputNodeId: wanWarpOutputNodeId,
      startImageUrl,
      startFramesUrl: startFramesUrl || null,
      endImageUrl,
      maskVideoUrl,
      depthVideoUrl: depthVideoUrl || null,
      depthVideoPath: depthVideo?.filePath || process.env.WANWARP_DEPTH_VIDEO_PATH || null,
      negativePrompt: options.negativePrompt,
      fps: options.fps,
      width: options.width,
      height: options.height,
      length: options.length,
      conditioningStrength: options.conditioningStrength,
      strengthSchedule: options.strengthSchedule,
      vaceRefStrengthFirst: options.vaceRefStrengthFirst,
      vaceRefStrengthSecond: options.vaceRefStrengthSecond,
      handoffFrames: options.handoffFrames,
      samplerSteps: options.samplerSteps,
      samplerStepsToRun: options.samplerStepsToRun,
      loraStrengths: options.loraStrengths,
      crf: options.crf,
      handoffStartFrame: endFramesStart,
      seed: options.seed ?? null,
      workflow: "creator-locked-seg-a"
    },
    cost,
    localVideo: video.localUrl,
    localVideos: [video.localUrl, endFrames.localUrl],
    localImage: endFrame.localUrl,
    localImages: [endFrame.localUrl],
    outputFileName: video.fileName,
    outputFileNames: [video.fileName, endFrames.fileName, endFrame.fileName],
    outputLabels: [video.label, endFrames.label, endFrame.label],
    outputBytes: outputStats.size + endFramesOutput.bytes + endFrameOutput.bytes,
    text
  });

  return {
    requestId,
    endpoint: "local/wanwarp/comfyui/creator-seg-a",
    modelName: selectedVideoModel?.displayName || "WanWarp",
    text,
    cost,
    video,
    videos: [video, endFrames],
    image: endFrame,
    images: [endFrame],
    resultItems: [video, endFrames, endFrame]
  };
}

async function buildComfyPrompt({
  requestId,
  prompt,
  negativePrompt,
  seed,
  fps,
  width,
  height,
  length,
  conditioningStrength,
  strengthSchedule,
  vaceRefStrengthFirst,
  vaceRefStrengthSecond,
  handoffFrames,
  samplerSteps = creatorDefaultSamplerSteps,
  samplerStepsToRun = creatorDefaultSamplerStepsToRun,
  loraStrengths = creatorDefaultLoraStrengths,
  crf = creatorDefaultCrf,
  startImageName,
  endImageName,
  startFramesPath,
  maskVideoPath,
  depthVideoPath
}) {
  const comfyPrompt = JSON.parse(await readFile(templatePath, "utf8"));
  comfyPrompt["3021"].inputs.image = startImageName;
  comfyPrompt["3022"].inputs.image = endImageName;
  comfyPrompt["2969"].inputs.video = JSON.stringify(maskVideoPath);
  if (depthVideoPath) {
    comfyPrompt["2653"].inputs.video = JSON.stringify(depthVideoPath);
  }
  delete comfyPrompt["2969"].inputs.vae;
  delete comfyPrompt["2653"].inputs.vae;
  comfyPrompt["2564"].inputs.text = prompt;
  comfyPrompt["3038"].inputs.text = negativePrompt;
  comfyPrompt["2703"].inputs.value = seed ?? Math.floor(Math.random() * 2147483647);
  comfyPrompt["2732"].inputs.conditioning_to_strength = conditioningStrength;
  comfyPrompt["2739"].inputs.string = strengthSchedule;
  comfyPrompt["2555"].inputs.vace_ref_strength = vaceRefStrengthFirst;
  comfyPrompt["2581"].inputs.vace_ref_strength = vaceRefStrengthSecond;
  if (startFramesPath) {
    patchStartFramesHandoff(comfyPrompt, startFramesPath, handoffFrames);
  } else {
    comfyPrompt["3147"].inputs.value = 2;
  }
  comfyPrompt["2588"].inputs.scheduler = "beta";
  comfyPrompt["2588"].inputs.steps = samplerSteps;
  comfyPrompt["2588"].inputs.steps_to_run = samplerStepsToRun;
  comfyPrompt["2588"].inputs.denoise = 1;
  comfyPrompt["2588"].inputs.cfg = 1;
  patchLoraLoaderStrengths(comfyPrompt, loraStrengths);
  comfyPrompt["2752"].inputs.upscale_method = "lanczos";
  comfyPrompt["3000"].inputs.upscale_method = "lanczos";
  comfyPrompt["3143"].inputs.value = width;
  comfyPrompt["3144"].inputs.value = height;
  comfyPrompt["3145"].inputs.value = length;
  comfyPrompt[wanWarpOutputNodeId].inputs.filename_prefix = `wanwarp-${requestId}`;
  comfyPrompt[wanWarpOutputNodeId].inputs.frame_rate = fps;
  comfyPrompt[wanWarpOutputNodeId].inputs.crf = crf;
  comfyPrompt[wanWarpOutputNodeId].inputs.save_output = true;
  sanitizeComfyPromptInputs(comfyPrompt);
  return comfyPrompt;
}

async function buildFullComfyPrompt({
  requestId,
  segments,
  loop,
  options,
  startImageName,
  endAImageName,
  endBImageName,
  endCImageName,
  motionVideoPath,
  depthVideoPath,
  wanBlendVideoPath = "",
  wanBlendFrameIndices = [0, 17, 35, 52]
}) {
  const comfyPrompt = JSON.parse(await readFile(fullTemplatePath, "utf8"));
  if (wanBlendVideoPath) {
    patchFullWorkflowWanBlendKeyframes(comfyPrompt, {
      videoPath: wanBlendVideoPath,
      frameIndices: wanBlendFrameIndices,
      widthNodeId: "3143",
      heightNodeId: "3144"
    });
  } else {
    comfyPrompt["3021"].inputs.image = startImageName;
    comfyPrompt["3022"].inputs.image = endAImageName;
    if (segments.B && endBImageName) comfyPrompt["3638"].inputs.image = endBImageName;
    if (segments.C && endCImageName) comfyPrompt["3754"].inputs.image = endCImageName;
  }

  comfyPrompt["2969"].inputs.video = JSON.stringify(motionVideoPath);
  comfyPrompt["2653"].inputs.video = JSON.stringify(depthVideoPath);
  delete comfyPrompt["2969"].inputs.vae;
  delete comfyPrompt["2653"].inputs.vae;

  patchFullSegment(comfyPrompt, "A", segments.A, {
    positiveNodeId: "2564",
    negativeNodeId: "3038",
    conditioningNodeId: "2732",
    scheduleNodeId: "2739",
    seedNodeId: "2703",
    refFirstNodeId: "2555",
    refSecondNodeId: "2581"
  });
  if (segments.B) {
    patchFullSegment(comfyPrompt, "B", segments.B, {
      positiveNodeId: "3647",
      negativeNodeId: "3631",
      conditioningNodeId: "3633",
      scheduleNodeId: "3646",
      seedNodeId: "3635",
      refFirstNodeId: "3630",
      refSecondNodeId: "3649"
    });
  }
  if (segments.C) {
    patchFullSegment(comfyPrompt, "C", segments.C, {
      positiveNodeId: "3785",
      negativeNodeId: "3721",
      conditioningNodeId: "3723",
      scheduleNodeId: "3786",
      seedNodeId: "3791",
      refFirstNodeId: "3789",
      refSecondNodeId: "3790"
    });
  }
  if (loop && segments.D) {
    patchFullSegment(comfyPrompt, "D", segments.D, {
      positiveNodeId: "3864",
      negativeNodeId: "3865",
      conditioningNodeId: "3869",
      scheduleNodeId: "3866",
      seedNodeId: "3867",
      refFirstNodeId: "3858",
      refSecondNodeId: "3859"
    });
  }

  comfyPrompt["3143"].inputs.value = options.width;
  comfyPrompt["3144"].inputs.value = options.height;
  comfyPrompt["3145"].inputs.value = fullWorkflowRenderLength(options);
  if (comfyPrompt["3415"]?.inputs) comfyPrompt["3415"].inputs.value = options.blendFrames;
  if (comfyPrompt["3417"]?.inputs) comfyPrompt["3417"].inputs.value = options.keyTrimFrames;
  patchFullWorkflowSamplerSettings(comfyPrompt, options);
  patchLoraLoaderStrengths(comfyPrompt, options.loraStrengths);
  comfyPrompt[wanWarpFullOutputNodeId].inputs.filename_prefix = `wanwarp-${requestId}`;
  comfyPrompt[wanWarpFullOutputNodeId].inputs.frame_rate = options.fps;
  comfyPrompt[wanWarpFullOutputNodeId].inputs.crf = options.crf;
  comfyPrompt[wanWarpFullOutputNodeId].inputs.save_output = true;
  comfyPrompt[wanWarpFullOutputNodeId].inputs.images = fullWorkflowOutputImagesInput({
    hasB: Boolean(segments.B),
    hasC: Boolean(segments.C),
    loop: Boolean(loop && segments.D)
  });
  fullWorkflowSegmentOutputSpecs({ hasB: Boolean(segments.B), hasC: Boolean(segments.C), loop: Boolean(loop && segments.D) })
    .forEach((spec) => {
      comfyPrompt[spec.outputNodeId] = {
        inputs: {
          images: [spec.imageNodeId, 0],
          vae: ["571", 0],
          filename_prefix: `wanwarp-${requestId}-SEG_${spec.role}`,
          frame_rate: options.fps,
          loop_count: 0,
          format: "video/h264-mp4",
          pix_fmt: "yuv420p",
          crf: options.crf,
          save_metadata: false,
          trim_to_audio: false,
          pingpong: false,
          save_output: true
        },
        class_type: "VHS_VideoCombine"
      };
    });
  sanitizeComfyPromptInputs(comfyPrompt);
  return comfyPrompt;
}

async function buildSampledCreatorComfyPrompt({
  requestId,
  prompt,
  negativePrompt,
  options,
  wanBlendVideoPath,
  motionVideoPath,
  depthVideoPath
}) {
  const comfyPrompt = JSON.parse(await readFile(fullTemplatePath, "utf8"));
  const segment = {
    prompt,
    negativePrompt,
    conditioningStrength: options.conditioningStrength,
    strengthSchedule: options.strengthSchedule,
    seed: options.seed
  };

  comfyPrompt["2969"].inputs.video = JSON.stringify(motionVideoPath);
  comfyPrompt["2653"].inputs.video = JSON.stringify(depthVideoPath);
  delete comfyPrompt["2969"].inputs.vae;
  delete comfyPrompt["2653"].inputs.vae;
  if (comfyPrompt["2919"]?.inputs) comfyPrompt["2919"].inputs.amount = options.controlRepeat;

  patchFullSegment(comfyPrompt, "A", segment, {
    positiveNodeId: "2564",
    negativeNodeId: "3038",
    conditioningNodeId: "2732",
    scheduleNodeId: "2739",
    seedNodeId: "2703",
    refFirstNodeId: "2555",
    refSecondNodeId: "2581"
  });
  patchFullSegment(comfyPrompt, "B", segment, {
    positiveNodeId: "3647",
    negativeNodeId: "3631",
    conditioningNodeId: "3633",
    scheduleNodeId: "3646",
    seedNodeId: "3635",
    refFirstNodeId: "3630",
    refSecondNodeId: "3649"
  });
  patchFullSegment(comfyPrompt, "C", segment, {
    positiveNodeId: "3785",
    negativeNodeId: "3721",
    conditioningNodeId: "3723",
    scheduleNodeId: "3786",
    seedNodeId: "3791",
    refFirstNodeId: "3789",
    refSecondNodeId: "3790"
  });
  if (options.loop) {
    patchFullSegment(comfyPrompt, "D", segment, {
      positiveNodeId: "3864",
      negativeNodeId: "3865",
      conditioningNodeId: "3869",
      scheduleNodeId: "3866",
      seedNodeId: "3867",
      refFirstNodeId: "3858",
      refSecondNodeId: "3859"
    });
  }

  comfyPrompt["3143"].inputs.value = options.width;
  comfyPrompt["3144"].inputs.value = options.height;
  comfyPrompt["3145"].inputs.value = fullWorkflowRenderLength(options);
  if (comfyPrompt["3415"]?.inputs) comfyPrompt["3415"].inputs.value = options.blendFrames;
  if (comfyPrompt["3417"]?.inputs) comfyPrompt["3417"].inputs.value = options.keyTrimFrames;
  patchFullWorkflowSamplerSettings(comfyPrompt, options);
  patchLoraLoaderStrengths(comfyPrompt, options.loraStrengths);

  const keyframeRefs = patchSampledWanBlendKeyframes(comfyPrompt, {
    videoPath: wanBlendVideoPath,
    frameIndices: options.sampledFrameIndices,
    widthNodeId: "3143",
    heightNodeId: "3144"
  });

  const openSegmentCount = options.loop ? Math.max(1, options.sampledSegmentCount - 1) : options.sampledSegmentCount;
  let finalImages = sampledCreatorBaseOutputRef(openSegmentCount);
  let previousSegmentOutput = sampledCreatorBaseSegmentOutputRef(Math.min(openSegmentCount - 1, 2));
  for (let segmentIndex = 3; segmentIndex < openSegmentCount; segmentIndex += 1) {
    const kind = segmentIndex % 2 === 1 ? "B" : "C";
    const cloned = cloneSampledCreatorMiddleSegment(comfyPrompt, {
      kind,
      segmentIndex,
      previousSegmentOutput,
      keyframeRef: keyframeRefs[segmentIndex + 1],
      seed: options.seed
    });
    finalImages = appendSampledCreatorBlend(comfyPrompt, {
      segmentIndex,
      currentOutput: finalImages,
      nextSegmentOutput: cloned.output
    });
    previousSegmentOutput = cloned.output;
  }
  if (options.loop) {
    finalImages = wireSampledCreatorLoopClose(comfyPrompt, {
      currentOutput: finalImages,
      previousSegmentOutput,
      segmentCount: options.sampledSegmentCount
    });
  }

  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.filename_prefix = `wanwarp-sampled-creator-${requestId}`;
  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.frame_rate = options.fps;
  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.crf = options.crf;
  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.save_output = true;
  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.images = finalImages;
  sanitizeComfyPromptInputs(comfyPrompt);
  return comfyPrompt;
}

async function buildBlendRefineComfyPrompt({
  requestId,
  prompt,
  negativePrompt,
  options,
  wanBlendVideoPath,
  motionVideoPath,
  depthVideoPath
}) {
  const comfyPrompt = JSON.parse(await readFile(blendRefineTemplatePath, "utf8"));

  comfyPrompt["9200"].inputs.video = JSON.stringify(wanBlendVideoPath);
  comfyPrompt["2969"].inputs.video = JSON.stringify(motionVideoPath);
  comfyPrompt["2653"].inputs.video = JSON.stringify(depthVideoPath);
  delete comfyPrompt["2969"].inputs.vae;
  delete comfyPrompt["2653"].inputs.vae;

  comfyPrompt["2564"].inputs.text = prompt;
  comfyPrompt["3038"].inputs.text = negativePrompt;
  comfyPrompt["2732"].inputs.conditioning_to_strength = options.conditioningStrength;
  comfyPrompt["2739"].inputs.string = options.strengthSchedule;
  comfyPrompt["2703"].inputs.value = options.seed ?? Math.floor(Math.random() * 2147483647);
  comfyPrompt["3143"].inputs.value = options.width;
  comfyPrompt["3144"].inputs.value = options.height;
  comfyPrompt["3145"].inputs.value = options.length;
  comfyPrompt["2581"].inputs.vace_ref_strength = options.vaceRefStrength;
  comfyPrompt["2555"].inputs.vace_ref_strength = options.vaceRefStrength;
  comfyPrompt["2581"].inputs.vace_reference = ["9205", 0];
  comfyPrompt["2555"].inputs.vace_reference = ["9205", 0];
  delete comfyPrompt["2581"].inputs.latent_in;
  delete comfyPrompt["9204"];
  comfyPrompt["2588"].inputs.scheduler = "beta";
  comfyPrompt["2588"].inputs.steps = options.samplerSteps;
  comfyPrompt["2588"].inputs.steps_to_run = options.samplerStepsToRun;
  comfyPrompt["2588"].inputs.denoise = options.refineDenoise;
  comfyPrompt["2588"].inputs.cfg = 1;
  comfyPrompt["9202"].inputs.blend_factor = options.depthMotionBlend;
  comfyPrompt["9203"].inputs.blend_factor = options.controlBlend;
  comfyPrompt["9203"].inputs.blend_mode = options.controlBlendMode;
  comfyPrompt["9200"].inputs.frame_load_cap = options.frameLoadCap;
  comfyPrompt["2969"].inputs.frame_load_cap = options.frameLoadCap;
  comfyPrompt["2653"].inputs.frame_load_cap = options.frameLoadCap;
  patchLoraLoaderStrengths(comfyPrompt, options.loraStrengths);
  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.filename_prefix = `wanwarp-blend-refine-${requestId}`;
  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.frame_rate = options.fps;
  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.crf = options.crf;
  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.save_output = true;
  comfyPrompt[wanWarpBlendRefineOutputNodeId].inputs.images = ["2559", 0];
  sanitizeComfyPromptInputs(comfyPrompt);
  return comfyPrompt;
}

function patchFullWorkflowWanBlendKeyframes(comfyPrompt, { videoPath, frameIndices, widthNodeId, heightNodeId }) {
  const [startIndex, endAIndex, endBIndex, endCIndex] = frameIndices;
  comfyPrompt["9200"] = {
    inputs: {
      video: JSON.stringify(videoPath),
      force_rate: 0,
      custom_width: 0,
      custom_height: 0,
      frame_load_cap: 0,
      skip_first_frames: 0,
      select_every_nth: 1,
      format: "None"
    },
    class_type: "VHS_LoadVideoPath"
  };
  comfyPrompt["9201"] = {
    inputs: {
      image: ["9200", 0],
      width: [widthNodeId, 0],
      height: [heightNodeId, 0],
      upscale_method: "lanczos",
      crop: "center"
    },
    class_type: "ImageScale"
  };
  comfyPrompt["9202"] = {
    inputs: {
      image: ["9201", 0],
      start: startIndex,
      length: 1
    },
    class_type: "ImageFromBatch+"
  };
  comfyPrompt["9203"] = {
    inputs: {
      image: ["9201", 0],
      start: endAIndex,
      length: 1
    },
    class_type: "ImageFromBatch+"
  };
  comfyPrompt["9204"] = {
    inputs: {
      image: ["9201", 0],
      start: endBIndex,
      length: 1
    },
    class_type: "ImageFromBatch+"
  };
  comfyPrompt["9205"] = {
    inputs: {
      image: ["9201", 0],
      start: endCIndex,
      length: 1
    },
    class_type: "ImageFromBatch+"
  };

  comfyPrompt["3035"].inputs.image = ["9202", 0];
  comfyPrompt["3023"].inputs.image = ["9203", 0];
  if (comfyPrompt["3641"]?.inputs) comfyPrompt["3641"].inputs.image = ["9204", 0];
  if (comfyPrompt["3727"]?.inputs) comfyPrompt["3727"].inputs.image = ["9205", 0];

  delete comfyPrompt["3021"];
  delete comfyPrompt["3022"];
  delete comfyPrompt["3638"];
  delete comfyPrompt["3754"];
}

function patchSampledWanBlendKeyframes(comfyPrompt, { videoPath, frameIndices, widthNodeId, heightNodeId }) {
  comfyPrompt["9200"] = {
    inputs: {
      video: JSON.stringify(videoPath),
      force_rate: 0,
      custom_width: 0,
      custom_height: 0,
      frame_load_cap: 0,
      skip_first_frames: 0,
      select_every_nth: 1,
      format: "None"
    },
    class_type: "VHS_LoadVideoPath"
  };
  comfyPrompt["9201"] = {
    inputs: {
      image: ["9200", 0],
      width: [widthNodeId, 0],
      height: [heightNodeId, 0],
      upscale_method: "lanczos",
      crop: "center"
    },
    class_type: "ImageScale"
  };

  const refs = frameIndices.map((frameIndex, index) => {
    const nodeId = String(9202 + index);
    comfyPrompt[nodeId] = {
      inputs: {
        image: ["9201", 0],
        start: Math.max(0, Math.round(Number(frameIndex) || 0)),
        length: 1
      },
      class_type: "ImageFromBatch+"
    };
    return [nodeId, 0];
  });

  comfyPrompt["3035"].inputs.image = refs[0];
  comfyPrompt["3023"].inputs.image = refs[1] || refs[0];
  if (refs[2] && comfyPrompt["3641"]?.inputs) comfyPrompt["3641"].inputs.image = refs[2];
  if (refs[3] && comfyPrompt["3727"]?.inputs) comfyPrompt["3727"].inputs.image = refs[3];

  delete comfyPrompt["3021"];
  delete comfyPrompt["3022"];
  delete comfyPrompt["3638"];
  delete comfyPrompt["3754"];
  return refs;
}

const sampledCreatorMiddleSegmentTemplates = {
  B: {
    ids: ["3622", "3623", "3624", "3625", "3626", "3630", "3631", "3633", "3634", "3635", "3639", "3641", "3646", "3647", "3649", "3650", "3651", "3652", "3653", "3654", "3655", "3663", "3670", "3671", "3680", "3681", "3682", "3684", "3685", "3686", "3687"],
    batchNodeId: "3651",
    endRepeatNodeId: "3641",
    seedNodeId: "3635",
    outputNodeId: "3680"
  },
  C: {
    ids: ["3713", "3714", "3715", "3716", "3717", "3721", "3723", "3724", "3726", "3727", "3731", "3732", "3733", "3734", "3735", "3736", "3740", "3747", "3753", "3755", "3758", "3761", "3764", "3766", "3767", "3770", "3784", "3785", "3786", "3789", "3790", "3791", "3792", "3793"],
    batchNodeId: "3732",
    endRepeatNodeId: "3727",
    prevTailNodeId: "3766",
    seedNodeId: "3791",
    outputNodeId: "3753"
  }
};

function cloneSampledCreatorMiddleSegment(comfyPrompt, { kind, segmentIndex, previousSegmentOutput, keyframeRef, seed }) {
  const template = sampledCreatorMiddleSegmentTemplates[kind] || sampledCreatorMiddleSegmentTemplates.B;
  const idBase = 10000 + segmentIndex * 100;
  const idMap = new Map(template.ids.map((id, index) => [id, String(idBase + index)]));
  for (const id of template.ids) {
    const sourceNode = comfyPrompt[id];
    if (!sourceNode) continue;
    const clonedNode = remapComfyNodeLinks(JSON.parse(JSON.stringify(sourceNode)), idMap);
    comfyPrompt[idMap.get(id)] = clonedNode;
  }

  const prevTailNodeId = String(idBase + 90);
  comfyPrompt[prevTailNodeId] = {
    inputs: {
      image: previousSegmentOutput,
      start: ["3793", 0],
      length: ["3682", 0]
    },
    class_type: "ImageFromBatch+"
  };

  const batchNode = comfyPrompt[idMap.get(template.batchNodeId)];
  if (batchNode?.inputs) batchNode.inputs["images.image0"] = [prevTailNodeId, 0];

  const endRepeatNode = comfyPrompt[idMap.get(template.endRepeatNodeId)];
  if (endRepeatNode?.inputs) endRepeatNode.inputs.image = keyframeRef;

  const seedNode = comfyPrompt[idMap.get(template.seedNodeId)];
  const seedValue = optionalInteger(seed);
  if (seedNode?.inputs && seedValue !== undefined) seedNode.inputs.value = seedValue + segmentIndex;

  return {
    output: [idMap.get(template.outputNodeId), 0],
    outputNodeId: idMap.get(template.outputNodeId)
  };
}

function appendSampledCreatorBlend(comfyPrompt, { segmentIndex, currentOutput, nextSegmentOutput }) {
  const idBase = 11000 + segmentIndex * 10;
  const countNodeId = String(idBase);
  const lengthNodeId = String(idBase + 1);
  const trimNodeId = String(idBase + 2);
  const blendNodeId = String(idBase + 3);
  comfyPrompt[countNodeId] = {
    inputs: {
      images: currentOutput
    },
    class_type: "VHS_GetImageCount"
  };
  comfyPrompt[lengthNodeId] = {
    inputs: {
      "variables.a": [countNodeId, 0],
      "variables.b": ["3417", 0],
      expression: "a-b"
    },
    class_type: "SimpleCalculatorKJ"
  };
  comfyPrompt[trimNodeId] = {
    inputs: {
      image: currentOutput,
      length: [lengthNodeId, 1],
      start: 0
    },
    class_type: "ImageFromBatch+"
  };
  comfyPrompt[blendNodeId] = {
    inputs: {
      video_1: [trimNodeId, 0],
      video_2: nextSegmentOutput,
      overlap_frames: ["3415", 0]
    },
    class_type: "WanVideoBlender"
  };
  return [blendNodeId, 0];
}

function wireSampledCreatorLoopClose(comfyPrompt, { currentOutput, previousSegmentOutput, segmentCount }) {
  if (comfyPrompt["3844"]?.inputs) comfyPrompt["3844"].inputs.image = previousSegmentOutput;
  if (comfyPrompt["3404"]?.inputs) comfyPrompt["3404"].inputs.image = currentOutput;
  if (comfyPrompt["3406"]?.inputs) comfyPrompt["3406"].inputs.images = currentOutput;
  if (comfyPrompt["3416"]?.inputs) comfyPrompt["3416"].inputs.value = Math.max(2, Math.round(Number(segmentCount) || 2));
  return ["3412", 0];
}

function sampledCreatorBaseOutputRef(segmentCount) {
  if (segmentCount <= 1) return ["2559", 0];
  if (segmentCount === 2) return ["3133", 0];
  return ["3339", 0];
}

function sampledCreatorBaseSegmentOutputRef(segmentIndex) {
  if (segmentIndex <= 0) return ["2559", 0];
  if (segmentIndex === 1) return ["3680", 0];
  return ["3753", 0];
}

function remapComfyNodeLinks(value, idMap) {
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === "string" && idMap.has(value[0])) {
      return [idMap.get(value[0]), value[1]];
    }
    return value.map((item) => remapComfyNodeLinks(item, idMap));
  }
  if (value && typeof value === "object") {
    for (const [key, next] of Object.entries(value)) {
      value[key] = remapComfyNodeLinks(next, idMap);
    }
  }
  return value;
}

function patchFullWorkflowSamplerSettings(comfyPrompt, options) {
  for (const nodeId of fullWorkflowSharkSamplerNodeIds) {
    const inputs = comfyPrompt[nodeId]?.inputs;
    if (!inputs) continue;
    inputs.scheduler = "beta";
    inputs.steps = options.samplerSteps;
    inputs.steps_to_run = options.samplerStepsToRun;
    inputs.denoise = 1;
    inputs.cfg = 1;
  }
}

function patchLoraLoaderStrengths(comfyPrompt, strengths = creatorDefaultLoraStrengths) {
  patchPowerLoraLoader(comfyPrompt[highModelLoraLoaderNodeId], {
    distill: strengths.distillHigh,
    motion: strengths.motionHigh
  });
  patchPowerLoraLoader(comfyPrompt[lowModelLoraLoaderNodeId], {
    distill: strengths.distillLow,
    motion: strengths.motionLow
  });
}

function patchPowerLoraLoader(node, strengths) {
  const inputs = node?.inputs;
  if (!inputs) return;
  if (inputs.lora_1 && typeof inputs.lora_1 === "object") {
    inputs.lora_1.strength = strengths.distill;
  }
  if (inputs.lora_2 && typeof inputs.lora_2 === "object") {
    inputs.lora_2.strength = strengths.motion;
  }
}

function sanitizeComfyPromptInputs(comfyPrompt) {
  for (const node of Object.values(comfyPrompt || {})) {
    const inputs = node?.inputs;
    if (!inputs || typeof inputs !== "object") continue;

    if (node.class_type === "SharkSampler_Beta") {
      inputs.scheduler = normalizeComfyChoice(inputs.scheduler, comfySchedulerOptions, "beta");
      inputs.cfg = clampNumber(inputs.cfg, 0, 50, 1);
      if (inputs.cfg > 20) inputs.cfg = 1;
      inputs.denoise = clampNumber(inputs.denoise, 0, 1, 1);
      inputs.steps = clampInteger(inputs.steps, 1, 200, 4);
      inputs.steps_to_run = clampInteger(inputs.steps_to_run, -1, 200, inputs.steps);
      if (inputs.steps_to_run > inputs.steps) inputs.steps_to_run = inputs.steps;
    }

    if (node.class_type === "ImageScale") {
      inputs.upscale_method = normalizeComfyChoice(inputs.upscale_method, comfyUpscaleMethodOptions, "lanczos");
      inputs.crop = normalizeComfyChoice(inputs.crop, comfyCropOptions, "center");
    }

    if (node.class_type === "ImageBlend") {
      inputs.blend_factor = clampNumber(inputs.blend_factor, 0, 1, 0.1);
      inputs.blend_mode = normalizeComfyChoice(inputs.blend_mode, comfyImageBlendModeOptions, "normal");
    }
  }
}

function normalizeComfyChoice(value, choices, fallback) {
  const normalized = String(value ?? "").trim();
  return choices.has(normalized) ? normalized : fallback;
}

function isNewtLocalAssetUrl(value) {
  const raw = String(value || "").trim();
  if (/^\/(?:uploads|outputs|workflow-assets)\//.test(raw)) return true;

  try {
    const parsed = new URL(raw, "http://localhost");
    return /^\/(?:uploads|outputs|workflow-assets)\//.test(decodeURIComponent(parsed.pathname || ""));
  } catch {
    return false;
  }
}

function patchFullSegment(comfyPrompt, role, segment, ids) {
  const positivePrompt = String(segment.prompt || "").trim();
  if (positivePrompt) comfyPrompt[ids.positiveNodeId].inputs.text = positivePrompt;
  comfyPrompt[ids.negativeNodeId].inputs.text = String(segment.negativePrompt || "");
  comfyPrompt[ids.conditioningNodeId].inputs.conditioning_to_strength = clampNumber(segment.conditioningStrength, 0, 1, role === "D" ? 1 : 0.6);
  comfyPrompt[ids.scheduleNodeId].inputs.string = normalizeStrengthSchedule(segment.strengthSchedule);
  const seed = optionalInteger(segment.seed);
  comfyPrompt[ids.seedNodeId].inputs.value = seed ?? Math.floor(Math.random() * 2147483647);
  if (ids.refFirstNodeId && comfyPrompt[ids.refFirstNodeId]?.inputs) {
    comfyPrompt[ids.refFirstNodeId].inputs.vace_ref_strength = clampNumber(segment.vaceRefStrengthFirst, 0, 2, role === "A" ? 1 : 1);
  }
  if (ids.refSecondNodeId && comfyPrompt[ids.refSecondNodeId]?.inputs) {
    comfyPrompt[ids.refSecondNodeId].inputs.vace_ref_strength = clampNumber(segment.vaceRefStrengthSecond, 0, 2, role === "A" || role === "D" ? 0.6 : 1);
  }
}

function fullWorkflowOutputImagesInput({ hasB, hasC, loop }) {
  if (loop) return ["3412", 0];
  if (hasC) return ["3339", 0];
  if (hasB) return ["3133", 0];
  return ["2559", 0];
}

function fullWorkflowSegmentOutputSpecs({ hasB, hasC, loop }) {
  return [
    { role: "A", outputNodeId: "9101", imageNodeId: "2559" },
    hasB ? { role: "B", outputNodeId: "9102", imageNodeId: "3680" } : null,
    hasC ? { role: "C", outputNodeId: "9103", imageNodeId: "3753" } : null,
    loop ? { role: "D", outputNodeId: "9104", imageNodeId: "3834" } : null
  ].filter(Boolean);
}

function fullWorkflowRenderLength(options) {
  const effectiveSegmentFrames = Math.max(1, options.length - creatorDefaultKeyTrimFrames - creatorDefaultBlendFrames);
  return effectiveSegmentFrames + options.keyTrimFrames + options.blendFrames;
}

function patchStartFramesHandoff(comfyPrompt, startFramesPath, handoffFrames) {
  const safeHandoffFrames = clampInteger(handoffFrames, 1, 24, 8);
  comfyPrompt["3147"].inputs.value = safeHandoffFrames;
  comfyPrompt["9001"] = {
    inputs: {
      video: JSON.stringify(startFramesPath),
      force_rate: 0,
      custom_width: 0,
      custom_height: 0,
      frame_load_cap: safeHandoffFrames,
      skip_first_frames: 0,
      select_every_nth: 1,
      format: "None"
    },
    class_type: "VHS_LoadVideoPath"
  };
  comfyPrompt["9002"] = {
    inputs: {
      image: ["9001", 0],
      width: ["3143", 0],
      height: ["3144", 0],
      upscale_method: "lanczos",
      crop: "center"
    },
    class_type: "ImageScale"
  };
  comfyPrompt["3076"].inputs["images.image0"] = ["9002", 0];

  comfyPrompt["9010"] = {
    inputs: {
      width: ["3143", 0],
      height: ["3144", 0],
      batch_size: 1,
      color: 0
    },
    class_type: "EmptyImage"
  };
  comfyPrompt["9011"] = {
    inputs: {
      width: ["3143", 0],
      height: ["3144", 0],
      batch_size: 1,
      color: 16777215
    },
    class_type: "EmptyImage"
  };
  comfyPrompt["9012"] = {
    inputs: {
      image: ["9010", 0],
      amount: ["3147", 0]
    },
    class_type: "RepeatImageBatch"
  };
  comfyPrompt["9013"] = {
    inputs: {
      image: ["9011", 0],
      amount: ["3152", 1]
    },
    class_type: "RepeatImageBatch"
  };
  comfyPrompt["9014"] = {
    inputs: {
      image: ["9010", 0],
      amount: ["3148", 0]
    },
    class_type: "RepeatImageBatch"
  };
  comfyPrompt["9015"] = {
    inputs: {
      image: ["9011", 0],
      amount: ["3156", 1]
    },
    class_type: "RepeatImageBatch"
  };
  comfyPrompt["9016"] = {
    inputs: {
      "images.image0": ["9012", 0],
      "images.image1": ["9013", 0],
      "images.image2": ["9014", 0],
      "images.image3": ["9015", 0]
    },
    class_type: "BatchImagesNode"
  };
  comfyPrompt["9017"] = {
    inputs: {
      image: ["9016", 0],
      channel: "red"
    },
    class_type: "ImageToMask"
  };
  comfyPrompt["2581"].inputs.control_masks = ["9017", 0];
  comfyPrompt["2555"].inputs.control_masks = ["9017", 0];
}

async function assertComfyAvailable() {
  let response;
  try {
    response = await fetch(`${comfyBaseUrl}/system_stats`);
  } catch (error) {
    const next = new Error(`WanWarp could not reach ComfyUI at ${comfyBaseUrl}. Start Comfy Desktop and try again.`);
    next.status = 503;
    next.cause = error;
    throw next;
  }
  if (!response.ok) {
    const error = new Error(`WanWarp could not reach ComfyUI at ${comfyBaseUrl}: ${response.status} ${response.statusText}`);
    error.status = 503;
    throw error;
  }
}

async function uploadImageToComfy(filePath, fileName = "") {
  const extension = path.extname(fileName || filePath).toLowerCase();
  const safeName = `wanwarp_${Date.now()}_${randomUUID().slice(0, 8)}${extension || ".png"}`;
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.append("image", new File([bytes], safeName, { type: imageMimeTypes.get(extension) || "image/png" }));
  form.append("type", "input");
  form.append("overwrite", "true");

  const response = await fetch(`${comfyBaseUrl}/upload/image`, {
    method: "POST",
    body: form
  });
  const data = await responseJson(response, "Comfy image upload failed.");
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

async function queueComfyPrompt(prompt, clientId) {
  const response = await fetch(`${comfyBaseUrl}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, client_id: clientId })
  });
  return responseJson(response, "Comfy prompt queue failed.");
}

async function waitForComfyPrompt(promptId) {
  if (!promptId) {
    const error = new Error("Comfy did not return a prompt id.");
    error.status = 502;
    throw error;
  }

  const timeoutMs = Math.max(60000, Number(process.env.WANWARP_COMFY_TIMEOUT_MS) || defaultComfyTimeoutMs);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${comfyBaseUrl}/history/${encodeURIComponent(promptId)}`);
    const data = await responseJson(response, "Comfy history polling failed.");
    const history = data[promptId];
    if (history) {
      const status = history.status || {};
      if (status.status_str === "error") {
        const error = new Error(status.messages?.at(-1)?.[1]?.exception_message || "Comfy reported a WanWarp error.");
        error.status = 502;
        error.raw = status;
        throw error;
      }
      if (status.status_str === "success") return history;
      if (!status.status_str && history.outputs && Object.keys(history.outputs).length > 0) return history;
    }
    await delay(comfyPollIntervalMs);
  }

  const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const timeoutMinutes = Math.round(timeoutMs / 60000);
  const error = new Error(`WanWarp timed out waiting for ComfyUI after ${elapsedMinutes} minutes. Comfy prompt id: ${promptId}. The render may still be running in ComfyUI.`);
  error.status = 504;
  error.promptId = promptId;
  error.timeoutMs = timeoutMs;
  error.timeoutMinutes = timeoutMinutes;
  throw error;
}

function findComfyVideo(history, preferredNodeId) {
  const outputs = history?.outputs || {};
  const candidates = [
    ...(outputs[preferredNodeId]?.gifs || []),
    ...Object.values(outputs).flatMap((output) => output?.gifs || [])
  ];
  return candidates.find((item) => String(item?.filename || "").toLowerCase().endsWith(".mp4")) || candidates[0] || null;
}

async function copyComfyVideoToOutput(video, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  if (video.fullpath && existsSync(video.fullpath)) {
    await copyFile(video.fullpath, outputPath);
    return;
  }

  const params = new URLSearchParams({
    filename: video.filename || "",
    subfolder: video.subfolder || "",
    type: video.type || "output"
  });
  const response = await fetch(`${comfyBaseUrl}/view?${params.toString()}`);
  if (!response.ok) {
    const error = new Error(`Could not download Comfy output video: ${response.status} ${response.statusText}`);
    error.status = 502;
    throw error;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
}

async function responseJson(response, fallback) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Comfy occasionally returns plain text for errors.
  }
  if (!response.ok) {
    const error = new Error(formatComfyError(data) || `${fallback} ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.raw = data;
    throw error;
  }
  return data || {};
}

function formatComfyError(data) {
  const error = data?.error;
  const parts = [];
  const headline = [error?.message, error?.details].map((value) => String(value || "").trim()).filter(Boolean).join(": ");
  if (headline) parts.push(headline);

  const nodeErrors = data?.node_errors && typeof data.node_errors === "object" ? data.node_errors : {};
  Object.entries(nodeErrors).forEach(([nodeId, nodeError]) => {
    const classType = nodeError?.class_type || "Unknown";
    const details = Array.isArray(nodeError?.errors)
      ? nodeError.errors
          .map((item) => [item?.message, item?.details].map((value) => String(value || "").trim()).filter(Boolean).join(": "))
          .filter(Boolean)
          .join("; ")
      : "";
    parts.push(details ? `${classType} #${nodeId}: ${details}` : `${classType} #${nodeId}`);
  });

  const fallback = typeof error === "string" ? error : "";
  return (parts.join(" | ") || fallback).slice(0, 1200);
}

function normalizeFullWorkflowSegments(segments = [], loop = false) {
  const roleOrder = ["A", "B", "C", "D"];
  const byRole = new Map();
  segments.forEach((segment, index) => {
    if (!segment || typeof segment !== "object") return;
    const role = roleOrder.includes(String(segment.role || "").toUpperCase())
      ? String(segment.role || "").toUpperCase()
      : roleOrder[index] || "D";
    if (byRole.has(role)) return;
    byRole.set(role, {
      ...segment,
      role,
      order: Number.isFinite(Number(segment.order)) ? Number(segment.order) : index,
      prompt: String(segment.prompt || "").trim(),
      negativePrompt: String(segment.negativePrompt || "")
    });
  });

  const normalized = roleOrder.map((role) => byRole.get(role)).filter(Boolean);
  return loop ? normalized : normalized.filter((segment) => segment.role !== "D");
}

function firstSegmentValue(segments = [], key) {
  return segments.map((segment) => segment?.[key]).find(Boolean) || "";
}

function normalizeWanWarpOptions(options = {}, body = {}) {
  const seed = optionalInteger(options.seed ?? body.seed);
  const stitchOptions = body.videoStitch && typeof body.videoStitch === "object" ? body.videoStitch : {};
  const samplerSteps = clampInteger(stitchOptions.samplerSteps ?? options.samplerSteps, 1, 200, creatorDefaultSamplerSteps);
  const samplerStepsToRun = clampInteger(stitchOptions.samplerStepsToRun ?? options.samplerStepsToRun, 1, samplerSteps, Math.min(creatorDefaultSamplerStepsToRun, samplerSteps));
  return {
    negativePrompt: String(options.vaceNegativePrompt || options.wanNegativePrompt || body.negativePrompt || ""),
    fps: clampInteger(options.wanFps, 4, 60, 16),
    width: clampInteger(options.width, 128, 2048, 512),
    height: clampInteger(options.height, 128, 2048, 512),
    length: clampInteger(options.length ?? options.wanNumFrames, 1, 241, 57),
    conditioningStrength: clampNumber(options.conditioningStrength, 0, 1, 0.6),
    strengthSchedule: normalizeStrengthSchedule(options.strengthSchedule),
    vaceRefStrengthFirst: clampNumber(options.vaceRefStrengthFirst, 0, 2, 1),
    vaceRefStrengthSecond: clampNumber(options.vaceRefStrengthSecond, 0, 2, 0.6),
    handoffFrames: clampInteger(options.handoffFrames, 1, 24, 8),
    keyTrimFrames: clampInteger(stitchOptions.keyTrimFrames ?? options.keyTrimFrames, 0, 24, creatorDefaultKeyTrimFrames),
    blendFrames: clampInteger(stitchOptions.blendFrames ?? options.blendFrames, 1, 24, creatorDefaultBlendFrames),
    samplerSteps,
    samplerStepsToRun,
    loraStrengths: {
      distillHigh: clampNumber(stitchOptions.distillLoraHigh ?? options.distillLoraHigh, 0, 5, creatorDefaultLoraStrengths.distillHigh),
      distillLow: clampNumber(stitchOptions.distillLoraLow ?? options.distillLoraLow, 0, 5, creatorDefaultLoraStrengths.distillLow),
      motionHigh: clampNumber(stitchOptions.motionLoraHigh ?? options.motionLoraHigh, 0, 5, creatorDefaultLoraStrengths.motionHigh),
      motionLow: clampNumber(stitchOptions.motionLoraLow ?? options.motionLoraLow, 0, 5, creatorDefaultLoraStrengths.motionLow)
    },
    crf: clampInteger(stitchOptions.crf ?? options.crf, 0, 51, creatorDefaultCrf),
    seed
  };
}

function normalizeWanBlendSampledCreatorOptions(stitchOptions = {}, body = {}, sourceMetadata = {}) {
  const base = normalizeWanWarpOptions(body.transitionBuilder || {}, body);
  const loop = Boolean(stitchOptions.loop);
  const sourceFrameLimit = clampInteger(stitchOptions.frameLoadCap, 0, 4096, 0);
  const probedFrameCount = clampInteger(sourceMetadata.sourceFrameCount, 0, 4096, 0);
  const sourceFrameCount = probedFrameCount
    ? (sourceFrameLimit ? Math.min(probedFrameCount, sourceFrameLimit) : probedFrameCount)
    : sourceFrameLimit || base.length;
  const segmentLength = clampInteger(stitchOptions.segmentLength ?? base.length, 9, 241, 57);
  const requestedSegmentCount = clampInteger(stitchOptions.sampledSegmentCount, 0, 48, 0);
  const minimumSegmentCount = loop ? 2 : 1;
  const sampledSegmentCount = clampInteger(
    requestedSegmentCount || Math.ceil(Math.max(1, sourceFrameCount) / segmentLength),
    minimumSegmentCount,
    48,
    minimumSegmentCount
  );
  const sampledFrameIndices = sampledWanBlendFrameIndices(sourceFrameCount, sampledSegmentCount, loop);
  const strengthCurve = normalizeStrengthCurvePoints(stitchOptions.strengthCurve);
  const motionFrameCount = videoFrameCountFromMetadata({ num_frames: sourceMetadata.motionFrameCount });
  const depthFrameCount = videoFrameCountFromMetadata({ num_frames: sourceMetadata.depthFrameCount });
  const shortestControlCount = [motionFrameCount, depthFrameCount].filter(Boolean).sort((a, b) => a - b)[0] || segmentLength;
  const controlRepeat = Math.max(2, Math.ceil((segmentLength + 48) / Math.max(1, shortestControlCount)));
  const samplerSteps = clampInteger(stitchOptions.samplerSteps, 1, 200, base.samplerSteps);
  const samplerStepsToRun = clampInteger(stitchOptions.samplerStepsToRun, 1, samplerSteps, Math.min(base.samplerStepsToRun, samplerSteps));

  return {
    ...base,
    fps: base.fps,
    length: segmentLength,
    sourceFrameCount,
    loop,
    sampledSegmentCount,
    sampledFrameIndices,
    controlRepeat,
    negativePrompt: String(stitchOptions.negativePrompt || base.negativePrompt || ""),
    samplerSteps,
    samplerStepsToRun,
    conditioningStrength: clampNumber(stitchOptions.conditioningStrength, 0, 1, base.conditioningStrength),
    strengthCurve,
    strengthSchedule: strengthCurve
      ? strengthScheduleFromCurve(strengthCurve, segmentLength)
      : normalizeStrengthScheduleForFrameCount(stitchOptions.strengthSchedule, segmentLength, base.strengthSchedule),
    crf: clampInteger(stitchOptions.crf, 0, 51, base.crf),
    loraStrengths: {
      distillHigh: clampNumber(stitchOptions.distillLoraHigh, 0, 5, base.loraStrengths.distillHigh),
      distillLow: clampNumber(stitchOptions.distillLoraLow, 0, 5, base.loraStrengths.distillLow),
      motionHigh: clampNumber(stitchOptions.motionLoraHigh, 0, 5, base.loraStrengths.motionHigh),
      motionLow: clampNumber(stitchOptions.motionLoraLow, 0, 5, base.loraStrengths.motionLow)
    }
  };
}

function sampledWanBlendFrameIndices(sourceFrameCount, segmentCount, loop = false) {
  const count = Math.max(1, Math.round(Number(segmentCount) || 1));
  const lastFrame = Math.max(0, Math.round(Number(sourceFrameCount) || 1) - 1);
  if (loop) {
    const frameCount = Math.max(1, Math.round(Number(sourceFrameCount) || 1));
    return Array.from({ length: count }, (_, index) => Math.min(lastFrame, Math.round(index * frameCount / count)));
  }
  if (count === 1) return [0, lastFrame];
  return Array.from({ length: count + 1 }, (_, index) => Math.round(index * lastFrame / count));
}

function normalizeWanBlendRefineOptions(stitchOptions = {}, body = {}, sourceMetadata = {}) {
  const base = normalizeWanWarpOptions(body.transitionBuilder || {}, body);
  const samplerSteps = clampInteger(stitchOptions.samplerSteps, 1, 200, creatorDefaultSamplerSteps);
  const samplerStepsToRun = clampInteger(stitchOptions.samplerStepsToRun, 1, samplerSteps, Math.min(creatorDefaultSamplerStepsToRun, samplerSteps));
  const probedFrameCount = clampInteger(sourceMetadata.sourceFrameCount, 0, 4096, 0);
  const requestedFrameLoadCap = clampInteger(stitchOptions.frameLoadCap, 0, 4096, 0);
  const sourceFrameCount = probedFrameCount
    ? (requestedFrameLoadCap ? Math.min(probedFrameCount, requestedFrameLoadCap) : probedFrameCount)
    : requestedFrameLoadCap || base.length;
  const defaultStrengthSchedule = defaultWanBlendRefineStrengthSchedule(sourceFrameCount);
  const strengthCurve = normalizeStrengthCurvePoints(stitchOptions.strengthCurve);
  return {
    ...base,
    fps: base.fps,
    length: sourceFrameCount,
    negativePrompt: String(stitchOptions.negativePrompt || base.negativePrompt || ""),
    samplerSteps,
    samplerStepsToRun,
    refineDenoise: normalizeWanBlendRefineDefaultedNumber("refineDenoise", stitchOptions.refineDenoise, 0, 1),
    controlBlend: normalizeWanBlendRefineDefaultedNumber("controlBlend", stitchOptions.controlBlend, 0, 1),
    depthMotionBlend: normalizeWanBlendRefineDefaultedNumber("depthMotionBlend", stitchOptions.depthMotionBlend, 0, 1),
    controlBlendMode: normalizeComfyChoice(stitchOptions.controlBlendMode, comfyImageBlendModeOptions, "normal"),
    vaceRefStrength: normalizeWanBlendRefineDefaultedNumber("vaceRefStrength", stitchOptions.vaceRefStrength, 0, 2),
    conditioningStrength: clampNumber(stitchOptions.conditioningStrength, 0, 1, 0.6),
    strengthCurve,
    strengthSchedule: strengthCurve
      ? strengthScheduleFromCurve(strengthCurve, sourceFrameCount)
      : normalizeStrengthScheduleForFrameCount(stitchOptions.strengthSchedule, sourceFrameCount, defaultStrengthSchedule),
    frameLoadCap: sourceFrameCount,
    crf: clampInteger(stitchOptions.crf, 0, 51, creatorDefaultCrf),
    loraStrengths: {
      distillHigh: clampNumber(stitchOptions.distillLoraHigh, 0, 5, creatorDefaultLoraStrengths.distillHigh),
      distillLow: clampNumber(stitchOptions.distillLoraLow, 0, 5, creatorDefaultLoraStrengths.distillLow),
      motionHigh: clampNumber(stitchOptions.motionLoraHigh, 0, 5, creatorDefaultLoraStrengths.motionHigh),
      motionLow: clampNumber(stitchOptions.motionLoraLow, 0, 5, creatorDefaultLoraStrengths.motionLow)
    }
  };
}

function normalizeStrengthSchedule(value) {
  const schedule = String(value || "").trim();
  return schedule || "0.90, 0.64#10, 0.80, 1.00, 0.64#2";
}

function normalizeWanBlendRefineDefaultedNumber(key, value, min, max) {
  const previousDefault = wanBlendRefinePreviousDefaults[key];
  const preserveDefault = wanBlendRefinePreserveDefaults[key];
  const number = Number(value);
  if (!Number.isFinite(number)) return preserveDefault;
  if (Math.abs(number - previousDefault) < 0.0001) return preserveDefault;
  return clampNumber(number, min, max, preserveDefault);
}

function defaultWanBlendRefineStrengthSchedule(frameCount) {
  const expectedCount = wanVaceStrengthCount(frameCount);
  if (expectedCount <= 1) return "0.45";
  if (expectedCount === 2) return "0.45, 0.45";
  return `0.45, 0.55#${expectedCount - 2}, 0.45`;
}

function normalizeStrengthScheduleForFrameCount(value, frameCount, fallbackSchedule) {
  const expectedCount = wanVaceStrengthCount(frameCount);
  const rawSchedule = String(value || "").trim();
  const schedule = rawSchedule || fallbackSchedule;
  if (!expectedCount) return normalizeStrengthSchedule(schedule);
  if (!rawSchedule || isWanBlendRefineDefaultSchedule(rawSchedule)) return fallbackSchedule;

  const expanded = expandStrengthSchedule(schedule);
  if (!expanded.length) return fallbackSchedule;
  if (expanded.length === expectedCount) return normalizeStrengthSchedule(schedule);

  return formatStrengthSchedule(resampleStrengthValues(expanded, expectedCount));
}

function normalizeStrengthCurvePoints(value) {
  if (!Array.isArray(value)) return null;
  const points = value
    .map((point) => {
      if (Array.isArray(point)) return { x: Number(point[0]), y: Number(point[1]), mode: point[2] };
      if (point && typeof point === "object") return { x: Number(point.x), y: Number(point.y), mode: point.mode };
      return null;
    })
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({
      x: clampNumber(point.x, 0, 1, 0),
      y: clampNumber(point.y, 0, 1, 0.5),
      mode: normalizeStrengthCurveMode(point.mode)
    }))
    .sort((a, b) => a.x - b.x)
    .slice(0, 64);
  if (!points.length) return null;

  const deduped = [];
  for (const point of points) {
    const previous = deduped.at(-1);
    if (previous && Math.abs(previous.x - point.x) < 0.0001) {
      previous.y = point.y;
    } else {
      deduped.push({ ...point });
    }
  }

  if (deduped[0].x > 0.0001) deduped.unshift({ x: 0, y: deduped[0].y, mode: deduped[0].mode || "ease" });
  deduped[0].x = 0;
  if (deduped.at(-1).x < 0.9999) deduped.push({ x: 1, y: deduped.at(-1).y, mode: "ease" });
  deduped[deduped.length - 1].x = 1;
  return deduped.length >= 2 ? deduped : wanBlendRefineDefaultStrengthCurve;
}

function normalizeStrengthCurveMode(value) {
  return String(value || "").toLowerCase() === "linear" ? "linear" : "ease";
}

function strengthScheduleFromCurve(points, frameCount) {
  const expectedCount = wanVaceStrengthCount(frameCount);
  return formatStrengthSchedule(sampleStrengthCurve(points, expectedCount || 1));
}

function sampleStrengthCurve(points, targetCount) {
  const normalized = normalizeStrengthCurvePoints(points) || wanBlendRefineDefaultStrengthCurve;
  const count = Math.max(1, Math.round(Number(targetCount) || 1));
  if (count === 1) return [clampNumber(normalized[0]?.y, 0, 1, 0.5)];

  return Array.from({ length: count }, (_, index) => {
    const x = index / (count - 1);
    return interpolateStrengthCurveY(normalized, x);
  });
}

function interpolateStrengthCurveY(points, x) {
  if (x <= 0) return clampNumber(points[0]?.y, 0, 1, 0.5);
  if (x >= 1) return clampNumber(points.at(-1)?.y, 0, 1, 0.5);

  const segmentIndex = Math.max(0, points.findIndex((point) => point.x >= x) - 1);
  const p1 = points[segmentIndex] || points[0];
  const p2 = points[segmentIndex + 1] || points.at(-1);
  if (!p1 || !p2 || Math.abs(p2.x - p1.x) < 0.0001) return clampNumber(p1?.y, 0, 1, 0.5);

  const t = clampNumber((x - p1.x) / (p2.x - p1.x), 0, 1, 0);
  const segmentT = normalizeStrengthCurveMode(p2.mode) === "linear" ? t : t * t * (3 - 2 * t);
  const y = p1.y + (p2.y - p1.y) * segmentT;
  return clampNumber(y, 0, 1, 0.5);
}

function isWanBlendRefineDefaultSchedule(value) {
  const signature = strengthScheduleSignature(value);
  return signature === strengthScheduleSignature(wanBlendRefineLegacyStrengthSchedule) ||
    /^0\.45,0\.55#\d+,0\.45$/.test(signature);
}

function wanVaceStrengthCount(frameCount) {
  const frames = Math.max(1, Math.round(Number(frameCount) || 1));
  return Math.floor((frames - 1) / 4) + 1;
}

function videoFrameCountFromMetadata(metadata = {}) {
  const directFrames = positiveNumber(metadata.num_frames || metadata.frames || metadata.frame_count || metadata.frameCount);
  if (directFrames) return Math.round(directFrames);
  const duration = positiveNumber(metadata.duration);
  const fps = positiveNumber(metadata.fps);
  return duration && fps ? Math.round(duration * fps) : 0;
}

function validateControlVideoLength({ sourceFrameCount = 0, motionFrameCount = 0, depthFrameCount = 0 }) {
  if (!sourceFrameCount) return;
  const shortages = [
    motionFrameCount && motionFrameCount < sourceFrameCount ? `Motion Map has ${motionFrameCount}` : "",
    depthFrameCount && depthFrameCount < sourceFrameCount ? `Depth Video has ${depthFrameCount}` : ""
  ].filter(Boolean);
  if (!shortages.length) return;

  const error = new Error(`WanWarp uses the full WanBlend length (${sourceFrameCount} frames), but connected controls are shorter: ${shortages.join(", ")} frames.`);
  error.status = 400;
  throw error;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function expandStrengthSchedule(value) {
  return String(value || "")
    .split(",")
    .flatMap((part) => {
      const [rawValue, rawCount] = part.trim().split("#");
      const number = Number(rawValue);
      if (!Number.isFinite(number)) return [];
      const count = rawCount === undefined ? 1 : clampInteger(rawCount, 1, 4096, 1);
      return Array.from({ length: count }, () => number);
    });
}

function resampleStrengthValues(values, targetCount) {
  if (targetCount <= 0) return [];
  if (targetCount === 1) return [values[0] ?? 0];
  if (values.length <= 1) return Array.from({ length: targetCount }, () => values[0] ?? 0);

  return Array.from({ length: targetCount }, (_, index) => {
    const sourceIndex = Math.round(index * (values.length - 1) / (targetCount - 1));
    return values[sourceIndex] ?? values.at(-1) ?? 0;
  });
}

function formatStrengthSchedule(values) {
  return values.map((value) => formatStrengthNumber(value)).join(", ");
}

function formatStrengthNumber(value) {
  return Number(value.toFixed(4)).toString();
}

function strengthScheduleSignature(value) {
  return String(value || "").replace(/\s+/g, "");
}

function normalizeWanBlendFrameIndices(value) {
  const fallback = [0, 17, 35, 52];
  const rawValues = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const numbers = rawValues
    .map((item) => Math.round(Number(item)))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .slice(0, 4);
  while (numbers.length < 4) numbers.push(fallback[numbers.length]);
  return numbers;
}

function optionalInteger(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}

function clampInteger(value, min, max, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
