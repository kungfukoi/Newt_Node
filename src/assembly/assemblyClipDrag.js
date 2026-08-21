export function startAssemblyClipDrag({
  event,
  clip,
  track,
  state,
  media,
  pixelsPerSecond,
  scrollElement,
  snapStart,
  moveClip,
  onMove,
  onFinish,
  onCancel
}) {
  if (!event || event.button !== 0 || track?.locked || !scrollElement || !media) return null;
  const clipElement = event.currentTarget;
  const pointerId = event.pointerId;
  const originLane = clipElement?.closest?.(".assembly-track-lane");
  if (!originLane) return null;

  event.preventDefault();
  event.stopPropagation();
  const pps = Math.max(1, Number(pixelsPerSecond) || 1);
  const originRect = originLane.getBoundingClientRect();
  const grabOffsetSeconds = (event.clientX - originRect.left) / pps - clip.start;
  const originPointerY = event.clientY;
  const trackSwitchThreshold = Math.max(18, originRect.height * 0.34);
  const previousUserSelect = document.body.style.userSelect;
  const previousCursor = document.body.style.cursor;
  let activeTrackId = track.id;
  let latest = state;
  let pendingPointer = null;
  let animationFrame = 0;
  let finished = false;

  const laneElements = () => Array.from(scrollElement.querySelectorAll(".assembly-track-lane[data-track-id]"));
  const laneForTrack = (trackId) => laneElements().find((lane) => lane.dataset.trackId === trackId) || originLane;
  const hoveredLane = (clientY) => laneElements().find((lane) => {
    const rect = lane.getBoundingClientRect();
    return clientY >= rect.top && clientY <= rect.bottom;
  });
  const acceptsMedia = (trackId) => {
    const candidate = state.tracks.find((item) => item.id === trackId);
    if (!candidate || candidate.locked) return false;
    return candidate.type === "audio"
      ? media.type === "audio"
      : candidate.type === "video" && ["image", "video"].includes(media.type);
  };
  const renderMove = (pointer) => {
    const hovered = hoveredLane(pointer.clientY);
    const hoveredTrackId = hovered?.dataset.trackId || "";
    if (hoveredTrackId && acceptsMedia(hoveredTrackId)) {
      const crossedThreshold = hoveredTrackId === track.id || Math.abs(pointer.clientY - originPointerY) >= trackSwitchThreshold;
      if (crossedThreshold) activeTrackId = hoveredTrackId;
    }
    const laneRect = laneForTrack(activeTrackId).getBoundingClientRect();
    const requestedStart = (pointer.clientX - laneRect.left) / pps - grabOffsetSeconds;
    const nextStart = pointer.altKey
      ? Math.max(0, requestedStart)
      : snapStart(state, clip.id, activeTrackId, requestedStart, pps, 12);
    latest = moveClip(state, clip.id, activeTrackId, nextStart);
    onMove?.(latest, activeTrackId);
  };
  const queueMove = (pointerEvent) => {
    pendingPointer = {
      clientX: pointerEvent.clientX,
      clientY: pointerEvent.clientY,
      altKey: pointerEvent.altKey
    };
    if (animationFrame) return;
    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0;
      if (pendingPointer) renderMove(pendingPointer);
    });
  };
  const cleanup = () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("pointermove", queueMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    try {
      clipElement.releasePointerCapture?.(pointerId);
    } catch {
      // Pointer capture may already have ended outside the clip.
    }
    document.body.style.userSelect = previousUserSelect;
    document.body.style.cursor = previousCursor;
  };
  const finish = (pointerEvent) => {
    if (finished) return;
    finished = true;
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    renderMove({ clientX: pointerEvent.clientX, clientY: pointerEvent.clientY, altKey: pointerEvent.altKey });
    cleanup();
    onFinish?.(latest, activeTrackId);
  };
  const cancel = () => {
    if (finished) return;
    finished = true;
    cleanup();
    onCancel?.(state, track.id);
  };

  document.body.style.userSelect = "none";
  document.body.style.cursor = "grabbing";
  clipElement.setPointerCapture?.(pointerId);
  window.addEventListener("pointermove", queueMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", cancel);
  return () => {
    if (finished) return;
    finished = true;
    cleanup();
  };
}
