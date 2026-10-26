// Hover-scrub: move the mouse across a paused clip on the canvas and it seeks to that point (left edge = start,
// right edge = end), with a vertical playhead line and a time label following the pointer. Disabled while the clip is
// playing, while a mouse button is held, and over the player's own control bar (so the normal seek bar still works).
// Applies to players with controls inside a node card.

import { canvasPreference } from "./canvasPreferences.js";
export const controlsBarHeight = 44;

// Pure helper: the time to show for a mouse position over a video's on-screen rectangle, or null when scrubbing is off.
export function scrubTime({ rect, x, y, duration, paused, buttons = 0, controlsHeight = controlsBarHeight }) {
  if (!paused || buttons || !(duration > 0) || !Number.isFinite(duration) || !rect.width) return null;
  if (y > rect.bottom - controlsHeight || y < rect.top) return null;
  const fraction = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
  return fraction * duration;
}

export function formatClock(seconds) {
  const total = Math.max(0, seconds || 0);
  const whole = Math.floor(total);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}.${String(Math.floor((total - whole) * 10))}`;
}

// The player under the pointer. Looks through the node card rather than trusting event.target, so an invisible
// overlay on top of the video does not hide it.
export function videoUnderPointer(event) {
  const target = event.target;
  if (!target) return null;
  if (target.tagName === "VIDEO") return target.controls && target.closest?.(".node-card") ? target : null;
  const card = target.closest?.(".node-card");
  if (!card) return null;
  for (const video of card.querySelectorAll("video[controls]")) {
    const r = video.getBoundingClientRect();
    if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) return video;
  }
  return null;
}

function domOverlay() {
  let line = null, label = null;
  const build = () => {
    line = document.createElement("div");
    line.setAttribute("aria-hidden", "true");
    line.style.cssText = "position:fixed;width:2px;margin-left:-1px;background:#ffd84a;box-shadow:0 0 6px rgba(255,216,74,.9);pointer-events:none;z-index:2147483000;display:none;";
    label = document.createElement("div");
    label.style.cssText = "position:absolute;top:-20px;left:50%;transform:translateX(-50%);padding:1px 6px;border-radius:8px;background:rgba(20,20,20,.9);color:#ffd84a;font:600 11px/16px system-ui,sans-serif;white-space:nowrap;";
    line.appendChild(label);
    document.body.appendChild(line);
  };
  return {
    show({ rect, x, time, duration, controlsHeight }) {
      if (!line) build();
      const top = rect.top, bottom = rect.bottom - controlsHeight;
      line.style.left = `${Math.min(rect.right, Math.max(rect.left, x))}px`;
      line.style.top = `${top}px`;
      line.style.height = `${Math.max(0, bottom - top)}px`;
      label.textContent = `${formatClock(time)} / ${formatClock(duration)}`;
      line.style.display = "block";
    },
    hide() { if (line) line.style.display = "none"; },
    destroy() { line?.remove(); line = null; label = null; }
  };
}

export function installVideoHoverScrub(target = document, { overlay = domOverlay() } = {}) {
  if (target.__newtHoverScrub) return target.__newtHoverScrub;
  const flush = video => {
    video.__scrubWaiting = false;
    const time = video.__scrubPending;
    video.__scrubPending = null;
    if (time != null && !video.seeking && video.paused) video.currentTime = time;
  };
  function onMove(event) {
    if (canvasPreference("hoverScrub", "on") === "off") { overlay.hide(); return; }
    if (event.pointerType && event.pointerType !== "mouse") { overlay.hide(); return; }
    const video = videoUnderPointer(event);
    if (!video || video.readyState < 1) { overlay.hide(); return; }
    const rect = video.getBoundingClientRect();
    const time = scrubTime({ rect, x: event.clientX, y: event.clientY, duration: video.duration, paused: video.paused, buttons: event.buttons });
    if (time === null) { overlay.hide(); return; }
    overlay.show({ rect, x: event.clientX, time, duration: video.duration, controlsHeight: controlsBarHeight });
    if (Math.abs(time - video.currentTime) < 0.02) return;
    if (video.seeking) {
      // Keep only the newest wish; apply it when the current seek lands.
      video.__scrubPending = time;
      if (!video.__scrubWaiting) { video.__scrubWaiting = true; video.addEventListener("seeked", () => flush(video), { once: true }); }
    } else video.currentTime = time;
  }
  const hide = () => overlay.hide();
  // Capture phase: runs before any handler that might stop the event from reaching the document.
  target.addEventListener("pointermove", onMove, { capture: true, passive: true });
  target.addEventListener("pointerdown", hide, { capture: true, passive: true });
  target.addEventListener("pointerleave", hide);
  target.addEventListener("play", hide, true);
  target.addEventListener("scroll", hide, true);
  const stop = () => {
    target.removeEventListener("pointermove", onMove, { capture: true });
    target.removeEventListener("pointerdown", hide, { capture: true });
    target.removeEventListener("pointerleave", hide);
    target.removeEventListener("play", hide, true);
    target.removeEventListener("scroll", hide, true);
    overlay.hide();
    overlay.destroy?.();
    delete target.__newtHoverScrub;
  };
  target.__newtHoverScrub = stop;
  return stop;
}
