import React from "react";
import { canvasPreference } from "./canvasPreferences.js";

export function useCanvasPreference(key, fallback) {
  const subscribe = React.useCallback((notify) => {
    const changed = event => {
      if (event.type === "storage" ? event.key === `newt.${key}` || event.key === null : event.detail?.key === key) notify();
    };
    window.addEventListener("storage", changed);
    window.addEventListener("newt-canvas-preference", changed);
    return () => {
      window.removeEventListener("storage", changed);
      window.removeEventListener("newt-canvas-preference", changed);
    };
  }, [key]);
  const snapshot = React.useCallback(() => canvasPreference(key, fallback), [key, fallback]);
  return React.useSyncExternalStore(subscribe, snapshot, () => fallback);
}
