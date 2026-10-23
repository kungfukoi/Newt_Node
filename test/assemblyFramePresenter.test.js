import test from "node:test";
import assert from "node:assert/strict";
import { createAssemblyFramePresenter } from "../src/assembly/assemblyFramePresenter.js";
import { assemblyPlaybackPreviewLayers } from "../src/assembly/assemblyLivePreview.js";

test("Timeline presents only decoded frames and coalesces slow playback updates", async () => {
  const images = [], shown = [];
  const presenter = createAssemblyFramePresenter({ present: url => shown.push(url), createImage: () => { const image = { decode: async () => {} }; images.push(image); return image; } });
  presenter.offer("first");
  assert.deepEqual(shown, []);
  await images[0].onload();
  presenter.offer("second"); presenter.offer("third"); presenter.offer("latest");
  assert.deepEqual(shown, ["first"], "Hold the displayed frame while the replacement loads");
  assert.equal(images.length, 2);
  await images[1].onload();
  assert.equal(images[2].src, "latest");
  await images[2].onload();
  assert.deepEqual(shown, ["first", "second", "latest"]);
  presenter.offer("bad"); images[3].onerror();
  assert.deepEqual(shown, ["first", "second", "latest"], "A failed decode must not blank the preview");
  presenter.offer("late"); const late = images[4].onload;
  presenter.dispose(); await late();
  assert.deepEqual(shown, ["first", "second", "latest"]);
});

test("Timeline playback holds its composition while any visible layer seeks", () => {
  const ready = { element: {}, width: 640, height: 360, ready: true };
  assert.equal(assemblyPlaybackPreviewLayers([ready, { ...ready, ready: false }]), null);
  assert.deepEqual(assemblyPlaybackPreviewLayers([ready, ready]), [ready, ready]);
  assert.deepEqual(assemblyPlaybackPreviewLayers([]), [], "Real empty gaps still clear the viewer");
});
