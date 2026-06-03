import { workflowContextPayload } from "../workflowContext.js";

export function buildVideoGenerationRequest({
  node,
  prompt,
  workflowContext,
  projectId,
  projectName,
  startFrameUrls = [],
  endFrameUrls = [],
  referenceImageUrls = [],
  referenceImageLabels = [],
  referenceVideoUrls = [],
  referenceVideoLabels = [],
  referenceAudioUrls = []
}) {
  return {
    prompt,
    model: node.data.model,
    duration: node.data.duration,
    resolution: node.data.resolution,
    aspectRatio: node.data.aspectRatio,
    generateAudio: node.data.generateAudio,
    loop: Boolean(node.data.loop),
    seed: node.data.seed || "",
    enableSafetyChecker: node.data.enableSafetyChecker !== false,
    startFrameUrls,
    endFrameUrls,
    referenceImageUrls,
    referenceImageLabels,
    referenceVideoUrls,
    referenceVideoLabels,
    referenceAudioUrls,
    wan27Reference: {
      negativePrompt: node.data.negativePrompt || "",
      multiShots: Boolean(node.data.multiShots)
    },
    wanFunControl: {
      preprocessVideo: node.data.preprocessVideo !== false,
      preprocessType: node.data.preprocessType || "depth",
      matchInputNumFrames: node.data.matchInputNumFrames !== false,
      numFrames: node.data.numFrames || 81,
      matchInputFps: node.data.matchInputFps !== false,
      fps: node.data.fps || 16,
      numInferenceSteps: node.data.numInferenceSteps || 27,
      guidanceScale: node.data.guidanceScale || 6,
      shift: node.data.shift || 5,
      seed: node.data.seed || ""
    },
    ...workflowContextPayload(workflowContext, projectId, projectName),
    nodeId: node.id,
    nodeTitle: node.data.title
  };
}

export function normalizeVideoGenerationResult(data, index) {
  return {
    url: data.video.localUrl,
    type: "video",
    label: `Video ${index + 1}`,
    seed: data.seed,
    cost: data.cost
  };
}

export function buildUtilityVideoRequest({
  node,
  prompt,
  model,
  workflowContext,
  projectId,
  projectName,
  referenceImageUrls = [],
  referenceVideoUrls = [],
  maskVideoUrls = [],
  colorIdMatte,
  compositeVideo,
  voidNumFrames
}) {
  return {
    prompt,
    model,
    referenceImageUrls,
    referenceVideoUrls,
    maskVideoUrls,
    extractFrame: {
      frameTime: node.data.extractFrameTime ?? 0,
      format: node.data.extractFrameFormat || "png"
    },
    wanFunControl: {
      preprocessVideo: node.data.preprocessVideo !== false,
      preprocessType: node.data.preprocessType || "depth",
      matchInputNumFrames: node.data.matchInputNumFrames !== false,
      numFrames: node.data.numFrames || 81,
      matchInputFps: node.data.matchInputFps !== false,
      fps: node.data.fps || 16,
      numInferenceSteps: node.data.numInferenceSteps || 27,
      guidanceScale: node.data.guidanceScale || 6,
      shift: node.data.shift || 5,
      seed: node.data.seed || ""
    },
    sam3Video: {
      detectionThreshold: node.data.sam3VideoDetectionThreshold ?? 0.5
    },
    colorIdMatte,
    compositeVideo,
    transitionBuilder: {
      frameCount: node.data.transitionFrameCount || 57,
      fps: node.data.transitionFps || 16,
      size: node.data.transitionSize || "512",
      overlapFrames: node.data.transitionOverlapFrames || 9,
      transitionStartFrame: node.data.transitionStartFrame ?? 0,
      transitionDurationFrames: node.data.transitionDurationFrames || node.data.transitionFrameCount || 57,
      transitionEasing: node.data.transitionEasing || "linear",
      maskStyle: node.data.transitionMaskStyle || "wipe",
      maskSoftness: node.data.transitionMaskSoftness || 6,
      outputFormat: node.data.transitionOutputFormat || "mp4",
      generateWan: Boolean(node.data.transitionGenerateWan),
      wanSchedulerEnabled: Boolean(node.data.transitionWanSchedulerEnabled || node.data.transitionGenerateWan),
      wanSegmentCount: node.data.transitionWanSegmentCount || 3,
      wanSelectedSegment: node.data.transitionWanSelectedSegment || 1,
      wanNegativePrompt: node.data.transitionWanNegativePrompt || node.data.wan22A14bNegativePrompt || "",
      wanNumFrames: node.data.transitionWanNumFrames || node.data.wan22A14bNumFrames || 81,
      wanFps: node.data.transitionWanFps || node.data.wan22A14bFps || 16,
      wanResolution: node.data.transitionWanResolution || node.data.wan22A14bResolution || "720p",
      wanAspectRatio: node.data.transitionWanAspectRatio || node.data.wan22A14bAspectRatio || "auto",
      wanNumInferenceSteps: node.data.transitionWanNumInferenceSteps || node.data.wan22A14bNumInferenceSteps || 27,
      wanGuidanceScale: node.data.transitionWanGuidanceScale || node.data.wan22A14bGuidanceScale || 3.5,
      wanGuidanceScale2: node.data.transitionWanGuidanceScale2 || node.data.wan22A14bGuidanceScale2 || 3.5,
      wanShift: node.data.transitionWanShift || node.data.wan22A14bShift || 5,
      wanAcceleration: node.data.transitionWanAcceleration || node.data.wan22A14bAcceleration || "regular",
      wanInterpolatorModel: node.data.transitionWanInterpolatorModel || node.data.wan22A14bInterpolatorModel || "film",
      wanNumInterpolatedFrames: node.data.transitionWanNumInterpolatedFrames ?? node.data.wan22A14bNumInterpolatedFrames ?? 1,
      wanAdjustFpsForInterpolation: node.data.transitionWanAdjustFpsForInterpolation ?? node.data.wan22A14bAdjustFpsForInterpolation ?? true,
      wanVideoQuality: node.data.transitionWanVideoQuality || node.data.wan22A14bVideoQuality || "high",
      wanVideoWriteMode: node.data.transitionWanVideoWriteMode || node.data.wan22A14bVideoWriteMode || "balanced",
      wanEnableSafetyChecker: node.data.transitionWanEnableSafetyChecker ?? node.data.wan22A14bEnableSafetyChecker ?? true,
      wanEnableOutputSafetyChecker: Boolean(node.data.transitionWanEnableOutputSafetyChecker ?? node.data.wan22A14bEnableOutputSafetyChecker),
      wanEnablePromptExpansion: Boolean(node.data.transitionWanEnablePromptExpansion ?? node.data.wan22A14bEnablePromptExpansion),
      wanSeedMode: node.data.transitionWanSeedMode || "increment",
      wanLoras: Array.isArray(node.data.transitionWanLoras)
        ? node.data.transitionWanLoras.map((item) => ({
            path: item?.path || "",
            weightName: item?.weightName || "",
            scale: item?.scale === undefined || item?.scale === null || item?.scale === "" ? "1" : item.scale
          }))
        : [],
      seed: node.data.seed || ""
    },
    wan22A14b: {
      negativePrompt: node.data.wan22A14bNegativePrompt || "",
      numFrames: node.data.wan22A14bNumFrames || 81,
      fps: node.data.wan22A14bFps || 16,
      resolution: node.data.wan22A14bResolution || "720p",
      aspectRatio: node.data.wan22A14bAspectRatio || "16:9",
      numInferenceSteps: node.data.wan22A14bNumInferenceSteps || 27,
      guidanceScale: node.data.wan22A14bGuidanceScale || 3.5,
      guidanceScale2: node.data.wan22A14bGuidanceScale2 || 4,
      shift: node.data.wan22A14bShift || 5,
      enableSafetyChecker: node.data.wan22A14bEnableSafetyChecker !== false,
      enableOutputSafetyChecker: Boolean(node.data.wan22A14bEnableOutputSafetyChecker),
      enablePromptExpansion: Boolean(node.data.wan22A14bEnablePromptExpansion),
      acceleration: node.data.wan22A14bAcceleration || "regular",
      interpolatorModel: node.data.wan22A14bInterpolatorModel || "film",
      numInterpolatedFrames: node.data.wan22A14bNumInterpolatedFrames ?? 1,
      adjustFpsForInterpolation: node.data.wan22A14bAdjustFpsForInterpolation !== false,
      videoQuality: node.data.wan22A14bVideoQuality || "high",
      videoWriteMode: node.data.wan22A14bVideoWriteMode || "balanced",
      reverseVideo: Boolean(node.data.wan22A14bReverseVideo),
      loras: Array.isArray(node.data.wan22A14bLoras)
        ? node.data.wan22A14bLoras.map((item) => ({
            path: item?.path || "",
            weightName: item?.weightName || "",
            scale: item?.scale === undefined || item?.scale === null || item?.scale === "" ? "1" : item.scale
          }))
        : [],
      seed: node.data.seed || ""
    },
    wan21Lora: {
      negativePrompt: node.data.wan21LoraNegativePrompt || "",
      numFrames: node.data.wan21LoraNumFrames || 81,
      fps: node.data.wan21LoraFps || 16,
      resolution: node.data.wan21LoraResolution || "480p",
      aspectRatio: node.data.wan21LoraAspectRatio || "16:9",
      numInferenceSteps: node.data.wan21LoraNumInferenceSteps || 30,
      guideScale: node.data.wan21LoraGuideScale || 5,
      shift: node.data.wan21LoraShift || 5,
      enableSafetyChecker: node.data.wan21LoraEnableSafetyChecker !== false,
      enablePromptExpansion: Boolean(node.data.wan21LoraEnablePromptExpansion),
      turboMode: node.data.wan21LoraTurboMode !== false,
      reverseVideo: Boolean(node.data.wan21LoraReverseVideo),
      loras: Array.isArray(node.data.wan21Loras)
        ? node.data.wan21Loras.map((item) => ({
            path: item?.path || "",
            weightName: item?.weightName || "",
            scale: item?.scale === undefined || item?.scale === null || item?.scale === "" ? "1" : item.scale
          }))
        : [],
      seed: node.data.seed || ""
    },
    wanVaceMaskToVideo: {
      negativePrompt: node.data.wanVaceNegativePrompt || "",
      matchInputNumFrames: node.data.wanVaceMatchInputNumFrames !== false,
      numFrames: node.data.wanVaceNumFrames || 81,
      matchInputFps: node.data.wanVaceMatchInputFps !== false,
      fps: node.data.wanVaceFps || 16,
      resolution: node.data.wanVaceResolution || "720p",
      aspectRatio: node.data.wanVaceAspectRatio || "auto",
      numInferenceSteps: node.data.wanVaceNumInferenceSteps || 30,
      guidanceScale: node.data.wanVaceGuidanceScale || 5,
      sampler: node.data.wanVaceSampler || "unipc",
      shift: node.data.wanVaceShift || 5,
      enableSafetyChecker: node.data.wanVaceEnableSafetyChecker !== false,
      enablePromptExpansion: Boolean(node.data.wanVaceEnablePromptExpansion),
      preprocess: Boolean(node.data.wanVacePreprocess),
      acceleration: node.data.wanVaceAcceleration || "regular",
      videoQuality: node.data.wanVaceVideoQuality || "high",
      videoWriteMode: node.data.wanVaceVideoWriteMode || "balanced",
      numInterpolatedFrames: node.data.wanVaceNumInterpolatedFrames || 0,
      seed: node.data.seed || ""
    },
    wanVaceControl: {
      negativePrompt: node.data.wanVaceNegativePrompt || "",
      matchInputNumFrames: node.data.wanVaceMatchInputNumFrames !== false,
      numFrames: node.data.wanVaceNumFrames || 81,
      matchInputFps: node.data.wanVaceMatchInputFps !== false,
      fps: node.data.wanVaceFps || 16,
      resolution: node.data.wanVaceResolution || "auto",
      aspectRatio: node.data.wanVaceAspectRatio || "auto",
      numInferenceSteps: node.data.wanVaceNumInferenceSteps || 30,
      guidanceScale: node.data.wanVaceGuidanceScale || 5,
      sampler: node.data.wanVaceSampler || "unipc",
      shift: node.data.wanVaceShift || 5,
      enableSafetyChecker: node.data.wanVaceEnableSafetyChecker !== false,
      enablePromptExpansion: Boolean(node.data.wanVaceEnablePromptExpansion),
      preprocess: node.data.wanVacePreprocess !== false,
      acceleration: node.data.wanVaceAcceleration || "regular",
      videoQuality: node.data.wanVaceVideoQuality || "high",
      videoWriteMode: node.data.wanVaceVideoWriteMode || "balanced",
      numInterpolatedFrames: node.data.wanVaceNumInterpolatedFrames || 0,
      useReferenceFrames: node.data.wanVaceUseReferenceFrames !== false,
      temporalDownsampleFactor: node.data.wanVaceTemporalDownsampleFactor || 0,
      enableAutoDownsample: Boolean(node.data.wanVaceEnableAutoDownsample),
      autoDownsampleMinFps: node.data.wanVaceAutoDownsampleMinFps || 15,
      interpolatorModel: node.data.wanVaceInterpolatorModel || "film",
      transparencyMode: node.data.wanVaceTransparencyMode || "content_aware",
      seed: node.data.seed || ""
    },
    wanVaceInpainting: {
      negativePrompt: node.data.wanVaceNegativePrompt || "",
      matchInputNumFrames: node.data.wanVaceMatchInputNumFrames !== false,
      numFrames: node.data.wanVaceNumFrames || 81,
      matchInputFps: node.data.wanVaceMatchInputFps !== false,
      fps: node.data.wanVaceFps || 16,
      resolution: node.data.wanVaceResolution || "720p",
      aspectRatio: node.data.wanVaceAspectRatio || "auto",
      numInferenceSteps: node.data.wanVaceNumInferenceSteps || 30,
      guidanceScale: node.data.wanVaceGuidanceScale || 5,
      sampler: node.data.wanVaceSampler || "unipc",
      shift: node.data.wanVaceShift || 5,
      enableSafetyChecker: node.data.wanVaceEnableSafetyChecker !== false,
      enablePromptExpansion: Boolean(node.data.wanVaceEnablePromptExpansion),
      preprocess: Boolean(node.data.wanVacePreprocess),
      acceleration: node.data.wanVaceAcceleration || "regular",
      videoQuality: node.data.wanVaceVideoQuality || "high",
      videoWriteMode: node.data.wanVaceVideoWriteMode || "balanced",
      numInterpolatedFrames: node.data.wanVaceNumInterpolatedFrames || 0,
      useReferenceFrames: node.data.wanVaceUseReferenceFrames !== false,
      temporalDownsampleFactor: node.data.wanVaceTemporalDownsampleFactor || 0,
      enableAutoDownsample: Boolean(node.data.wanVaceEnableAutoDownsample),
      autoDownsampleMinFps: node.data.wanVaceAutoDownsampleMinFps || 15,
      interpolatorModel: node.data.wanVaceInterpolatorModel || "film",
      transparencyMode: node.data.wanVaceTransparencyMode || "content_aware",
      seed: node.data.seed || ""
    },
    voidVideoInpainting: {
      maskPrompt: node.data.voidMaskPrompt || "",
      enablePass2Refinement: Boolean(node.data.voidPass2Refinement),
      negativePrompt: node.data.voidNegativePrompt || "",
      numInferenceSteps: node.data.voidNumInferenceSteps || 30,
      guidanceScale: node.data.voidGuidanceScale || 1,
      strength: node.data.voidStrength || 1,
      numFrames: voidNumFrames,
      enableSafetyChecker: node.data.voidEnableSafetyChecker !== false,
      seed: node.data.voidSeed || ""
    },
    rifeVideo: {
      numFrames: node.data.rifeNumFrames || 1,
      useSceneDetection: node.data.rifeUseSceneDetection !== false,
      useCalculatedFps: node.data.rifeUseCalculatedFps !== false,
      fps: node.data.rifeFps || 24,
      loop: Boolean(node.data.rifeLoop)
    },
    bytedanceVideoUpscaler: {
      targetResolution: node.data.bytedanceUpscalerTargetResolution || "1080p",
      targetFps: node.data.bytedanceUpscalerTargetFps || "30fps",
      enhancementPreset: node.data.bytedanceUpscalerPreset || "general",
      enhancementTier: node.data.bytedanceUpscalerTier || "standard",
      fidelity: node.data.bytedanceUpscalerFidelity || "high",
      scaleRatio: node.data.bytedanceUpscalerScaleRatio || ""
    },
    topazVideoUpscaler: {
      model: node.data.topazUpscalerModel || "Proteus",
      upscaleFactor: node.data.topazUpscalerFactor || 2,
      targetFps: node.data.topazUpscalerTargetFps === "source" ? "" : node.data.topazUpscalerTargetFps || "",
      billingResolutionTier: node.data.topazUpscalerBillingTier || "auto",
      h264Output: Boolean(node.data.topazUpscalerH264Output),
      compression: node.data.topazUpscalerCompression ?? "",
      noise: node.data.topazUpscalerNoise ?? "",
      halo: node.data.topazUpscalerHalo ?? "",
      grain: node.data.topazUpscalerGrain ?? "",
      recoverDetail: node.data.topazUpscalerRecoverDetail ?? ""
    },
    birefnet: {
      model: node.data.birefnetModel || "General Use (Light)",
      operatingResolution: node.data.birefnetOperatingResolution || "1024x1024",
      outputMask: Boolean(node.data.birefnetOutputMask),
      refineForeground: node.data.birefnetRefineForeground !== false,
      outputFormat: node.data.birefnetOutputFormat || "png",
      maskOnly: Boolean(node.data.birefnetMaskOnly),
      videoOutputType: node.data.birefnetVideoOutputType || "X264 (.mp4)",
      videoQuality: node.data.birefnetVideoQuality || "high",
      videoWriteMode: node.data.birefnetVideoWriteMode || "balanced"
    },
    ...workflowContextPayload(workflowContext, projectId, projectName),
    nodeId: node.id,
    nodeTitle: node.data.title
  };
}

export function normalizeUtilityVideoGenerationResult(data, index) {
  if (Array.isArray(data.resultItems) && data.resultItems.length) {
    return data.resultItems
      .filter((item) => item?.localUrl || item?.url)
      .map((item, itemIndex) => ({
        url: item.localUrl || item.url,
        type: item.type || "video",
        label: item.label || `${data.modelName || "Result"} ${itemIndex + 1}`,
        fileName: item.fileName || "",
        mimeType: item.mimeType || "",
        seed: data.seed,
        text: itemIndex === 0 ? data.text || "" : "",
        cost: itemIndex === 0 ? data.cost : null
      }));
  }

  if (data.image?.localUrl) {
    return {
      url: data.image.localUrl,
      type: "image",
      label: data.image.label || data.modelName || `Frame ${index + 1}`,
      text: data.text || "",
      cost: data.cost
    };
  }

  if (Array.isArray(data.videos) && data.videos.length) {
    return data.videos
      .filter((video) => video?.localUrl)
      .map((video, itemIndex) => ({
        url: video.localUrl,
        type: "video",
        label: video.label || `${data.modelName || "Video"} ${itemIndex + 1}`,
        seed: data.seed,
        cost: itemIndex === 0 ? data.cost : null
      }));
  }

  return {
    url: data.video.localUrl,
    type: "video",
    label: data.modelName || `Video ${index + 1}`,
    seed: data.seed,
    cost: data.cost
  };
}
