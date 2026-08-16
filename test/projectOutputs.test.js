import test from "node:test";
import assert from "node:assert/strict";
import { adjacentProjectOutputImage, buildProjectOutputItems } from "../src/projectOutputs.js";

test("project output image navigation skips other media and wraps", () => {
  const items = [
    { id: "image-1", type: "image", url: "/outputs/one.png" },
    { id: "video-1", type: "video", url: "/outputs/movie.mp4" },
    { id: "image-2", type: "image", url: "/outputs/two.png" }
  ];

  assert.equal(adjacentProjectOutputImage(items, items[0], 1)?.id, "image-2");
  assert.equal(adjacentProjectOutputImage(items, items[2], 1)?.id, "image-1");
  assert.equal(adjacentProjectOutputImage(items, items[0], -1)?.id, "image-2");
  assert.equal(adjacentProjectOutputImage(items, items[1], 1), null);
});

test("buildProjectOutputItems includes Transition Builder history influence outputs", () => {
  const refinedUrl = "/workflow-assets/project/outputs/transition-mask-influenced-morph.mp4";
  const rawUrl = "/workflow-assets/project/outputs/transition-raw-lora-morph.mp4";
  const maskUrl = "/workflow-assets/project/outputs/transition-influence-mask.mp4";
  const outputs = buildProjectOutputItems({
    nodes: [],
    history: [
      {
        id: "history-1",
        createdAt: "2026-06-02T19:35:44.003Z",
        mediaType: "video",
        modelName: "Transition Builder",
        mode: "Wan 2.2 LoRA influence-mask morph",
        project: { id: "project", name: "Project" },
        localVideo: refinedUrl,
        localVideos: [refinedUrl, rawUrl, maskUrl],
        outputFileName: "transition-mask-influenced-morph.mp4",
        outputFileNames: ["transition-mask-influenced-morph.mp4", "transition-raw-lora-morph.mp4", "transition-influence-mask.mp4"]
      }
    ],
    projectId: "project",
    projectName: "Project",
    getNodeResultMediaType: () => "",
    titleFallback: () => "Node"
  });

  assert.deepEqual(outputs.map((item) => item.url), [refinedUrl, rawUrl, maskUrl]);
  assert.deepEqual(outputs.map((item) => item.label), ["Mask-Influenced Morph", "Raw LoRA Morph", "Influence Mask"]);
  assert.deepEqual(outputs.map((item) => item.fileName), ["transition-mask-influenced-morph.mp4", "transition-raw-lora-morph.mp4", "transition-influence-mask.mp4"]);
});

test("buildProjectOutputItems includes live Transition Builder influence outputs", () => {
  const refinedUrl = "/workflow-assets/project/outputs/live-mask-influenced.mp4";
  const rawUrl = "/workflow-assets/project/outputs/live-raw-lora.mp4";
  const maskUrl = "/workflow-assets/project/outputs/live-influence-mask.mp4";
  const outputs = buildProjectOutputItems({
    nodes: [
      {
        id: "utility-1",
        type: "utility",
        data: {
          title: "Transition Builder",
          resultUrl: refinedUrl,
          resultItems: [
            { url: refinedUrl, type: "video", label: "Mask-Influenced Morph", fileName: "live-mask-influenced.mp4" },
            { url: rawUrl, type: "video", label: "Raw LoRA Morph", fileName: "live-raw-lora.mp4" },
            { url: maskUrl, type: "video", label: "Influence Mask", fileName: "live-influence-mask.mp4" }
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

  assert.deepEqual(outputs.map((item) => item.url), [refinedUrl, rawUrl, maskUrl]);
  assert.deepEqual(outputs.map((item) => item.label), ["Mask-Influenced Morph", "Raw LoRA Morph", "Influence Mask"]);
});

test("buildProjectOutputItems uses Transition Builder persisted output labels", () => {
  const refinedUrl = "/workflow-assets/project/outputs/generated.mp4";
  const rawUrl = "/workflow-assets/project/outputs/raw.mp4";
  const maskUrl = "/workflow-assets/project/outputs/mask.mp4";
  const outputs = buildProjectOutputItems({
    nodes: [],
    history: [
      {
        id: "history-generated",
        createdAt: "2026-06-03T19:35:44.003Z",
        mediaType: "video",
        modelName: "Transition Builder",
        mode: "Wan 2.2 LoRA influence-mask morph",
        project: { id: "project", name: "Project" },
        localVideo: refinedUrl,
        localVideos: [refinedUrl, rawUrl, maskUrl],
        outputLabels: ["Final Morph", "Diagnostic Raw", "Normalized Mask"]
      }
    ],
    projectId: "project",
    projectName: "Project",
    getNodeResultMediaType: () => "",
    titleFallback: () => "Node"
  });

  assert.deepEqual(outputs.map((item) => item.url), [refinedUrl, rawUrl, maskUrl]);
  assert.deepEqual(outputs.map((item) => item.label), ["Final Morph", "Diagnostic Raw", "Normalized Mask"]);
});

test("project outputs preserve lightweight thumbnails for generated images", () => {
  const items = buildProjectOutputItems({
    nodes: [{
      id: "image-model-1",
      type: "imageModel",
      data: {
        title: "Image Model",
        resultUrl: "/outputs/project/full.png",
        resultItems: [{
          url: "/outputs/project/full.png",
          thumbnailUrl: "/outputs/project/full-preview.jpg",
          type: "image"
        }]
      }
    }],
    history: [],
    projectId: "project-1",
    projectName: "Project",
    getNodeResultMediaType: () => "image"
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].url, "/outputs/project/full.png");
  assert.equal(items[0].thumbnailUrl, "/outputs/project/full-preview.jpg");
});

test("history outputs use the matching thumbnail without replacing the full asset URL", () => {
  const items = buildProjectOutputItems({
    nodes: [],
    history: [{
      id: "history-1",
      mediaType: "image",
      project: { id: "project-1", name: "Project" },
      localImage: "/outputs/project/history.png",
      localThumbnail: "/outputs/project/history-preview.jpg"
    }],
    projectId: "project-1",
    projectName: "Project",
    getNodeResultMediaType: () => ""
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].url, "/outputs/project/history.png");
  assert.equal(items[0].thumbnailUrl, "/outputs/project/history-preview.jpg");
});
