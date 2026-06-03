import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectOutputItems } from "../src/projectOutputs.js";

test("buildProjectOutputItems includes both Transition Builder history outputs", () => {
  const controlUrl = "/workflow-assets/project/outputs/transition-control-video.mp4";
  const maskUrl = "/workflow-assets/project/outputs/transition-mask-video.mp4";
  const guideUrl = "/workflow-assets/project/outputs/transition-guide-01.png";
  const outputs = buildProjectOutputItems({
    nodes: [],
    history: [
      {
        id: "history-1",
        createdAt: "2026-06-02T19:35:44.003Z",
        mediaType: "video",
        modelName: "Transition Builder",
        mode: "VACE transition builder",
        project: { id: "project", name: "Project" },
        localVideo: controlUrl,
        localVideos: [controlUrl, maskUrl],
        localImages: [guideUrl],
        outputFileName: "transition-control-video.mp4",
        outputFileNames: ["transition-control-video.mp4", "transition-mask-video.mp4", "transition-guide-01.png"]
      }
    ],
    projectId: "project",
    projectName: "Project",
    getNodeResultMediaType: () => "",
    titleFallback: () => "Node"
  });

  assert.deepEqual(outputs.map((item) => item.url), [controlUrl, maskUrl, guideUrl]);
  assert.deepEqual(outputs.map((item) => item.label), ["Control Video", "Mask Video", "Guide 01"]);
  assert.deepEqual(outputs.map((item) => item.fileName), ["transition-control-video.mp4", "transition-mask-video.mp4", "transition-guide-01.png"]);
});

test("buildProjectOutputItems includes both live Transition Builder node outputs", () => {
  const controlUrl = "/workflow-assets/project/outputs/live-control.mp4";
  const maskUrl = "/workflow-assets/project/outputs/live-mask.mp4";
  const guideUrl = "/workflow-assets/project/outputs/live-guide-01.png";
  const outputs = buildProjectOutputItems({
    nodes: [
      {
        id: "utility-1",
        type: "utility",
        data: {
          title: "Transition Builder",
          resultUrl: controlUrl,
          resultItems: [
            { url: controlUrl, type: "video", label: "Control Video", fileName: "live-control.mp4" },
            { url: maskUrl, type: "video", label: "Mask Video", fileName: "live-mask.mp4" },
            { url: guideUrl, type: "image", label: "Guide 01", fileName: "live-guide-01.png" }
          ]
        }
      }
    ],
    history: [],
    projectId: "project",
    projectName: "Project",
    getNodeResultMediaType: () => "video",
    titleFallback: () => "Node"
  });

  assert.deepEqual(outputs.map((item) => item.url), [controlUrl, maskUrl, guideUrl]);
  assert.deepEqual(outputs.map((item) => item.label), ["Control Video", "Mask Video", "Guide 01"]);
});

test("buildProjectOutputItems uses Transition Builder generated output labels", () => {
  const generatedUrl = "/workflow-assets/project/outputs/generated.mp4";
  const controlUrl = "/workflow-assets/project/outputs/control.mp4";
  const guideUrl = "/workflow-assets/project/outputs/guide-01.png";
  const outputs = buildProjectOutputItems({
    nodes: [],
    history: [
      {
        id: "history-generated",
        createdAt: "2026-06-03T19:35:44.003Z",
        mediaType: "video",
        modelName: "Transition Builder",
        mode: "Wan 2.2 LoRA transition generator",
        project: { id: "project", name: "Project" },
        localVideo: generatedUrl,
        localVideos: [generatedUrl, controlUrl],
        localImages: [guideUrl],
        outputLabels: ["Generated Transition", "Control Video", "Guide 01"]
      }
    ],
    projectId: "project",
    projectName: "Project",
    getNodeResultMediaType: () => "",
    titleFallback: () => "Node"
  });

  assert.deepEqual(outputs.map((item) => item.url), [generatedUrl, controlUrl, guideUrl]);
  assert.deepEqual(outputs.map((item) => item.label), ["Generated Transition", "Control Video", "Guide 01"]);
});
