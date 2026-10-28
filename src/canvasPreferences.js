export function canvasPreference(key, fallback) {
  try { return window.localStorage.getItem(`newt.${key}`) ?? fallback; } catch { return fallback; }
}
export function saveCanvasPreference(key, value) {
  try { window.localStorage.setItem(`newt.${key}`, value); } catch { /* session-only */ }
  window.dispatchEvent(new CustomEvent("newt-canvas-preference", { detail: { key } }));
}
