const latestFrames = new Map();
const frameListeners = new Map();
const demandListeners = new Map();

export function publishAssemblyLiveFrame(frame = {}) {
  const nodeId = String(frame.nodeId || "");
  const url = String(frame.url || "");
  if (!nodeId || !url) return null;
  const nextFrame = {
    nodeId,
    url,
    decoded: frame.decoded === true,
    frameTime: Math.max(0, Number(frame.frameTime) || 0),
    targetFrameRate: Math.max(1, Number(frame.targetFrameRate) || 24),
    emittedAt: Math.max(0, Number(frame.emittedAt) || Date.now())
  };
  latestFrames.set(nodeId, nextFrame);
  frameListeners.get(nodeId)?.forEach((listener) => listener(nextFrame));
  return nextFrame;
}

export function subscribeAssemblyLiveFrame(nodeId, listener) {
  const key = String(nodeId || "");
  if (!key || typeof listener !== "function") return () => {};
  const listeners = frameListeners.get(key) || new Set();
  listeners.add(listener);
  frameListeners.set(key, listeners);
  if (listeners.size === 1) demandListeners.get(key)?.(true);
  const latest = latestFrames.get(key);
  if (latest) listener(latest);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      frameListeners.delete(key);
      demandListeners.get(key)?.(false);
    }
  };
}

export function observeAssemblyLiveFrameDemand(nodeId, listener) {
  const key = String(nodeId);
  demandListeners.set(key, listener);
  listener(Boolean(frameListeners.get(key)?.size));
  return () => { if (demandListeners.get(key) === listener) demandListeners.delete(key); };
}

export function clearAssemblyLiveFrame(nodeId) {
  latestFrames.delete(String(nodeId || ""));
}
