export function assemblyPreviewSeekTolerance(frameRate = 24) {
  const fps = Math.max(1, Number(frameRate) || 24);
  return Math.max(0.004, 0.55 / fps);
}

export function assemblyPreviewSeekTarget(element, sourceTime = 0, frameRate = 24, playing = false) {
  const duration = Number(element?.duration);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const maximum = Math.max(0, duration - Math.min(0.01, duration / 2));
  const requested = Math.min(Math.max(0, Number(sourceTime) || 0), maximum);
  const current = Number(element?.currentTime);
  const tolerance = playing ? 0.16 : assemblyPreviewSeekTolerance(frameRate);
  const needsDecodedFrame = Number(element?.readyState) < 2;
  if (!needsDecodedFrame && Number.isFinite(current) && Math.abs(current - requested) <= tolerance) return null;
  if (needsDecodedFrame && requested === 0 && maximum > 0) return Math.min(0.001, maximum);
  return requested;
}

export function requestAssemblyVideoFrame(element, callback) {
  if (!element || typeof callback !== "function") return () => {};
  if (typeof element.requestVideoFrameCallback === "function") {
    const callbackId = element.requestVideoFrameCallback(() => callback());
    return () => element.cancelVideoFrameCallback?.(callbackId);
  }

  let active = true;
  const invoke = () => {
    if (active) callback();
  };
  if (typeof globalThis.requestAnimationFrame === "function") {
    const callbackId = globalThis.requestAnimationFrame(invoke);
    return () => {
      active = false;
      globalThis.cancelAnimationFrame?.(callbackId);
    };
  }
  const callbackId = globalThis.setTimeout?.(invoke, 0);
  return () => {
    active = false;
    globalThis.clearTimeout?.(callbackId);
  };
}

export function assemblyMediaTechnicalReadout(media = {}) {
  if (media.type === "audio") return "Audio only";
  const width = Math.max(0, Math.round(Number(media.width) || 0));
  const height = Math.max(0, Math.round(Number(media.height) || 0));
  const resolution = width && height ? `${width} x ${height}` : "pending";
  if (media.type === "image") return `Resolution ${resolution} | Still image`;
  const fpsValue = Math.max(0, Number(media.fps) || 0);
  const frameRate = fpsValue
    ? `${Math.abs(fpsValue - Math.round(fpsValue)) < 0.01 ? Math.round(fpsValue) : Number(fpsValue.toFixed(2))} fps`
    : "pending";
  return `Resolution ${resolution} | Frame rate ${frameRate}`;
}

export function assemblyPreviewMediaInstances(state = {}) {
  const mediaById = new Map((Array.isArray(state.media) ? state.media : []).map((media) => [media.id, media]));
  return (Array.isArray(state.tracks) ? state.tracks : []).flatMap((track) =>
    (Array.isArray(track.clips) ? track.clips : []).map((clip) => ({
      key: String(clip.id || ""),
      clip,
      media: mediaById.get(clip.mediaId)
    }))
  ).filter((item) => item.key && item.media);
}

export function assemblyPreviewTargetFrameRate(frameRate = 24) {
  return Math.min(30, Math.max(1, Number(frameRate) || 24));
}

export function assemblyPreviewFrameIntervalMs(frameRate = 24) {
  return 1000 / assemblyPreviewTargetFrameRate(frameRate);
}

export function nextAssemblyPreviewEmission(previousScheduledAt, now, frameRate = 24, force = false) {
  const currentTime = Math.max(0, Number(now) || 0);
  const previousTime = Number(previousScheduledAt);
  if (force || previousScheduledAt === null || previousScheduledAt === undefined || !Number.isFinite(previousTime) || currentTime < previousTime) {
    return { emit: true, scheduledAt: currentTime };
  }
  const interval = assemblyPreviewFrameIntervalMs(frameRate);
  const elapsed = currentTime - previousTime;
  if (elapsed + 0.001 < interval) return { emit: false, scheduledAt: previousTime };
  const elapsedIntervals = Math.max(1, Math.floor(elapsed / interval));
  return { emit: true, scheduledAt: previousTime + elapsedIntervals * interval };
}

export function assemblyPreviewElementState(media, element, sourceTime = 0, frameRate = 24, playing = false) {
  if (!media || !element) return { ready: false, decoded: false, width: 0, height: 0 };

  if (media.type === "image") {
    const width = Number(element.naturalWidth) || 0;
    const height = Number(element.naturalHeight) || 0;
    return {
      ready: Boolean(element.complete && width && height),
      decoded: Boolean(element.complete && width && height),
      width,
      height
    };
  }

  if (media.type !== "video") return { ready: false, decoded: false, width: 0, height: 0 };
  const width = Number(element.videoWidth) || Number(media.width) || 0;
  const height = Number(element.videoHeight) || Number(media.height) || 0;
  const currentTime = Number(element.currentTime);
  const expectedTime = Math.max(0, Number(sourceTime) || 0);
  const tolerance = playing ? 0.2 : assemblyPreviewSeekTolerance(frameRate);
  const atRequestedFrame = Number.isFinite(currentTime) && Math.abs(currentTime - expectedTime) <= tolerance;
  return {
    ready: Boolean(element.readyState >= 2 && width && height && atRequestedFrame),
    decoded: Boolean(element.readyState >= 2 && width && height),
    width,
    height
  };
}

export function assemblyRenderablePreviewLayers(layers = []) {
  return layers.filter((layer) => (
    layer?.ready &&
    layer.element &&
    Number(layer.width) > 0 &&
    Number(layer.height) > 0
  ));
}

export function assemblyScrubPreviewLayers(layers = []) {
  const topLayer = layers.at(-1);
  if (!topLayer?.decoded || !topLayer.element || Number(topLayer.width) <= 0 || Number(topLayer.height) <= 0) return [];
  return [topLayer];
}

export function assemblyPreviewLayerGeometry(clip, frameWidth, frameHeight, mediaWidth, mediaHeight, outputWidth = frameWidth, outputHeight = frameHeight) {
  const containScale = Math.min(frameWidth / mediaWidth, frameHeight / mediaHeight);
  const clipScale = Math.max(0.01, Number(clip?.scale || 100) / 100);
  return {
    width: mediaWidth * containScale * clipScale,
    height: mediaHeight * containScale * clipScale,
    centerX: frameWidth / 2 + (Number(clip?.translateX) || 0) * frameWidth / Math.max(1, outputWidth),
    centerY: frameHeight / 2 + (Number(clip?.translateY) || 0) * frameHeight / Math.max(1, outputHeight),
    rotation: (Number(clip?.rotation) || 0) * Math.PI / 180,
    opacity: Math.min(1, Math.max(0, Number(clip?.opacity ?? 100) / 100)),
    flipX: clip?.flipHorizontal ? -1 : 1,
    flipY: clip?.flipVertical ? -1 : 1
  };
}
