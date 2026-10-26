// Eased, inertial viewport motion for the node canvas, tuned to match the photo viewer's feel
// (PAN_EASE 0.25, ZOOM_EASE 0.22, MOMENTUM_FRICTION 0.90 per 16 ms frame, 1.15x per wheel notch).
// The viewport is { x, y, scale } in screen pixels, as used by NodeEditor.

import { canvasPreference } from "./canvasPreferences.js";
export const wheelZoomStep = 1.15;
export const motionTuning = { panEase: 0.25, zoomEase: 0.22, friction: 0.9, minSpeed: 0.4, frameMs: 16, velocityWindowMs: 100 };
export function isMouseWheelNotch(event) {
  return event.deltaMode === 1 || (event.deltaMode === 0 && !event.deltaX && Math.abs(event.deltaY) >= 40);
}

export function createViewportMotion({
  get, apply, minScale = 0.0001, maxScale = 10,
  raf = cb => requestAnimationFrame(cb), caf = id => cancelAnimationFrame(id), now = () => performance.now(),
  ...tuning
}) {
  const t = { ...motionTuning, ...tuning };
  const animate = () => canvasPreference("canvasMotion", "on") !== "off" && !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let target = null, shown = null, handle = null, lastTime = 0, anchor = null;
  let velocity = { x: 0, y: 0 }, dragging = false, samples = [];

  const clampScale = scale => Math.min(maxScale, Math.max(minScale, scale));
  const sync = () => { target = { ...get() }; shown = { ...target }; };
  const ensure = () => { if (handle === null) { lastTime = 0; handle = raf(tick); } };

  function tick(time) {
    handle = null;
    const dt = lastTime ? Math.min(64, Math.max(1, time - lastTime)) : t.frameMs;
    lastTime = time;
    const k = dt / t.frameMs;
    const current = get();
    // Something else (fit view, reset zoom, a loaded project) moved the viewport: follow it, never fight it.
    if (shown && (current.x !== shown.x || current.y !== shown.y || current.scale !== shown.scale)) {
      target = { ...current }; velocity = { x: 0, y: 0 }; anchor = null;
    }
    if (!dragging && Math.abs(velocity.x) + Math.abs(velocity.y) > t.minSpeed) {
      target.x += velocity.x * k; target.y += velocity.y * k;
      const decay = Math.pow(t.friction, k);
      velocity = { x: velocity.x * decay, y: velocity.y * decay };
    } else if (!dragging) velocity = { x: 0, y: 0 };
    const panStep = animate() ? 1 - Math.pow(1 - t.panEase, k) : 1, zoomStep = animate() ? 1 - Math.pow(1 - t.zoomEase, k) : 1;
    const next = { ...current };
    next.scale = Math.abs(target.scale - current.scale) > 0.0005 * target.scale ? current.scale + (target.scale - current.scale) * zoomStep : target.scale;
    for (const axis of ["x", "y"]) next[axis] = Math.abs(target[axis] - current[axis]) > 0.05 ? current[axis] + (target[axis] - current[axis]) * panStep : target[axis];
    if (anchor) { next.x = anchor.x - anchor.sceneX * next.scale; next.y = anchor.y - anchor.sceneY * next.scale; }
    const changed = next.x !== current.x || next.y !== current.y || next.scale !== current.scale;
    if (changed) { apply(next); shown = { ...get() }; } else shown = { ...current };
    const pending = next.x !== target.x || next.y !== target.y || next.scale !== target.scale; // one more frame snaps the last sliver
    if (pending || dragging && changed || Math.abs(velocity.x) + Math.abs(velocity.y) > t.minSpeed) ensure();
  }

  return {
    // Wheel / button zoom, anchored under `pointer` (canvas-relative px) so what you point at stays put.
    zoomBy(pointer, factor) {
      if (!target || handle === null) sync();
      const scale = clampScale(target.scale * factor);
      if (scale === target.scale) return;
      const sceneX = (pointer.x - target.x) / target.scale, sceneY = (pointer.y - target.y) / target.scale;
      anchor = { ...pointer, sceneX, sceneY };
      target = { x: pointer.x - sceneX * scale, y: pointer.y - sceneY * scale, scale };
      velocity = { x: 0, y: 0 };
      ensure();
    },
    panBy(dx, dy) {
      anchor = null;
      if (!target || handle === null) sync();
      target.x += dx; target.y += dy; velocity = { x: 0, y: 0 };
      ensure();
    },
    // Pointer drag: grab the canvas (cancels momentum), follow the pointer, and on release carry on with its speed.
    begin() { anchor = null; if (handle !== null) { caf(handle); handle = null; } sync(); velocity = { x: 0, y: 0 }; dragging = true; samples = [{ time: now(), x: target.x, y: target.y }]; },
    dragTo(viewport) {
      if (!target) sync();
      target = { ...viewport };
      samples.push({ time: now(), x: viewport.x, y: viewport.y });
      if (samples.length > 12) samples.shift();
      ensure();
    },
    // Returns true when momentum took over (the caller should then let the motion loop commit the viewport).
    release() {
      dragging = false;
      const time = now();
      const recent = animate() ? samples.filter(sample => time - sample.time <= t.velocityWindowMs) : [];
      samples = [];
      if (recent.length >= 2) {
        const first = recent[0], last = recent.at(-1), span = Math.max(1, last.time - first.time);
        velocity = { x: (last.x - first.x) / span * t.frameMs, y: (last.y - first.y) / span * t.frameMs };
      } else velocity = { x: 0, y: 0 };
      if (Math.abs(velocity.x) + Math.abs(velocity.y) > t.minSpeed) { ensure(); return true; }
      velocity = { x: 0, y: 0 };
      return handle !== null;
    },
    stop() { if (handle !== null) { caf(handle); handle = null; } dragging = false; velocity = { x: 0, y: 0 }; target = null; },
    get active() { return handle !== null; }
  };
}
