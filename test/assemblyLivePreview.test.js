import test from "node:test";
import assert from "node:assert/strict";
import { assemblyMediaTechnicalReadout, assemblyPreviewElementState, assemblyPreviewMediaInstances, assemblyPreviewSeekTarget, assemblyPreviewSeekTolerance, nextAssemblyPreviewEmission, requestAssemblyVideoFrame } from "../src/assembly/assemblyLivePreview.js";

test("Timeline live preview waits for an image to decode", () => {
  const loading = assemblyPreviewElementState({ type: "image" }, { complete: false, naturalWidth: 1920, naturalHeight: 1080 });
  const ready = assemblyPreviewElementState({ type: "image" }, { complete: true, naturalWidth: 1920, naturalHeight: 1080 });
  assert.equal(loading.ready, false);
  assert.deepEqual(ready, { ready: true, width: 1920, height: 1080 });
});

test("Timeline metadata preload requests a decoded first frame", () => {
  const metadataOnly = { duration: 5, currentTime: 0, readyState: 1 };
  assert.equal(assemblyPreviewSeekTarget(metadataOnly, 0, 24, false), 0.001);
});

test("Timeline loaded first frame does not seek again", () => {
  const decoded = { duration: 5, currentTime: 0, readyState: 2 };
  assert.equal(assemblyPreviewSeekTarget(decoded, 0, 24, false), null);
});

test("Timeline requests a presentation-ready video frame", () => {
  let requestedCallback = null;
  let canceledCallbackId = null;
  let rendered = false;
  const video = {
    requestVideoFrameCallback(callback) {
      requestedCallback = callback;
      return 17;
    },
    cancelVideoFrameCallback(callbackId) {
      canceledCallbackId = callbackId;
    }
  };

  const cancel = requestAssemblyVideoFrame(video, () => {
    rendered = true;
  });
  assert.equal(rendered, false);
  requestedCallback();
  assert.equal(rendered, true);
  cancel();
  assert.equal(canceledCallbackId, 17);
});

test("Timeline live preview waits for the requested scrubbed video frame", () => {
  const video = { readyState: 4, videoWidth: 1920, videoHeight: 1080, currentTime: 1 };
  assert.equal(assemblyPreviewElementState({ type: "video" }, video, 3, 24, false).ready, false);
  video.currentTime = 3 + assemblyPreviewSeekTolerance(24) / 2;
  assert.equal(assemblyPreviewElementState({ type: "video" }, video, 3, 24, false).ready, true);
});

test("Timeline playback tolerates normal decoder clock drift", () => {
  const video = { readyState: 4, videoWidth: 1280, videoHeight: 720, currentTime: 4.86 };
  assert.equal(assemblyPreviewElementState({ type: "video" }, video, 5, 24, true).ready, true);
  assert.equal(assemblyPreviewElementState({ type: "video" }, video, 5, 24, false).ready, false);
});

test("Timeline live preview gives repeated source clips independent media elements", () => {
  const media = { id: "shared-video", type: "video", url: "/shared.mp4" };
  const instances = assemblyPreviewMediaInstances({
    media: [media],
    tracks: [
      { id: "v1", clips: [{ id: "clip-a", mediaId: media.id }] },
      { id: "v2", clips: [{ id: "clip-b", mediaId: media.id }] }
    ]
  });

  assert.deepEqual(instances.map((item) => item.key), ["clip-a", "clip-b"]);
  assert.equal(instances[0].media, media);
  assert.equal(instances[1].media, media);
});

test("Timeline selected clip readout formats resolution and frame rate", () => {
  assert.equal(
    assemblyMediaTechnicalReadout({ type: "video", width: 864, height: 496, fps: 23.976 }),
    "Resolution 864 x 496 | Frame rate 23.98 fps"
  );
  assert.equal(
    assemblyMediaTechnicalReadout({ type: "image", width: 2048, height: 2048 }),
    "Resolution 2048 x 2048 | Still image"
  );
});

test("Timeline live-preview scheduler sustains a 24 fps cadence on a 60 Hz display", () => {
  let scheduledAt = null;
  const emittedAt = [];
  for (let frame = 0; frame <= 60; frame += 1) {
    const now = frame * (1000 / 60);
    const emission = nextAssemblyPreviewEmission(scheduledAt, now, 24, false);
    scheduledAt = emission.scheduledAt;
    if (emission.emit) emittedAt.push(now);
  }
  const deliveredFps = ((emittedAt.length - 1) * 1000) / (emittedAt.at(-1) - emittedAt[0]);
  assert.ok(deliveredFps >= 23 && deliveredFps <= 25, `expected about 24 fps, received ${deliveredFps}`);
});
