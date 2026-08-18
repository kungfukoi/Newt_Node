import test from "node:test";
import assert from "node:assert/strict";
import { loadCanvasImage } from "../src/canvasMedia.js";

test("loadCanvasImage enables anonymous CORS before assigning an HTTP source", async () => {
  const OriginalImage = globalThis.Image;
  let image;

  class TestImage {
    set src(value) {
      this.assignedSource = value;
      this.crossOriginAtAssignment = this.crossOrigin;
      queueMicrotask(() => this.onload?.());
    }
  }

  try {
    globalThis.Image = TestImage;
    image = await loadCanvasImage("http://127.0.0.1:3336/outputs/project/image.png");
  } finally {
    globalThis.Image = OriginalImage;
  }

  assert.equal(image.crossOriginAtAssignment, "anonymous");
  assert.equal(image.assignedSource, "http://127.0.0.1:3336/outputs/project/image.png");
});
