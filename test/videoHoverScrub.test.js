import test from "node:test";
import assert from "node:assert/strict";
import { scrubTime, installVideoHoverScrub, formatClock, videoUnderPointer } from "../src/videoHoverScrub.js";

const rect = { left: 100, right: 300, top: 50, bottom: 250, width: 200 };

test("mouse position maps to clip time, edges clamp, playing and button-held are off", () => {
  const base = { rect, y: 100, duration: 10, paused: true };
  assert.equal(scrubTime({ ...base, x: 100 }), 0);
  assert.equal(scrubTime({ ...base, x: 200 }), 5);
  assert.equal(scrubTime({ ...base, x: 300 }), 10);
  assert.equal(scrubTime({ ...base, x: 999 }), 10);
  assert.equal(scrubTime({ ...base, x: 200, paused: false }), null);
  assert.equal(scrubTime({ ...base, x: 200, buttons: 1 }), null);
  assert.equal(scrubTime({ ...base, x: 200, y: 240 }), null, "over the control bar");
  assert.equal(scrubTime({ ...base, x: 200, duration: NaN }), null);
});

function fakeVideo(extra = {}) {
  const listeners = {};
  return Object.assign({ tagName: "VIDEO", controls: true, paused: true, seeking: false, readyState: 4, duration: 10, currentTime: 0,
    closest: selector => (selector === ".node-card" ? {} : null), getBoundingClientRect: () => rect,
    addEventListener: (name, fn) => { listeners[name] = fn; }, fire: name => listeners[name]?.() }, extra);
}
function fakeDocument() {
  const handlers = {};
  return { addEventListener: (name, fn) => { handlers[name] = fn; }, removeEventListener: name => { delete handlers[name]; }, move: event => handlers.pointermove?.(event), down: event => handlers.pointerdown?.(event) };
}

test("hover moves a paused clip, ignores a playing clip, and queues one seek while seeking", () => {
  const doc = fakeDocument();
  const shown = []; const overlay = { show: info => shown.push(info), hide: () => shown.push(null) };
  const stop = installVideoHoverScrub(doc, { overlay });
  const video = fakeVideo();
  doc.move({ target: video, clientX: 200, clientY: 100, buttons: 0 });
  assert.equal(video.currentTime, 5);
  assert.equal(shown.at(-1).x, 200); assert.equal(shown.at(-1).time, 5);
  video.paused = false;
  doc.move({ target: video, clientX: 300, clientY: 100, buttons: 0 });
  assert.equal(video.currentTime, 5, "playing: no scrubbing"); assert.equal(shown.at(-1), null, "no playhead while playing");
  video.paused = true; video.seeking = true;
  doc.move({ target: video, clientX: 120, clientY: 100, buttons: 0 });
  doc.move({ target: video, clientX: 160, clientY: 100, buttons: 0 });
  assert.equal(video.currentTime, 5, "waits for the seek in flight");
  video.seeking = false; video.fire("seeked");
  assert.equal(video.currentTime, 3, "newest position wins");
  const noControls = fakeVideo({ controls: false });
  doc.move({ target: noControls, clientX: 300, clientY: 100, buttons: 0 });
  assert.equal(noControls.currentTime, 0);
  const outside = fakeVideo({ closest: () => null });
  doc.move({ target: outside, clientX: 300, clientY: 100, buttons: 0 });
  assert.equal(outside.currentTime, 0);
  stop();
});

test("an invisible overlay on top of the video does not hide it, and the clock text is readable", () => {
  const video = fakeVideo();
  const card = { querySelectorAll: () => [video] };
  const overlayTarget = { tagName: "DIV", closest: selector => (selector === ".node-card" ? card : null) };
  assert.equal(videoUnderPointer({ target: overlayTarget, clientX: 150, clientY: 100 }), video);
  assert.equal(videoUnderPointer({ target: overlayTarget, clientX: 999, clientY: 100 }), null);
  assert.equal(formatClock(75.34), "1:15.3");
});
