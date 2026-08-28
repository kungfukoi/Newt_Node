import { minimumAssemblyZoom, normalizeAssemblyZoom } from "./assemblyZoom.js";

const assemblySchemaVersion = 1;
const defaultStillDuration = 5;
const defaultFrameRate = 24;
const minimumClipDuration = 1 / 120;
const visualTrackTypes = new Set(["video"]);
const knownTrackTypes = new Set(["video", "audio", "subtitle", "annotation"]);
const knownMediaTypes = new Set(["image", "video", "audio"]);

export function createAssemblyState(overrides = {}) {
  return normalizeAssemblyState({
    version: assemblySchemaVersion,
    frameRate: defaultFrameRate,
    outputWidth: 1920,
    outputHeight: 1080,
    zoom: 72,
    ripple: false,
    tool: "select",
    playhead: 0,
    inPoint: null,
    outPoint: null,
    loopInOut: false,
    selectedClipId: "",
    tracks: [
      createAssemblyTrack("video", 1),
      createAssemblyTrack("video", 2),
      createAssemblyTrack("audio", 1),
      createAssemblyTrack("audio", 2)
    ],
    media: [],
    ...overrides
  });
}

export function normalizeAssemblyState(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const tracks = uniqueById((Array.isArray(source.tracks) ? source.tracks : []).map(normalizeAssemblyTrack));
  const media = uniqueById((Array.isArray(source.media) ? source.media : []).map(normalizeAssemblyMedia));
  const normalizedTracks = [...(tracks.length ? tracks : createAssemblyState().tracks)]
    .sort((first, second) => assemblyTrackSortRank(first.type) - assemblyTrackSortRank(second.type));
  const trackIds = new Set(normalizedTracks.map((track) => track.id));
  const mediaIds = new Set(media.map((item) => item.id));
  const requestedInPoint = normalizeAssemblyMarker(source.inPoint);
  const outPoint = normalizeAssemblyMarker(source.outPoint);
  const inPoint = outPoint !== null && (requestedInPoint === null || requestedInPoint > outPoint) ? 0 : requestedInPoint;

  return {
    version: assemblySchemaVersion,
    frameRate: clampNumber(source.frameRate, 1, 120, defaultFrameRate),
    outputWidth: evenDimension(source.outputWidth, 1920),
    outputHeight: evenDimension(source.outputHeight, 1080),
    zoom: normalizeAssemblyZoom(source.zoom),
    ripple: Boolean(source.ripple),
    tool: ["select", "blade", "slip"].includes(source.tool) ? source.tool : "select",
    playhead: Math.max(0, finiteNumber(source.playhead)),
    inPoint,
    outPoint,
    loopInOut: Boolean(source.loopInOut && inPoint !== null && outPoint !== null && outPoint > inPoint),
    selectedClipId: String(source.selectedClipId || ""),
    tracks: normalizedTracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => trackIds.has(track.id) && mediaIds.has(clip.mediaId))
    })),
    media
  };
}

export function createAssemblyTrack(type, index = 1) {
  const safeType = knownTrackTypes.has(type) ? type : "video";
  const prefix = safeType === "audio" ? "A" : safeType === "video" ? "V" : safeType.slice(0, 1).toUpperCase();
  return {
    id: createAssemblyId(`track-${safeType}`),
    type: safeType,
    name: `${prefix}${Math.max(1, Math.round(Number(index) || 1))}`,
    muted: false,
    hidden: false,
    locked: false,
    clips: []
  };
}

export function assemblyDuration(state) {
  const normalized = normalizeAssemblyState(state);
  return Math.max(10, assemblyContentDuration(normalized), normalized.inPoint || 0, normalized.outPoint || 0);
}

export function assemblyContentDuration(state) {
  const normalized = normalizeAssemblyState(state);
  return Math.max(1 / normalized.frameRate, normalized.tracks
    .flatMap((track) => track.clips)
    .reduce((maximum, clip) => Math.max(maximum, clip.start + clip.duration), 0));
}

export function assemblyFrameDuration(state) {
  return 1 / normalizeAssemblyState(state).frameRate;
}

export function assemblyActiveClips(state, time = state?.playhead || 0, type = "visual") {
  const normalized = normalizeAssemblyState(state);
  const requestedVisual = type === "visual";
  return normalized.tracks
    .filter((track) => requestedVisual
      ? !track.hidden && visualTrackTypes.has(track.type)
      : !track.muted && ["video", "audio"].includes(track.type))
    .flatMap((track, trackIndex) => track.clips.map((clip) => ({ ...clip, track, trackIndex, media: normalized.media.find((item) => item.id === clip.mediaId) })))
    .filter((item) => item.media && (requestedVisual
      ? ["video", "image"].includes(item.media.type)
      : (item.track.type === "audio" && item.media.type === "audio") || (item.track.type === "video" && item.media.type === "video" && item.media.hasAudio)))
    .filter((item) => time >= item.start && time < item.start + item.duration)
    .sort((first, second) => first.trackIndex - second.trackIndex || first.start - second.start);
}

export function syncAssemblyInputs(state, inputs = []) {
  const current = normalizeAssemblyState(state);
  const next = cloneAssemblyState(current);
  let changed = false;

  normalizeAssemblyInputs(inputs).forEach((input) => {
    const sourceKey = assemblyConnectedSourceKey(input);
    let existingIndex = sourceKey
      ? next.media.findIndex((item) => item.linkedSource && assemblyConnectedSourceKey(item) === sourceKey)
      : -1;
    if (existingIndex < 0) {
      const mediaKey = assemblyMediaKey(input);
      existingIndex = next.media.findIndex((item) => assemblyMediaKey(item) === mediaKey);
    }
    if (existingIndex < 0 && sourceKey) {
      const legacyMatches = next.media
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => assemblyConnectedSourceKey(item) === sourceKey);
      if (legacyMatches.length === 1) existingIndex = legacyMatches[0].index;
    }

    if (existingIndex >= 0) {
      const existing = next.media[existingIndex];
      const media = mergeAssemblyConnectedMedia(existing, input);
      if (JSON.stringify(existing) !== JSON.stringify(media)) {
        next.media[existingIndex] = media;
        changed = true;
      }
      return;
    }

    changed = true;
    next.media.push(normalizeAssemblyMedia({
      ...input,
      id: input.id || createAssemblyId("media"),
      linkedSource: true,
      duration: input.duration || (input.type === "image" ? defaultStillDuration : 1)
    }));
  });

  return changed ? next : current;
}

export function insertAssemblyMediaClip(state, mediaId, targetTrackId, start = state?.playhead || 0) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const media = next.media.find((item) => item.id === mediaId);
  const target = next.tracks.find((track) => track.id === targetTrackId);
  if (!media || !target || target.locked || !assemblyTrackAcceptsMedia(target, media)) return next;
  const clip = normalizeAssemblyClip({
    id: createAssemblyId("clip"),
    mediaId: media.id,
    start: snapAssemblyTime(next, start),
    duration: media.duration,
    sourceIn: 0,
    sourceDuration: media.duration
  });
  target.clips.push(clip);
  next.selectedClipId = clip.id;
  return next;
}

export function createAssemblyClipClipboard(state, clipId = state?.selectedClipId) {
  const current = normalizeAssemblyState(state);
  const found = findAssemblyClip(current, clipId);
  if (!found?.media) return null;
  return {
    version: 1,
    sourceTrackId: found.track.id,
    sourceTrackType: found.track.type,
    clip: {
      mediaId: found.clip.mediaId,
      duration: found.clip.duration,
      sourceIn: found.clip.sourceIn,
      sourceDuration: found.clip.sourceDuration,
      translateX: found.clip.translateX,
      translateY: found.clip.translateY,
      scale: found.clip.scale,
      opacity: found.clip.opacity,
      rotation: found.clip.rotation,
      flipHorizontal: found.clip.flipHorizontal,
      flipVertical: found.clip.flipVertical,
      speed: found.clip.speed,
      reverse: found.clip.reverse
    }
  };
}

export function pasteAssemblyClip(state, clipboard, start = state?.playhead || 0) {
  const current = normalizeAssemblyState(state);
  const mediaId = String(clipboard?.clip?.mediaId || "");
  const media = current.media.find((item) => item.id === mediaId);
  if (!media) return current;
  const preferredTrack = current.tracks.find((track) => track.id === clipboard.sourceTrackId);
  const targetTrack = preferredTrack && !preferredTrack.locked && assemblyTrackAcceptsMedia(preferredTrack, media)
    ? preferredTrack
    : current.tracks.find((track) => !track.locked && assemblyTrackAcceptsMedia(track, media));
  if (!targetTrack) return current;

  const next = cloneAssemblyState(current);
  const target = next.tracks.find((track) => track.id === targetTrack.id);
  const clip = normalizeAssemblyClip({
    ...clipboard.clip,
    id: createAssemblyId("clip"),
    mediaId,
    start: snapAssemblyTime(next, start)
  });
  target.clips.push(clip);
  next.selectedClipId = clip.id;
  return next;
}

export function importAssemblyOutputItem(state, item = {}) {
  const current = normalizeAssemblyState(state);
  if (!item?.url || !knownMediaTypes.has(item.type)) return current;
  const requestedId = String(item.id || createAssemblyId("media"));
  const media = normalizeAssemblyMedia({
    id: current.media.some((existing) => existing.id === requestedId) ? createAssemblyId("media") : requestedId,
    sourceNodeId: String(item.sourceNodeId || ""),
    sourcePort: String(item.sourcePort || item.type + "Out"),
    linkedSource: false,
    url: String(item.url),
    type: item.type,
    label: String(item.label || item.fileName || item.type + " clip"),
    fileName: String(item.fileName || ""),
    mimeType: String(item.mimeType || ""),
    duration: Number(item.duration || 0),
    width: Number(item.width || 0),
    height: Number(item.height || 0),
    fps: Number(item.fps || 0),
    hasAudio: Boolean(item.hasAudio),
    waveformUrl: String(item.waveformUrl || "")
  });
  if (current.media.some((existing) => assemblyMediaKey(existing) === assemblyMediaKey(media))) return current;
  const next = cloneAssemblyState(current);
  next.media.push(media);
  return next;
}

export function updateAssemblyMedia(state, mediaId, patch = {}) {
  const current = normalizeAssemblyState(state);
  let changed = false;
  const media = current.media.map((item) => {
    if (item.id !== mediaId) return item;
    const next = normalizeAssemblyMedia({ ...item, ...patch, id: item.id });
    changed = JSON.stringify(item) !== JSON.stringify(next);
    return next;
  });
  if (!changed) return current;

  const next = cloneAssemblyState({ ...current, media });
  const updated = media.find((item) => item.id === mediaId);
  next.tracks.forEach((track) => {
    track.clips = track.clips.map((clip) => clip.mediaId === mediaId && clip.sourceDuration <= 1
      ? normalizeAssemblyClip({ ...clip, duration: updated.duration, sourceDuration: updated.duration })
      : clip);
  });
  return next;
}

export function removeAssemblyMedia(state, mediaId) {
  const current = normalizeAssemblyState(state);
  if (!current.media.some((item) => item.id === mediaId)) return current;

  const next = cloneAssemblyState(current);
  next.media = next.media.filter((item) => item.id !== mediaId);
  next.tracks.forEach((track) => {
    track.clips = track.clips.filter((clip) => clip.mediaId !== mediaId);
  });
  if (!next.tracks.some((track) => track.clips.some((clip) => clip.id === next.selectedClipId))) {
    next.selectedClipId = "";
  }
  return next;
}

export function addAssemblyTrack(state, type) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const count = next.tracks.filter((track) => track.type === type).length + 1;
  const track = createAssemblyTrack(type, count);
  const insertionIndex = next.tracks.findIndex((item) => assemblyTrackSortRank(item.type) > assemblyTrackSortRank(track.type));
  if (insertionIndex < 0) next.tracks.push(track);
  else next.tracks.splice(insertionIndex, 0, track);
  return next;
}

export function updateAssemblyTrack(state, trackId, patch = {}) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const track = next.tracks.find((item) => item.id === trackId);
  if (!track) return next;
  if (Object.prototype.hasOwnProperty.call(patch, "name")) track.name = String(patch.name || track.name).slice(0, 40);
  if (Object.prototype.hasOwnProperty.call(patch, "muted")) track.muted = Boolean(patch.muted);
  if (Object.prototype.hasOwnProperty.call(patch, "hidden")) track.hidden = Boolean(patch.hidden);
  if (Object.prototype.hasOwnProperty.call(patch, "locked")) track.locked = Boolean(patch.locked);
  return next;
}

export function updateAssemblyClip(state, clipId, patch = {}) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked) return next;
  const updated = normalizeAssemblyClip({ ...found.clip, ...patch, id: found.clip.id, mediaId: found.clip.mediaId });
  const index = found.track.clips.findIndex((clip) => clip.id === clipId);
  found.track.clips[index] = updated;
  return next;
}

export function retimeAssemblyClip(state, clipId, speed, ripple = state?.ripple) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked || found.media.type === "image") return next;
  const originalDuration = found.clip.duration;
  const sourceSpan = assemblyClipSourceSpan(found.clip);
  const nextSpeed = clampNumber(speed, 1, 1000, found.clip.speed);
  const frame = assemblyFrameDuration(next);
  const requestedDuration = sourceSpan / (nextSpeed / 100);
  const nextDuration = Math.max(frame, Math.round(requestedDuration / frame) * frame);
  found.clip.speed = nextSpeed;
  found.clip.duration = nextDuration;
  if (ripple) shiftFollowingClips(found.track, found.clip.start + originalDuration, nextDuration - originalDuration, clipId);
  return next;
}

export function moveAssemblyClip(state, clipId, targetTrackId, start) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const source = findAssemblyClip(next, clipId);
  const target = next.tracks.find((track) => track.id === targetTrackId);
  if (!source || !target || target.locked || !assemblyTrackAcceptsMedia(target, source.media)) return next;
  source.track.clips = source.track.clips.filter((clip) => clip.id !== clipId);
  target.clips.push({ ...source.clip, start: snapAssemblyTime(next, start) });
  next.selectedClipId = clipId;
  return next;
}

export function snapAssemblyClipMoveStart(state, clipId, targetTrackId, start, pixelsPerSecond = 72, thresholdPixels = 12) {
  const current = normalizeAssemblyState(state);
  const source = findAssemblyClip(current, clipId);
  const target = current.tracks.find((track) => track.id === targetTrackId);
  const requestedStart = snapAssemblyTime(current, start);
  if (!source || !target || target.locked || !assemblyTrackAcceptsMedia(target, source.media)) return requestedStart;

  const threshold = Math.max(assemblyFrameDuration(current), Math.abs(Number(thresholdPixels) || 0) / Math.max(minimumAssemblyZoom, Number(pixelsPerSecond) || minimumAssemblyZoom));
  const edges = [0, ...target.clips
    .filter((clip) => clip.id !== clipId)
    .flatMap((clip) => [clip.start, clip.start + clip.duration])];
  const candidates = edges.flatMap((edge) => [edge, edge - source.clip.duration]).filter((value) => value >= 0);
  let snappedStart = requestedStart;
  let closestDistance = threshold + Number.EPSILON;
  candidates.forEach((candidate) => {
    const distance = Math.abs(candidate - requestedStart);
    if (distance >= closestDistance) return;
    snappedStart = candidate;
    closestDistance = distance;
  });
  return snapAssemblyTime(current, snappedStart);
}

export function splitAssemblyClip(state, clipId, time = state?.playhead || 0) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked) return next;
  const splitTime = snapAssemblyTime(next, time);
  const localTime = splitTime - found.clip.start;
  if (localTime <= minimumClipDuration || localTime >= found.clip.duration - minimumClipDuration) return next;
  const sourceDelta = localTime * assemblyClipPlaybackRate(found.clip);
  const first = normalizeAssemblyClip({
    ...found.clip,
    duration: localTime,
    sourceIn: found.clip.reverse ? found.clip.sourceIn + assemblyClipSourceSpan(found.clip) - sourceDelta : found.clip.sourceIn
  });
  const second = normalizeAssemblyClip({
    ...found.clip,
    id: createAssemblyId("clip"),
    start: splitTime,
    duration: found.clip.duration - localTime,
    sourceIn: found.clip.reverse ? found.clip.sourceIn : found.clip.sourceIn + sourceDelta
  });
  const index = found.track.clips.findIndex((clip) => clip.id === clipId);
  found.track.clips.splice(index, 1, first, second);
  next.selectedClipId = second.id;
  return next;
}

export function trimAssemblyClip(state, clipId, edge, time, ripple = state?.ripple) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked) return next;
  const original = { ...found.clip };
  const frame = assemblyFrameDuration(next);
  const playbackRate = assemblyClipPlaybackRate(original);
  const sourceLimit = Math.max(frame * playbackRate, original.sourceDuration || original.duration * playbackRate);

  if (edge === "left") {
    const maximumStart = original.start + original.duration - frame;
    const nextStart = clampNumber(snapAssemblyTime(next, time), 0, maximumStart, original.start);
    const delta = nextStart - original.start;
    if (original.reverse) {
      const maximumExtension = Math.max(0, (sourceLimit - (original.sourceIn + assemblyClipSourceSpan(original))) / playbackRate);
      const appliedDelta = clampNumber(delta, -maximumExtension, original.duration - frame, 0);
      found.clip.start = original.start + appliedDelta;
      found.clip.duration = original.duration - appliedDelta;
    } else {
      const nextSourceIn = clampNumber(original.sourceIn + delta * playbackRate, 0, sourceLimit - frame * playbackRate, original.sourceIn);
      const appliedDelta = (nextSourceIn - original.sourceIn) / playbackRate;
      found.clip.start = original.start + appliedDelta;
      found.clip.sourceIn = nextSourceIn;
      found.clip.duration = original.duration - appliedDelta;
    }
  } else {
    const requestedDuration = snapAssemblyTime(next, time) - original.start;
    const maximumDuration = original.reverse
      ? Math.max(frame, original.duration + original.sourceIn / playbackRate)
      : Math.max(frame, (sourceLimit - original.sourceIn) / playbackRate);
    const nextDuration = clampNumber(requestedDuration, frame, maximumDuration, original.duration);
    if (original.reverse) found.clip.sourceIn = Math.max(0, original.sourceIn + (original.duration - nextDuration) * playbackRate);
    found.clip.duration = nextDuration;
    if (ripple) shiftFollowingClips(found.track, original.start + original.duration, nextDuration - original.duration, clipId);
  }
  return next;
}

export function slipAssemblyClip(state, clipId, delta) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked || found.media.type === "image") return next;
  const maximum = Math.max(0, found.clip.sourceDuration - assemblyClipSourceSpan(found.clip));
  found.clip.sourceIn = clampNumber(found.clip.sourceIn + Number(delta || 0), 0, maximum, found.clip.sourceIn);
  return next;
}

export function removeAssemblyClip(state, clipId, ripple = state?.ripple) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked) return next;
  found.track.clips = found.track.clips.filter((clip) => clip.id !== clipId);
  if (ripple) shiftFollowingClips(found.track, found.clip.start + found.clip.duration, -found.clip.duration, clipId);
  if (next.selectedClipId === clipId) next.selectedClipId = "";
  return next;
}

export function setAssemblyPlayhead(state, time) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  next.playhead = clampNumber(time, 0, assemblyDuration(next), 0);
  return next;
}

export function setAssemblyInPoint(state, time = state?.playhead || 0) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  next.inPoint = snapAssemblyTime(next, time);
  if (next.outPoint !== null && next.outPoint < next.inPoint) {
    next.outPoint = null;
    next.loopInOut = false;
  }
  return next;
}

export function setAssemblyOutPoint(state, time = state?.playhead || 0) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  next.outPoint = snapAssemblyTime(next, time);
  if (next.inPoint === null || next.inPoint > next.outPoint) {
    next.inPoint = 0;
    next.loopInOut = false;
  }
  return next;
}

export function clearAssemblyInOut(state) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  next.inPoint = null;
  next.outPoint = null;
  next.loopInOut = false;
  return next;
}

export function setAssemblyLoopInOut(state, enabled = true) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const validRange = next.inPoint !== null && next.outPoint !== null && next.outPoint > next.inPoint;
  next.loopInOut = Boolean(enabled && validRange);
  if (next.loopInOut && (next.playhead < next.inPoint || next.playhead >= next.outPoint)) {
    next.playhead = next.inPoint;
  }
  return next;
}

export function setAssemblyView(state, patch = {}) {
  return normalizeAssemblyState({ ...normalizeAssemblyState(state), ...patch });
}

export function createAssemblyHistory(initialState, maximum = 100) {
  let present = normalizeAssemblyState(initialState);
  let undoStack = [];
  let redoStack = [];
  const limit = Math.max(1, Math.round(Number(maximum) || 100));
  return {
    current: () => present,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    commit(nextState) {
      const next = normalizeAssemblyState(nextState);
      if (JSON.stringify(next) === JSON.stringify(present)) return present;
      undoStack = [...undoStack.slice(-(limit - 1)), present];
      present = next;
      redoStack = [];
      return present;
    },
    replace(nextState) {
      present = normalizeAssemblyState(nextState);
      return present;
    },
    undo() {
      if (!undoStack.length) return present;
      redoStack = [present, ...redoStack].slice(0, limit);
      present = undoStack.at(-1);
      undoStack = undoStack.slice(0, -1);
      return present;
    },
    redo() {
      if (!redoStack.length) return present;
      undoStack = [...undoStack.slice(-(limit - 1)), present];
      present = redoStack[0];
      redoStack = redoStack.slice(1);
      return present;
    }
  };
}

export function assemblyRenderPayload(state) {
  const normalized = normalizeAssemblyState(state);
  return {
    version: normalized.version,
    frameRate: normalized.frameRate,
    outputWidth: normalized.outputWidth,
    outputHeight: normalized.outputHeight,
    inPoint: normalized.inPoint,
    outPoint: normalized.outPoint,
    duration: assemblyContentDuration(normalized),
    media: normalized.media.map((item) => ({ ...item })),
    tracks: normalized.tracks.map((track) => ({
      id: track.id,
      type: track.type,
      name: track.name,
      muted: track.muted,
      hidden: track.hidden,
      clips: track.clips.map((clip) => ({ ...clip }))
    }))
  };
}

export function assemblyClipSourceTime(clip, timelineTime) {
  const localTime = Math.max(0, Number(timelineTime || 0) - Number(clip?.start || 0));
  const sourceOffset = localTime * assemblyClipPlaybackRate(clip);
  return Math.max(0, Number(clip?.sourceIn || 0) + (clip?.reverse ? assemblyClipSourceSpan(clip) - sourceOffset : sourceOffset));
}

export function assemblyClipPlaybackRate(clip) {
  return clampNumber(clip?.speed, 1, 1000, 100) / 100;
}

export function assemblyClipSourceSpan(clip) {
  return Math.max(minimumClipDuration, Number(clip?.duration || 0) * assemblyClipPlaybackRate(clip));
}

function normalizeAssemblyTrack(value = {}) {
  const type = knownTrackTypes.has(value.type) ? value.type : "video";
  return {
    id: String(value.id || createAssemblyId(`track-${type}`)),
    type,
    name: String(value.name || type).slice(0, 40),
    muted: Boolean(value.muted),
    hidden: Boolean(value.hidden),
    locked: Boolean(value.locked),
    clips: uniqueById((Array.isArray(value.clips) ? value.clips : []).map(normalizeAssemblyClip))
  };
}

function assemblyTrackSortRank(type) {
  if (type === "video") return 0;
  if (type === "audio") return 2;
  return 1;
}

function normalizeAssemblyMedia(value = {}) {
  const type = knownMediaTypes.has(value.type) ? value.type : "video";
  const duration = Math.max(minimumClipDuration, finiteNumber(value.duration, type === "image" ? defaultStillDuration : 1));
  return {
    id: String(value.id || createAssemblyId("media")),
    sourceNodeId: String(value.sourceNodeId || ""),
    sourcePort: String(value.sourcePort || ""),
    linkedSource: Boolean(value.linkedSource),
    url: String(value.url || ""),
    type,
    label: String(value.label || value.fileName || `${type} clip`),
    fileName: String(value.fileName || ""),
    mimeType: String(value.mimeType || ""),
    duration,
    width: Math.max(0, Math.round(finiteNumber(value.width))),
    height: Math.max(0, Math.round(finiteNumber(value.height))),
    fps: Math.max(0, finiteNumber(value.fps)),
    hasAudio: Boolean(value.hasAudio || type === "audio"),
    waveformUrl: String(value.waveformUrl || "")
  };
}

function normalizeAssemblyClip(value = {}) {
  const duration = Math.max(minimumClipDuration, finiteNumber(value.duration, 1));
  return {
    id: String(value.id || createAssemblyId("clip")),
    mediaId: String(value.mediaId || ""),
    start: Math.max(0, finiteNumber(value.start)),
    duration,
    sourceIn: Math.max(0, finiteNumber(value.sourceIn)),
    sourceDuration: Math.max(minimumClipDuration, finiteNumber(value.sourceDuration, duration)),
    translateX: clampNumber(value.translateX, -100000, 100000, 0),
    translateY: clampNumber(value.translateY, -100000, 100000, 0),
    scale: clampNumber(value.scale, 1, 1000, 100),
    opacity: clampNumber(value.opacity, 0, 100, 100),
    rotation: clampNumber(value.rotation, -3600, 3600, 0),
    flipHorizontal: Boolean(value.flipHorizontal),
    flipVertical: Boolean(value.flipVertical),
    speed: clampNumber(value.speed, 1, 1000, 100),
    reverse: Boolean(value.reverse)
  };
}

function normalizeAssemblyInputs(inputs) {
  return uniqueById((Array.isArray(inputs) ? inputs : []).filter((item) => item?.url && knownMediaTypes.has(item.type)).map((item, index) => ({
    ...item,
    id: String(item.id || `input-${stableHash(`${item.sourceNodeId || ""}:${item.sourcePort || ""}:${item.url}:${index}`)}`)
  })));
}

function assemblyConnectedSourceKey(item) {
  const sourceNodeId = String(item.sourceNodeId || "");
  const sourcePort = String(item.sourcePort || "");
  if (!sourceNodeId || !sourcePort) return "";
  return [sourceNodeId, sourcePort, item.type || ""].join(":");
}

function mergeAssemblyConnectedMedia(existing, input) {
  const urlChanged = String(existing.url || "") !== String(input.url || "");
  return normalizeAssemblyMedia({
    ...existing,
    ...input,
    id: existing.id,
    linkedSource: true,
    duration: Number(input.duration) > 0 ? input.duration : existing.duration,
    width: Number(input.width) > 0 ? input.width : existing.width,
    height: Number(input.height) > 0 ? input.height : existing.height,
    fps: Number(input.fps) > 0 ? input.fps : existing.fps,
    waveformUrl: input.waveformUrl || (urlChanged ? "" : existing.waveformUrl)
  });
}

function assemblyMediaKey(item) {
  return [String(item.url || ""), item.type || ""].join(":");
}

function assemblyTrackAcceptsMedia(track, media) {
  return track.type === "audio" ? media.type === "audio" : track.type === "video" && ["image", "video"].includes(media.type);
}

function findAssemblyClip(state, clipId) {
  for (const track of state.tracks) {
    const clip = track.clips.find((item) => item.id === clipId);
    if (clip) return { track, clip, media: state.media.find((item) => item.id === clip.mediaId) };
  }
  return null;
}

function shiftFollowingClips(track, boundary, delta, excludedId) {
  if (!delta) return;
  track.clips.forEach((clip) => {
    if (clip.id !== excludedId && clip.start >= boundary - minimumClipDuration) clip.start = Math.max(0, clip.start + delta);
  });
}

function snapAssemblyTime(state, value) {
  const frame = assemblyFrameDuration(state);
  return Math.max(0, Math.round(finiteNumber(value) / frame) * frame);
}

function cloneAssemblyState(state) {
  return {
    ...state,
    media: state.media.map((item) => ({ ...item })),
    tracks: state.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => ({ ...clip })) }))
  };
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => item.id && !seen.has(item.id) && seen.add(item.id));
}

function createAssemblyId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function evenDimension(value, fallback) {
  const number = Math.max(2, Math.round(finiteNumber(value, fallback)));
  return number % 2 === 0 ? number : number - 1;
}

function normalizeAssemblyMarker(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, minimum, maximum, fallback = minimum) {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)));
}
