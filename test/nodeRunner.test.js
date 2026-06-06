import test from "node:test";
import assert from "node:assert/strict";
import {
  appendedNodeResultState,
  batchRunError,
  fulfilledRunValues,
  rejectedRunResults,
  runRunnableNodesByDependencyOrder
} from "../src/nodeRunner.js";
import { buildUtilityVideoRequest } from "../src/nodeRunners/videoModels.js";

test("runRunnableNodesByDependencyOrder respects dependency order and stage priority", async () => {
  const nodes = [
    { id: "video", type: "videoModel", data: {} },
    { id: "text", type: "text", data: { title: "Text" } },
    { id: "image", type: "imageModel", data: { title: "Image" } }
  ];
  const edges = [
    { from: { nodeId: "text" }, to: { nodeId: "image" } },
    { from: { nodeId: "image" }, to: { nodeId: "video" } }
  ];
  const order = [];
  const statuses = [];

  const result = await runRunnableNodesByDependencyOrder(nodes, edges, {
    runNode: async (node) => {
      order.push(node.id);
      return { status: "complete" };
    },
    onStatus: (message) => statuses.push(message)
  });

  assert.deepEqual(order, ["text", "image", "video"]);
  assert.deepEqual(result, { completed: 3, failed: 0, skipped: 0 });
  assert.equal(statuses[0], "Running 1 text model node...");
});

test("runRunnableNodesByDependencyOrder skips dependents after failure", async () => {
  const nodes = [
    { id: "image", type: "imageModel", data: { title: "Image" } },
    { id: "video", type: "videoModel", data: { title: "Video" } }
  ];
  const edges = [{ from: { nodeId: "image" }, to: { nodeId: "video" } }];
  const skipped = [];

  const result = await runRunnableNodesByDependencyOrder(nodes, edges, {
    runNode: async (node) => (node.id === "image" ? { status: "error", error: new Error("bad image") } : { status: "complete" }),
    onNodeSkipped: (nodeId, message) => skipped.push({ nodeId, message })
  });

  assert.deepEqual(result, { completed: 0, failed: 1, skipped: 1 });
  assert.deepEqual(skipped, [{ nodeId: "video", message: "Skipped because Image did not complete." }]);
});

test("result helpers aggregate successful and failed batch results", () => {
  const settled = [
    { status: "fulfilled", value: { url: "/outputs/a.png", text: "A" } },
    { status: "rejected", reason: new Error("nope") },
    { status: "fulfilled", value: [{ url: "/outputs/b.png" }] }
  ];
  assert.equal(fulfilledRunValues(settled).length, 2);
  assert.equal(fulfilledRunValues(settled, { flatten: true }).length, 2);
  assert.equal(rejectedRunResults(settled).length, 1);
  assert.equal(batchRunError("image", 3, fulfilledRunValues(settled), rejectedRunResults(settled)), "2 of 3 image generations complete. nope");

  const state = appendedNodeResultState([{ url: "/outputs/old.png" }], [{ url: "/outputs/new.png" }], "image");
  assert.equal(state.firstNewIndex, 1);
  assert.deepEqual(state.resultItems.map((item) => item.type), ["image", "image"]);
});

test("buildUtilityVideoRequest preserves Wan VACE transition settings", () => {
  const request = buildUtilityVideoRequest({
    node: {
      id: "utility-1",
      data: {
        title: "Utility",
        wanVaceUseReferenceFrames: true,
        wanVaceTemporalDownsampleFactor: 2,
        wanVaceEnableAutoDownsample: true,
        wanVaceAutoDownsampleMinFps: 12,
        wanVaceInterpolatorModel: "rife",
        wanVaceTransparencyMode: "white",
        seed: "123"
      }
    },
    prompt: "motion morph",
    model: "Wan 2.2 VACE Inpainting",
    workflowContext: {},
    projectId: "project",
    projectName: "Project",
    referenceImageUrls: ["/uploads/a.png", "/uploads/b.png"],
    referenceVideoUrls: ["/uploads/source.mp4"],
    maskVideoUrls: ["/uploads/mask.mp4"]
  });

  assert.equal(request.wanVaceInpainting.useReferenceFrames, true);
  assert.equal(request.wanVaceInpainting.temporalDownsampleFactor, 2);
  assert.equal(request.wanVaceInpainting.enableAutoDownsample, true);
  assert.equal(request.wanVaceInpainting.autoDownsampleMinFps, 12);
  assert.equal(request.wanVaceInpainting.interpolatorModel, "rife");
  assert.equal(request.wanVaceInpainting.transparencyMode, "white");
  assert.equal(request.wanVaceInpainting.seed, "123");
});

test("buildUtilityVideoRequest sends Wan 2.2 VACE control settings", () => {
  const request = buildUtilityVideoRequest({
    node: {
      id: "utility-control",
      data: {
        title: "Utility",
        utilityVideoModel: "Wan 2.2 VACE Fun A14B Depth",
        wanVaceResolution: "auto",
        wanVaceAspectRatio: "auto",
        wanVacePreprocess: true,
        wanVaceUseReferenceFrames: true,
        wanVaceTemporalDownsampleFactor: 3,
        wanVaceEnableAutoDownsample: true,
        wanVaceAutoDownsampleMinFps: 10,
        seed: "456"
      }
    },
    prompt: "guided motion",
    model: "Wan 2.2 VACE Fun A14B Depth",
    workflowContext: {},
    projectId: "project",
    projectName: "Project",
    referenceImageUrls: ["/uploads/first.png", "/uploads/last.png"],
    referenceVideoUrls: ["/uploads/source.mp4"],
    maskVideoUrls: []
  });

  assert.equal(request.wanVaceControl.resolution, "auto");
  assert.equal(request.wanVaceControl.aspectRatio, "auto");
  assert.equal(request.wanVaceControl.preprocess, true);
  assert.equal(request.wanVaceControl.useReferenceFrames, true);
  assert.equal(request.wanVaceControl.temporalDownsampleFactor, 3);
  assert.equal(request.wanVaceControl.enableAutoDownsample, true);
  assert.equal(request.wanVaceControl.autoDownsampleMinFps, 10);
  assert.equal(request.wanVaceControl.seed, "456");
});

test("buildUtilityVideoRequest sends Wan 2.1 LoRA settings", () => {
  const request = buildUtilityVideoRequest({
    node: {
      id: "utility-wan21",
      data: {
        title: "Utility",
        utilityVideoModel: "Wan 2.1 14B LoRA Image-to-Video",
        wan21LoraNegativePrompt: "blur",
        wan21LoraResolution: "720p",
        wan21LoraAspectRatio: "auto",
        wan21LoraNumFrames: 81,
        wan21LoraFps: 16,
        wan21LoraNumInferenceSteps: 30,
        wan21LoraGuideScale: 6,
        wan21LoraShift: 4,
        wan21LoraEnableSafetyChecker: true,
        wan21LoraEnablePromptExpansion: false,
        wan21LoraTurboMode: true,
        wan21LoraReverseVideo: true,
        wan21Loras: [
          { path: "https://huggingface.co/org/model/resolve/main/lora.safetensors", weightName: "lora.safetensors", scale: "0.8" },
          { path: "", weightName: "", scale: "1" }
        ],
        seed: "789"
      }
    },
    prompt: "stylized motion",
    model: "Wan 2.1 14B LoRA Image-to-Video",
    workflowContext: {},
    projectId: "project",
    projectName: "Project",
    referenceImageUrls: ["/uploads/start.png"],
    referenceVideoUrls: [],
    maskVideoUrls: []
  });

  assert.equal(request.wan21Lora.negativePrompt, "blur");
  assert.equal(request.wan21Lora.resolution, "720p");
  assert.equal(request.wan21Lora.aspectRatio, "auto");
  assert.equal(request.wan21Lora.guideScale, 6);
  assert.equal(request.wan21Lora.shift, 4);
  assert.equal(request.wan21Lora.reverseVideo, true);
  assert.equal(request.wan21Lora.loras.length, 2);
  assert.equal(request.wan21Lora.loras[0].path, "https://huggingface.co/org/model/resolve/main/lora.safetensors");
  assert.equal(request.wan21Lora.loras[0].weightName, "lora.safetensors");
  assert.equal(request.wan21Lora.loras[0].scale, "0.8");
  assert.equal(request.wan21Lora.seed, "789");
});

test("buildUtilityVideoRequest sends Wan 2.2 A14B LoRA settings", () => {
  const request = buildUtilityVideoRequest({
    node: {
      id: "utility-wan22",
      data: {
        title: "Utility",
        utilityVideoModel: "Wan 2.2 A14B LoRA Image-to-Video",
        wan22A14bNegativePrompt: "low detail",
        wan22A14bResolution: "720p",
        wan22A14bAspectRatio: "auto",
        wan22A14bNumFrames: 81,
        wan22A14bFps: 16,
        wan22A14bNumInferenceSteps: 27,
        wan22A14bGuidanceScale: 3.5,
        wan22A14bGuidanceScale2: 4,
        wan22A14bShift: 5,
        wan22A14bEnableSafetyChecker: true,
        wan22A14bEnableOutputSafetyChecker: true,
        wan22A14bEnablePromptExpansion: false,
        wan22A14bAcceleration: "regular",
        wan22A14bInterpolatorModel: "film",
        wan22A14bNumInterpolatedFrames: 1,
        wan22A14bAdjustFpsForInterpolation: true,
        wan22A14bVideoQuality: "maximum",
        wan22A14bVideoWriteMode: "small",
        wan22A14bReverseVideo: true,
        wan22A14bLoras: [
          { path: "C:\\models\\wan22\\motion.safetensors", weightName: "motion.safetensors", scale: "1.2" },
          { path: "", weightName: "", scale: "1" }
        ],
        seed: "2468"
      }
    },
    prompt: "ink morph",
    model: "Wan 2.2 A14B LoRA Image-to-Video",
    workflowContext: {},
    projectId: "project",
    projectName: "Project",
    referenceImageUrls: ["/uploads/start.png", "/uploads/end.png"],
    referenceVideoUrls: [],
    maskVideoUrls: []
  });

  assert.equal(request.wan22A14b.negativePrompt, "low detail");
  assert.equal(request.wan22A14b.resolution, "720p");
  assert.equal(request.wan22A14b.aspectRatio, "auto");
  assert.equal(request.wan22A14b.guidanceScale, 3.5);
  assert.equal(request.wan22A14b.guidanceScale2, 4);
  assert.equal(request.wan22A14b.shift, 5);
  assert.equal(request.wan22A14b.enableOutputSafetyChecker, true);
  assert.equal(request.wan22A14b.interpolatorModel, "film");
  assert.equal(request.wan22A14b.numInterpolatedFrames, 1);
  assert.equal(request.wan22A14b.adjustFpsForInterpolation, true);
  assert.equal(request.wan22A14b.videoQuality, "maximum");
  assert.equal(request.wan22A14b.videoWriteMode, "small");
  assert.equal(request.wan22A14b.reverseVideo, true);
  assert.equal(request.wan22A14b.loras.length, 2);
  assert.equal(request.wan22A14b.loras[0].path, "C:\\models\\wan22\\motion.safetensors");
  assert.equal(request.wan22A14b.loras[0].weightName, "motion.safetensors");
  assert.equal(request.wan22A14b.loras[0].scale, "1.2");
  assert.equal(request.wan22A14b.seed, "2468");
});

test("buildUtilityVideoRequest preserves Transition Builder settings", () => {
  const request = buildUtilityVideoRequest({
    node: {
      id: "utility-transition",
      data: {
        title: "Transition",
        transitionMaskSoftness: 4,
        transitionWanNegativePrompt: "blurry",
        transitionWanNumFrames: 41,
        transitionWanFps: 12,
        transitionWanResolution: "580p",
        transitionWanAspectRatio: "auto",
        transitionWanNumInferenceSteps: 20,
        transitionWanGuidanceScale: 3.25,
        transitionWanGuidanceScale2: 3.75,
        transitionWanShift: 4.5,
        transitionWanLoras: [
          { path: "C:\\models\\wan\\motion.safetensors", weightName: "motion", scale: "1.1" }
        ],
        transitionVaceNegativePrompt: "flat composite",
        transitionVaceResolution: "480p",
        transitionVaceAspectRatio: "16:9",
        transitionVaceNumInferenceSteps: 24,
        transitionVaceGuidanceScale: 6.5,
        transitionVaceSampler: "euler",
        transitionVaceShift: 4,
        transitionVaceEnableSafetyChecker: false,
        transitionVaceEnablePromptExpansion: true,
        transitionVacePreprocess: true,
        transitionVaceAcceleration: "low",
        transitionVaceVideoQuality: "maximum",
        transitionVaceVideoWriteMode: "small",
        transitionVaceNumInterpolatedFrames: 1,
        transitionVaceTemporalDownsampleFactor: 2,
        transitionVaceEnableAutoDownsample: true,
        transitionVaceAutoDownsampleMinFps: 10,
        transitionVaceInterpolatorModel: "rife",
        transitionVaceTransparencyMode: "white",
        seed: "777"
      }
    },
    prompt: "",
    model: "Transition Builder",
    workflowContext: {},
    projectId: "project",
    projectName: "Project",
    referenceImageUrls: ["/uploads/a.png", "/uploads/b.png"],
    referenceVideoUrls: [],
    maskVideoUrls: ["/uploads/matte.mp4"]
  });

  assert.equal(request.transitionBuilder.maskSoftness, 4);
  assert.equal(request.transitionBuilder.wanNegativePrompt, "blurry");
  assert.equal(request.transitionBuilder.wanNumFrames, 41);
  assert.equal(request.transitionBuilder.wanFps, 12);
  assert.equal(request.transitionBuilder.wanResolution, "580p");
  assert.equal(request.transitionBuilder.wanAspectRatio, "auto");
  assert.equal(request.transitionBuilder.wanNumInferenceSteps, 20);
  assert.equal(request.transitionBuilder.wanGuidanceScale, 3.25);
  assert.equal(request.transitionBuilder.wanGuidanceScale2, 3.75);
  assert.equal(request.transitionBuilder.wanShift, 4.5);
  assert.equal(request.transitionBuilder.wanLoras.length, 1);
  assert.equal(request.transitionBuilder.wanLoras[0].path, "C:\\models\\wan\\motion.safetensors");
  assert.equal(request.transitionBuilder.vaceNegativePrompt, "flat composite");
  assert.equal(request.transitionBuilder.vaceResolution, "480p");
  assert.equal(request.transitionBuilder.vaceAspectRatio, "16:9");
  assert.equal(request.transitionBuilder.vaceNumInferenceSteps, 24);
  assert.equal(request.transitionBuilder.vaceGuidanceScale, 6.5);
  assert.equal(request.transitionBuilder.vaceSampler, "euler");
  assert.equal(request.transitionBuilder.vaceShift, 4);
  assert.equal(request.transitionBuilder.vaceEnableSafetyChecker, false);
  assert.equal(request.transitionBuilder.vaceEnablePromptExpansion, true);
  assert.equal(request.transitionBuilder.vacePreprocess, true);
  assert.equal(request.transitionBuilder.vaceAcceleration, "low");
  assert.equal(request.transitionBuilder.vaceVideoQuality, "maximum");
  assert.equal(request.transitionBuilder.vaceVideoWriteMode, "small");
  assert.equal(request.transitionBuilder.vaceNumInterpolatedFrames, 1);
  assert.equal(request.transitionBuilder.vaceTemporalDownsampleFactor, 2);
  assert.equal(request.transitionBuilder.vaceEnableAutoDownsample, true);
  assert.equal(request.transitionBuilder.vaceAutoDownsampleMinFps, 10);
  assert.equal(request.transitionBuilder.vaceInterpolatorModel, "rife");
  assert.equal(request.transitionBuilder.vaceTransparencyMode, "white");
  assert.equal(request.transitionBuilder.seed, "777");
  assert.equal(request.transitionBuilder.frameCount, undefined);
  assert.equal(request.transitionBuilder.maskStyle, undefined);
  assert.equal(request.transitionBuilder.wanSchedulerEnabled, undefined);
});

test("buildUtilityVideoRequest preserves WanWarp quality controls", () => {
  const wanWarpSegments = [
    {
      role: "A",
      prompt: "morph",
      startImageUrl: "/uploads/a.png",
      endImageUrl: "/uploads/b.png",
      motionVideoUrl: "/uploads/motion.mp4",
      depthVideoUrl: "/uploads/depth.mp4"
    }
  ];
  const videoStitch = {
    loop: true,
    outputFormat: "mp4",
    keyTrimFrames: 5,
    blendFrames: 4,
    samplerSteps: 6,
    samplerStepsToRun: 3,
    distillLoraHigh: 1.8,
    distillLoraLow: 0.9,
    motionLoraHigh: 1.2,
    motionLoraLow: 0.35,
    crf: 8,
    wanWarpSegments
  };

  const request = buildUtilityVideoRequest({
    node: {
      id: "utility-wanwarp",
      data: {
        title: "WanWarp"
      }
    },
    prompt: "",
    model: "WanWarp",
    workflowContext: {},
    projectId: "project",
    projectName: "Project",
    referenceVideoUrls: [],
    wanWarpSegments,
    videoStitch
  });

  assert.deepEqual(request.wanWarpSegments, wanWarpSegments);
  assert.equal(request.videoStitch.samplerSteps, 6);
  assert.equal(request.videoStitch.samplerStepsToRun, 3);
  assert.equal(request.videoStitch.distillLoraHigh, 1.8);
  assert.equal(request.videoStitch.distillLoraLow, 0.9);
  assert.equal(request.videoStitch.motionLoraHigh, 1.2);
  assert.equal(request.videoStitch.motionLoraLow, 0.35);
  assert.equal(request.videoStitch.crf, 8);
});

test("buildUtilityVideoRequest preserves Depth Anything Video controls", () => {
  const request = buildUtilityVideoRequest({
    node: {
      id: "utility-depth-video",
      data: {
        title: "Depth Anything Video",
        depthAnythingVideoModel: "VDA-Base",
        depthAnythingVideoColormap: "turbo",
        depthAnythingVideoResolution: "720p",
        depthAnythingVideoMaxFrames: "120",
        depthAnythingVideoOutputFps: "24",
        depthAnythingVideoSideBySide: true
      }
    },
    prompt: "",
    model: "Depth Anything Video",
    workflowContext: {},
    projectId: "project",
    projectName: "Project",
    referenceVideoUrls: ["/outputs/source.mp4"]
  });

  assert.equal(request.depthAnythingVideo.model, "VDA-Base");
  assert.equal(request.depthAnythingVideo.colormap, "turbo");
  assert.equal(request.depthAnythingVideo.resolution, "720p");
  assert.equal(request.depthAnythingVideo.maxFrames, "120");
  assert.equal(request.depthAnythingVideo.outputFps, "24");
  assert.equal(request.depthAnythingVideo.sideBySide, true);
});
