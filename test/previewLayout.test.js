import test from "node:test";
import assert from "node:assert/strict";
import {
  mergePreviewMediaIntoLayout,
  movePreviewLayoutItem,
  normalizedPreviewLayoutItems,
  previewLayoutSourceItems,
  previewLayoutVideoPosterUrl
} from "../src/previewLayout.js";

test("Preview Layout preserves legacy images and normalizes video tiles", () => {
  const items = normalizedPreviewLayoutItems([
    { id: "legacy", url: "/outputs/frame.png", width: 800, height: 600 },
    { id: "clip", url: "/outputs/clip.mp4", type: "video", width: 1920, height: 1080 }
  ]);

  assert.deepEqual(items.map((item) => item.type), ["image", "video"]);
  assert.equal(items[0].mimeType, "image/png");
  assert.equal(items[1].mimeType, "video/mp4");
});

test("Preview Layout gathers image and video results without duplicate sources", () => {
  const items = previewLayoutSourceItems({
    items: [
      { url: "/outputs/frame.png", type: "image" },
      { url: "/outputs/clip.mp4", type: "video" },
      { url: "/outputs/clip.mp4", type: "video" },
      { url: "/outputs/sound.wav", type: "audio" }
    ]
  });

  assert.deepEqual(items.map((item) => item.type), ["image", "video"]);
  assert.deepEqual(items.map((item) => item.url), ["/outputs/frame.png", "/outputs/clip.mp4"]);
});

test("Preview Layout merges and reorders mixed media while honoring hidden items", () => {
  const initial = normalizedPreviewLayoutItems([
    { id: "image", url: "/outputs/frame.png", type: "image" }
  ]);
  const merged = mergePreviewMediaIntoLayout(initial, [
    { id: "video-source", url: "/outputs/clip.mp4", type: "video" },
    { id: "hidden-source", url: "/outputs/hidden.mp4", type: "video" }
  ], ["/outputs/hidden.mp4"]);

  assert.equal(merged.length, 2);
  assert.equal(merged[1].type, "video");
  const moved = movePreviewLayoutItem(merged, merged[1].id, "image");
  assert.deepEqual(moved.map((item) => item.type), ["video", "image"]);
});

test("Preview Layout video tiles use an explicit poster or the cached poster route", () => {
  assert.equal(previewLayoutVideoPosterUrl({ url: "/outputs/clip.mp4", thumbnailUrl: "/outputs/poster.jpg" }), "/outputs/poster.jpg");
  assert.equal(previewLayoutVideoPosterUrl({ url: "/outputs/clip.mp4" }), "/api/video-poster?url=%2Foutputs%2Fclip.mp4");
});
