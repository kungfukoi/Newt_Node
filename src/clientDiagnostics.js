const diagnosticEndpoint = "/api/system/client-diagnostic";
const longTaskThresholdMs = 1200;
const memoryPressureRatio = 0.82;
let diagnosticsInstalled = false;
let lastLongTaskReportAt = 0;
let lastMemoryReportAt = 0;

export function reportClientDiagnostic(event, details = {}) {
  const payload = {
    event,
    createdAt: new Date().toISOString(),
    message: String(details.message || "").slice(0, 1600),
    stack: String(details.stack || "").slice(0, 3000),
    durationMs: finiteDiagnosticNumber(details.durationMs),
    usedHeapBytes: finiteDiagnosticNumber(details.usedHeapBytes),
    heapLimitBytes: finiteDiagnosticNumber(details.heapLimitBytes),
    path: `${window.location.pathname}${window.location.search}`,
    userAgent: window.navigator.userAgent
  };
  const body = JSON.stringify(payload);

  try {
    if (window.navigator.sendBeacon) {
      window.navigator.sendBeacon(diagnosticEndpoint, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(diagnosticEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // Diagnostics must never interfere with the app.
  }
}

export function installClientDiagnostics() {
  if (diagnosticsInstalled || typeof window === "undefined") return;
  diagnosticsInstalled = true;
  window.addEventListener("error", (event) => {
    reportClientDiagnostic("window-error", { message: event.message || event.error?.message, stack: event.error?.stack });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportClientDiagnostic("unhandled-rejection", { message: reason?.message || reason, stack: reason?.stack });
  });
  if ("PerformanceObserver" in window) {
    try {
      const observer = new window.PerformanceObserver((list) => {
        const longest = Math.max(0, ...list.getEntries().map((entry) => Number(entry.duration) || 0));
        const now = Date.now();
        if (longest < longTaskThresholdMs || now - lastLongTaskReportAt < 30000) return;
        lastLongTaskReportAt = now;
        reportClientDiagnostic("long-task", { durationMs: Math.round(longest) });
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      // Long-task observation is not available in every browser.
    }
  }
  window.setInterval(reportMemoryPressure, 20000);
}

function reportMemoryPressure() {
  const memory = window.performance?.memory;
  if (!memory?.jsHeapSizeLimit || !memory.usedJSHeapSize) return;
  const ratio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
  const now = Date.now();
  if (ratio < memoryPressureRatio || now - lastMemoryReportAt < 60000) return;
  lastMemoryReportAt = now;
  reportClientDiagnostic("memory-pressure", { usedHeapBytes: memory.usedJSHeapSize, heapLimitBytes: memory.jsHeapSizeLimit });
}

function finiteDiagnosticNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

let observer;
let timer;
let enabled = false;
let startedAt = null;
let longTasks = 0;
let longTaskMs = 0;
let maxLongTaskMs = 0;
let failedAssets = 0;
const failure = (event) => { if (["IMG", "VIDEO", "AUDIO"].includes(event.target?.tagName)) failedAssets++; };

export function setClientDiagnosticsEnabled(value) {
  if (value && !enabled) {
    startedAt = new Date().toISOString();
    longTasks = 0; longTaskMs = 0; maxLongTaskMs = 0; failedAssets = 0;
    if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes("longtask")) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) { longTasks++; longTaskMs += entry.duration; maxLongTaskMs = Math.max(maxLongTaskMs, entry.duration); }
      });
      observer.observe({ type: "longtask", buffered: false });
    }
    globalThis.document?.addEventListener("error", failure, true);
  } else if (!value) {
    observer?.disconnect(); observer = null;
    globalThis.document?.removeEventListener("error", failure, true);
  }
  enabled = Boolean(value);
  clearTimeout(timer);
  if (enabled) timer = setTimeout(() => setClientDiagnosticsEnabled(false), 10 * 60 * 1000);
}

export function clientDiagnosticsSnapshot() {
  if (!enabled) return { enabled: false };
  const videos = [...(globalThis.document?.querySelectorAll("video") || [])];
  const quality = videos.map((video) => video.getVideoPlaybackQuality?.()).filter(Boolean);
  return {
    enabled, startedAt, longTasksSupported: Boolean(globalThis.PerformanceObserver?.supportedEntryTypes?.includes("longtask")),
    longTasks, longTaskMs: Math.round(longTaskMs), maxLongTaskMs: Math.round(maxLongTaskMs), failedAssets,
    nodeCount: globalThis.document?.querySelectorAll(".react-flow__node").length || 0,
    imageCount: globalThis.document?.querySelectorAll("img").length || 0,
    videoElements: videos.length, playingVideos: videos.filter((video) => !video.paused).length,
    decodedFrames: quality.reduce((sum, entry) => sum + entry.totalVideoFrames, 0),
    droppedFrames: quality.reduce((sum, entry) => sum + entry.droppedVideoFrames, 0)
  };
}
