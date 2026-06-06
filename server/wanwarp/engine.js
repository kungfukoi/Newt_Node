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
const wanWarpOutputNodeId = "2590";
const wanWarpFullOutputNodeId = "3138";

const imageMimeTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);
const comfySchedulerOptions = new Set(["simple", "sgm_uniform", "karras", "exponential", "ddim_uniform", "beta", "normal", "linear_quadratic", "kl_optimal", "bong_tangent", "beta57"]);
const comfyUpscaleMethodOptions = new Set(["nearest-exact", "bilinear", "area", "bicubic", "lanczos"]);
const comfyCropOptions = new Set(["disabled", "center"]);
const creatorDefaultKeyTrimFrames = 5;
const creatorDefaultBlendFrames = 4;
const creatorDefaultSamplerSteps = 2;
const creatorDefaultSamplerStepsToRun = 1;
const creatorDefaultCrf = 6;
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
  if (!segmentA.startImageUrl || !segmentA.endImageUrl) {
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
  if (segmentB && !segmentB.endImageUrl) {
    const error = new Error("WanSegment B requires an End image.");
    error.status = 400;
    throw error;
  }
  if (segmentC && !segmentB) {
    const error = new Error("WanSegment C requires WanSegment B.");
    error.status = 400;
    throw error;
  }
  if (segmentC && !segmentC.endImageUrl) {
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
    helpers.resolveLocalAssetPathFromUrl(segmentA.startImageUrl),
    helpers.resolveLocalAssetPathFromUrl(segmentA.endImageUrl),
    segmentB?.endImageUrl ? helpers.resolveLocalAssetPathFromUrl(segmentB.endImageUrl) : Promise.resolve(null),
    segmentC?.endImageUrl ? helpers.resolveLocalAssetPathFromUrl(segmentC.endImageUrl) : Promise.resolve(null),
    helpers.resolveLocalAssetPathFromUrl(motionVideoUrl),
    isNewtLocalAssetUrl(depthVideoUrl)
      ? helpers.resolveLocalAssetPathFromUrl(depthVideoUrl)
      : Promise.resolve({ filePath: depthVideoUrl, fileName: path.basename(depthVideoUrl) })
  ];
  const [startImage, endAImage, endBImage, endCImage, motionVideo, depthVideo] = await Promise.all(localAssetTasks);
  const [comfyStartImage, comfyEndAImage, comfyEndBImage, comfyEndCImage] = await Promise.all([
    uploadImageToComfy(startImage.filePath, startImage.fileName),
    uploadImageToComfy(endAImage.filePath, endAImage.fileName),
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
    depthVideoPath: depthVideo.filePath
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
  depthVideoPath
}) {
  const comfyPrompt = JSON.parse(await readFile(fullTemplatePath, "utf8"));
  comfyPrompt["3021"].inputs.image = startImageName;
  comfyPrompt["3022"].inputs.image = endAImageName;
  if (segments.B && endBImageName) comfyPrompt["3638"].inputs.image = endBImageName;
  if (segments.C && endCImageName) comfyPrompt["3754"].inputs.image = endCImageName;

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

function normalizeStrengthSchedule(value) {
  const schedule = String(value || "").trim();
  return schedule || "0.90, 0.64#10, 0.80, 1.00, 0.64#2";
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
