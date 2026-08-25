import assert from "node:assert/strict";
import test from "node:test";

import {
  fullResolutionContextPreparedAttribute,
  clearOutputItemDragData,
  displayMediaUrl,
  fullResolutionImageProps,
  fullResolutionPreviewSourceAttribute,
  fullResolutionOutputItem,
  fullResolutionImageUrl,
  hasOutputItemDragData,
  isLocalDraggableMediaUrl,
  isLocalThumbnailUrl,
  nextFullResolutionImageFallback,
  outputItemFromDataTransfer,
  prepareFullResolutionImageForNativeSave,
  previewImageUrl,
  restoreFullResolutionImagePreview,
  setOutputItemDragData,
  supportedFilesFromDataTransfer
} from "../src/mediaAssets.js";
import { nodeTypeForOutputItem } from "../src/nodeRegistry.js";

test("active Newt Node output drags remain droppable when the browser hides custom MIME types", () => {
  const previousWindow = globalThis.window;
  const values = new Map();
  const dataTransfer = {
    types: [],
    effectAllowed: "none",
    setData(type, value) {
      values.set(type, value);
    },
    getData(type) {
      return values.get(type) || "";
    }
  };
  const item = {
    id: "video-node-1:/outputs/shot.mp4",
    url: "/outputs/shot.mp4",
    type: "video",
    sourceNodeId: "video-node-1",
    sourcePort: "videoOut"
  };
  globalThis.window = {};

  try {
    setOutputItemDragData(dataTransfer, item);
    assert.equal(hasOutputItemDragData(dataTransfer), true);
    assert.equal(JSON.parse(values.get("application/x-newtnode-output")).sourceNodeId, "video-node-1");
    const droppedItem = outputItemFromDataTransfer(dataTransfer);
    assert.equal(droppedItem.type, "video");
    assert.equal(droppedItem.url, "/outputs/shot.mp4");
    assert.equal(nodeTypeForOutputItem(droppedItem), "video");
    clearOutputItemDragData(item);
    assert.equal(hasOutputItemDragData(dataTransfer), false);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("multi-file drops preserve the complete browser file list", async () => {
  const first = { name: "first.png", type: "image/png", size: 100, lastModified: 1 };
  const second = { name: "second.mp4", type: "video/mp4", size: 200, lastModified: 2 };
  const itemCopyOfFirst = { ...first };
  const files = await supportedFilesFromDataTransfer({
    files: [first, second],
    items: [{ kind: "file", getAsFile: () => itemCopyOfFirst }]
  });

  assert.deepEqual(files, [first, second]);
});

test("thumbnail assets are display-only and cannot become draggable working media", () => {
  const localThumbnail = "/outputs/Test/thumbnails/image-preview.jpg";
  const packagedThumbnail = "/workflow-assets/project-1/thumbnails/image-preview.jpg";

  assert.equal(isLocalThumbnailUrl(localThumbnail), true);
  assert.equal(isLocalThumbnailUrl(packagedThumbnail), true);
  assert.equal(isLocalDraggableMediaUrl(localThumbnail), false);
  assert.equal(isLocalDraggableMediaUrl(packagedThumbnail), false);
});

test("drag payloads always prefer a full-resolution asset", () => {
  const item = fullResolutionOutputItem({
    type: "image",
    url: "/outputs/Test/thumbnails/image-preview.jpg",
    fullResolutionUrl: "/outputs/Test/image.png",
    thumbnailUrl: "/outputs/Test/thumbnails/image-preview.jpg"
  });

  assert.equal(item.url, "/outputs/Test/image.png");
  assert.equal(item.thumbnailUrl, "/outputs/Test/thumbnails/image-preview.jpg");
});

test("external Output node saves are treated as local draggable media", () => {
  const externalUrl = "/external-outputs/QzpcUmVuZGVyc1xPdXRwdXQgQ29weV8wMi5tcDQ/Output%20Copy_02.mp4";

  assert.equal(isLocalDraggableMediaUrl(externalUrl), true);
  assert.equal(fullResolutionOutputItem({ type: "video", url: externalUrl })?.url, externalUrl);
});

test("external Output node media display bypasses the Vite frontend server", () => {
  const previousWindow = globalThis.window;
  const externalUrl = "/external-outputs/QzpcUmVuZGVyc1xPdXRwdXQgQ29weV8wMi5tcDQ/Output%20Copy_02.mp4";
  globalThis.window = {
    location: {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "5176"
    }
  };

  try {
    assert.equal(
      displayMediaUrl(externalUrl),
      `http://127.0.0.1:3336${externalUrl}`
    );
  } finally {
    globalThis.window = previousWindow;
  }
});

test("workflow package media display bypasses the Vite frontend server", () => {
  const previousWindow = globalThis.window;
  const workflowAssetUrl = "/workflow-assets/project-1/outputs/frame.png";
  const thumbnailUrl = `/api/media-thumbnail?url=${encodeURIComponent(workflowAssetUrl)}`;
  globalThis.window = {
    location: {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "5176"
    }
  };

  try {
    assert.equal(
      displayMediaUrl(workflowAssetUrl),
      `http://127.0.0.1:3336${workflowAssetUrl}`
    );
    assert.equal(
      displayMediaUrl(thumbnailUrl),
      `http://127.0.0.1:3336${thumbnailUrl}`
    );
    assert.equal(
      displayMediaUrl(`http://127.0.0.1:5176${workflowAssetUrl}`),
      `http://127.0.0.1:3336${workflowAssetUrl}`
    );
  } finally {
    globalThis.window = previousWindow;
  }
});

test("thumbnail-only drag payloads are rejected", () => {
  assert.equal(fullResolutionOutputItem({
    type: "image",
    url: "/outputs/Test/thumbnails/image-preview.jpg"
  }), null);
});

test("local canvas images use the runtime thumbnail endpoint", () => {
  assert.equal(
    previewImageUrl("/outputs/Test/full-resolution.png"),
    "/api/media-thumbnail?url=%2Foutputs%2FTest%2Ffull-resolution.png"
  );
  assert.equal(
    previewImageUrl("/uploads/reference.jpg?v=2"),
    "/api/media-thumbnail?url=%2Fuploads%2Freference.jpg%3Fv%3D2"
  );
});

test("full-resolution image display never swaps to a proxy thumbnail", () => {
  assert.equal(
    fullResolutionImageUrl({
      type: "image",
      url: "/outputs/Test/full-resolution.png",
      thumbnailUrl: "/outputs/Test/thumbnails/full-resolution-preview.jpg"
    }),
    "/outputs/Test/full-resolution.png"
  );
  assert.equal(
    fullResolutionImageUrl({
      type: "image",
      url: "/outputs/Test/thumbnails/full-resolution-preview.jpg",
      fullResolutionUrl: "/outputs/Test/full-resolution.png",
      thumbnailUrl: "/outputs/Test/thumbnails/full-resolution-preview.jpg"
    }),
    "/outputs/Test/full-resolution.png"
  );
});

test("existing thumbnails and remote images are preserved", () => {
  assert.equal(
    previewImageUrl({
      url: "/outputs/Test/full-resolution.png",
      thumbnailUrl: "/outputs/Test/thumbnails/full-resolution-preview.jpg"
    }),
    "/outputs/Test/thumbnails/full-resolution-preview.jpg"
  );
  assert.equal(previewImageUrl("https://example.com/image.png"), "https://example.com/image.png");
});

test("thumbnail context downloads point at the full-resolution image", () => {
  assert.deepEqual(
    fullResolutionImageProps({
      url: "/outputs/Test/full-resolution.png",
      thumbnailUrl: "/outputs/Test/thumbnails/full-resolution-preview.jpg",
      fileName: "final-image.png"
    }),
    {
      "data-full-resolution-url": "/outputs/Test/full-resolution.png",
      "data-full-resolution-file-name": "final-image.png"
    }
  );
});

test("thumbnail-only images do not expose a download target", () => {
  assert.deepEqual(
    fullResolutionImageProps("/outputs/Test/thumbnails/full-resolution-preview.jpg"),
    {}
  );
});

test("native image context menus temporarily expose the full-resolution source", () => {
  const attributes = new Map([
    ["src", "/api/media-thumbnail?url=%2Foutputs%2FTest%2Ffull-resolution.png"],
    ["data-full-resolution-url", "/outputs/Test/full-resolution.png"]
  ]);
  const image = {
    dataset: { fullResolutionUrl: "/outputs/Test/full-resolution.png" },
    getAttribute(name) {
      return attributes.get(name) || "";
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    removeAttribute(name) {
      attributes.delete(name);
    }
  };

  assert.equal(prepareFullResolutionImageForNativeSave(image), true);
  assert.equal(attributes.get("src"), "/outputs/Test/full-resolution.png");
  assert.equal(attributes.get(fullResolutionContextPreparedAttribute), "true");
  assert.equal(
    attributes.get(fullResolutionPreviewSourceAttribute),
    "/api/media-thumbnail?url=%2Foutputs%2FTest%2Ffull-resolution.png"
  );

  assert.equal(restoreFullResolutionImagePreview(image), true);
  assert.equal(
    attributes.get("src"),
    "/api/media-thumbnail?url=%2Foutputs%2FTest%2Ffull-resolution.png"
  );
  assert.equal(attributes.has(fullResolutionContextPreparedAttribute), false);
  assert.equal(attributes.has(fullResolutionPreviewSourceAttribute), false);
});

test("broken preview thumbnails retry the full-resolution image before using the logo", () => {
  assert.equal(
    nextFullResolutionImageFallback(
      "/workflow-assets/project-1/thumbnails/image-preview.jpg",
      "/workflow-assets/project-1/outputs/image.png"
    ),
    "/workflow-assets/project-1/outputs/image.png"
  );
  assert.equal(
    nextFullResolutionImageFallback(
      "http://127.0.0.1:5176/workflow-assets/project-1/outputs/image.png",
      "/workflow-assets/project-1/outputs/image.png"
    ),
    ""
  );
  assert.equal(
    nextFullResolutionImageFallback(
      "/workflow-assets/project-1/thumbnails/image-preview.jpg",
      "/workflow-assets/project-1/outputs/image.png",
      "/workflow-assets/project-1/outputs/image.png"
    ),
    ""
  );
});
