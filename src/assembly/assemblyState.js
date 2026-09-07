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
      : (item.track.type === "audio" && item.media.type === "audio") || (item.track.type === "video" && item.media.type === "video" && item.media.hasAudio && !item.linkGroupId)))
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
        if (media.type === "video") syncEmbeddedAudioMedia(next, media);
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

  return ensureAssemblyEmbeddedAudioClips(changed ? next : current);
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

export function insertAssemblyMediaWithLinkedAudio(state, mediaId, targetTrackId, start = state?.playhead || 0) {
  const inserted = insertAssemblyMediaClip(state, mediaId, targetTrackId, start);
  if (inserted.selectedClipId === normalizeAssemblyState(state).selectedClipId) return inserted;
  return ensureAssemblyEmbeddedAudioClips(inserted, mediaId);
}

export function ensureAssemblyEmbeddedAudioClips(state, videoMediaId = "") {
  const current = normalizeAssemblyState(state);
  const next = cloneAssemblyState(current);
  const videoMedia = next.media.filter((media) => (
    media.type === "video"
    && media.hasAudio
    && (!videoMediaId || media.id === videoMediaId)
  ));
  let changed = false;

  videoMedia.forEach((media) => {
    const videoEntries = next.tracks.flatMap((track) => track.type === "video"
      ? track.clips.filter((clip) => clip.mediaId === media.id && !clip.linkGroupId).map((clip) => ({ track, clip }))
      : []);
    if (!videoEntries.length) return;
    const audioMedia = ensureEmbeddedAudioMedia(next, media);
    videoEntries.forEach(({ track, clip }) => {
      const audioTrack = pairedAssemblyTrack(next, track, "audio");
      if (!audioTrack) return;
      const linkGroupId = createAssemblyId("clip-link");
      clip.linkGroupId = linkGroupId;
      audioTrack.clips.push(normalizeAssemblyClip({
        ...clip,
        id: createAssemblyId("clip"),
        mediaId: audioMedia.id,
        linkGroupId
      }));
      changed = true;
    });
  });

  return changed ? next : current;
}

export function createAssemblyClipClipboard(state, clipId = state?.selectedClipId) {
  const current = normalizeAssemblyState(state);
  const found = findAssemblyClip(current, clipId);
  if (!found?.media) return null;
  const linkedClips = linkedAssemblyClipEntries(current, clipId).map((item) => ({
    sourceClipId: item.clip.id,
    sourceTrackId: item.track.id,
    sourceTrackType: item.track.type,
    clip: assemblyClipboardClip(item.clip)
  }));
  return {
    version: 1,
    sourceTrackId: found.track.id,
    sourceTrackType: found.track.type,
    selectedSourceClipId: found.clip.id,
    clip: assemblyClipboardClip(found.clip),
    linkedClips: linkedClips.length > 1 ? linkedClips : []
  };
}

export function pasteAssemblyClip(state, clipboard, start = state?.playhead || 0) {
  const current = normalizeAssemblyState(state);
  if (Array.isArray(clipboard?.linkedClips) && clipboard.linkedClips.length > 1) {
    const next = cloneAssemblyState(current);
    const targetStart = snapAssemblyTime(next, start);
    const linkGroupId = createAssemblyId("clip-link");
    let selectedClipId = "";
    for (const entry of clipboard.linkedClips) {
      const media = next.media.find((item) => item.id === entry?.clip?.mediaId);
      if (!media) return current;
      const preferredTrack = next.tracks.find((track) => track.id === entry.sourceTrackId);
      const targetTrack = preferredTrack && !preferredTrack.locked && assemblyTrackAcceptsMedia(preferredTrack, media)
        ? preferredTrack
        : next.tracks.find((track) => !track.locked && assemblyTrackAcceptsMedia(track, media));
      if (!targetTrack) return current;
      const clip = normalizeAssemblyClip({
        ...entry.clip,
        id: createAssemblyId("clip"),
        start: targetStart,
        linkGroupId
      });
      targetTrack.clips.push(clip);
      if (entry.sourceClipId === clipboard.selectedSourceClipId) selectedClipId = clip.id;
    }
    next.selectedClipId = selectedClipId || next.tracks.flatMap((track) => track.clips).at(-1)?.id || "";
    return next;
  }
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
  const updated = media.find((item) => item.id === mediaId);
  if (!updated) return current;
  if (!changed) {
    if (updated.type === "video" && patch.hasAudioKnown && !updated.hasAudio) {
      return removeEmbeddedAudioMedia(cloneAssemblyState(current), updated.id);
    }
    return updated.type === "video" && updated.hasAudio ? ensureAssemblyEmbeddedAudioClips(current, updated.id) : current;
  }

  let next = cloneAssemblyState({ ...current, media });
  if (updated.type === "video") {
    if (patch.hasAudioKnown && !updated.hasAudio) {
      next = removeEmbeddedAudioMedia(next, updated.id);
    } else if (updated.hasAudio) {
      syncEmbeddedAudioMedia(next, updated);
    }
  }
  const derivedAudioIds = new Set(next.media.filter((item) => item.derivedFromMediaId === mediaId).map((item) => item.id));
  next.tracks.forEach((track) => {
    track.clips = track.clips.map((clip) => (clip.mediaId === mediaId || derivedAudioIds.has(clip.mediaId)) && clip.sourceDuration <= 1
      ? normalizeAssemblyClip({ ...clip, duration: updated.duration, sourceDuration: updated.duration })
      : clip);
  });
  return updated.type === "video" && updated.hasAudio ? ensureAssemblyEmbeddedAudioClips(next, updated.id) : next;
}

export function removeAssemblyMedia(state, mediaId) {
  const current = normalizeAssemblyState(state);
  if (!current.media.some((item) => item.id === mediaId)) return current;

  const next = cloneAssemblyState(current);
  const removedMediaIds = new Set([
    mediaId,
    ...next.media.filter((item) => item.derivedFromMediaId === mediaId).map((item) => item.id)
  ]);
  next.media = next.media.filter((item) => !removedMediaIds.has(item.id));
  next.tracks.forEach((track) => {
    track.clips = track.clips.filter((clip) => !removedMediaIds.has(clip.mediaId));
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
  const linkedEntries = linkedAssemblyClipEntries(next, clipId);
  if (linkedEntries.some((entry) => entry.track.locked)) return next;
  const linkedPatch = assemblyLinkedTimingPatch(patch);
  linkedEntries.forEach((entry) => {
    const entryPatch = entry.clip.id === clipId ? patch : linkedPatch;
    const updated = normalizeAssemblyClip({ ...entry.clip, ...entryPatch, id: entry.clip.id, mediaId: entry.clip.mediaId });
    const index = entry.track.clips.findIndex((clip) => clip.id === entry.clip.id);
    entry.track.clips[index] = updated;
  });
  return next;
}

export function retimeAssemblyClip(state, clipId, speed, ripple = state?.ripple) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked || found.media.type === "image") return next;
  const linkedEntries = linkedAssemblyClipEntries(next, clipId);
  if (linkedEntries.some((entry) => entry.track.locked)) return next;
  const nextSpeed = clampNumber(speed, 1, 1000, found.clip.speed);
  const frame = assemblyFrameDuration(next);
  linkedEntries.forEach((entry) => {
    const originalDuration = entry.clip.duration;
    const sourceSpan = assemblyClipSourceSpan(entry.clip);
    const requestedDuration = sourceSpan / (nextSpeed / 100);
    const nextDuration = Math.max(frame, Math.round(requestedDuration / frame) * frame);
    entry.clip.speed = nextSpeed;
    entry.clip.duration = nextDuration;
    if (ripple) shiftFollowingClips(entry.track, entry.clip.start + originalDuration, nextDuration - originalDuration, entry.clip.id);
  });
  return next;
}

export function moveAssemblyClip(state, clipId, targetTrackId, start) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const source = findAssemblyClip(next, clipId);
  const target = next.tracks.find((track) => track.id === targetTrackId);
  if (!source || !target || target.locked || !assemblyTrackAcceptsMedia(target, source.media)) return next;
  const linkedEntries = linkedAssemblyClipEntries(next, clipId);
  if (linkedEntries.some((entry) => entry.track.locked)) return next;
  const nextStart = snapAssemblyTime(next, start);
  const targetTracks = new Map([[source.clip.id, target]]);
  linkedEntries.forEach((entry) => {
    if (entry.clip.id === source.clip.id) return;
    targetTracks.set(entry.clip.id, pairedAssemblyTrack(next, target, entry.track.type));
  });
  if (linkedEntries.some((entry) => !targetTracks.get(entry.clip.id) || targetTracks.get(entry.clip.id).locked)) return next;
  linkedEntries.forEach((entry) => {
    entry.track.clips = entry.track.clips.filter((clip) => clip.id !== entry.clip.id);
  });
  linkedEntries.forEach((entry) => {
    targetTracks.get(entry.clip.id).clips.push({ ...entry.clip, start: nextStart });
  });
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
  const linkedEntries = linkedAssemblyClipEntries(next, clipId);
  if (linkedEntries.some((entry) => entry.track.locked)) return next;
  const splitGroupId = linkedEntries.length > 1 ? createAssemblyId("clip-link") : "";
  let selectedSecondId = "";
  for (const entry of linkedEntries) {
    const localTime = splitTime - entry.clip.start;
    if (localTime <= minimumClipDuration || localTime >= entry.clip.duration - minimumClipDuration) return normalizeAssemblyState(state);
    const sourceDelta = localTime * assemblyClipPlaybackRate(entry.clip);
    const first = normalizeAssemblyClip({
      ...entry.clip,
      duration: localTime,
      sourceIn: entry.clip.reverse ? entry.clip.sourceIn + assemblyClipSourceSpan(entry.clip) - sourceDelta : entry.clip.sourceIn
    });
    const second = normalizeAssemblyClip({
      ...entry.clip,
      id: createAssemblyId("clip"),
      linkGroupId: splitGroupId,
      start: splitTime,
      duration: entry.clip.duration - localTime,
      sourceIn: entry.clip.reverse ? entry.clip.sourceIn : entry.clip.sourceIn + sourceDelta
    });
    const index = entry.track.clips.findIndex((clip) => clip.id === entry.clip.id);
    entry.track.clips.splice(index, 1, first, second);
    if (entry.clip.id === clipId) selectedSecondId = second.id;
  }
  next.selectedClipId = selectedSecondId;
  return next;
}

export function trimAssemblyClip(state, clipId, edge, time, ripple = state?.ripple) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked) return next;
  const linkedEntries = linkedAssemblyClipEntries(next, clipId);
  if (linkedEntries.some((entry) => entry.track.locked)) return next;
  const frame = assemblyFrameDuration(next);
  linkedEntries.forEach((entry) => trimAssemblyClipEntry(next, entry, edge, time, ripple, frame));
  return next;
}

export function slipAssemblyClip(state, clipId, delta) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked || found.media.type === "image") return next;
  const linkedEntries = linkedAssemblyClipEntries(next, clipId);
  if (linkedEntries.some((entry) => entry.track.locked)) return next;
  linkedEntries.forEach((entry) => {
    const maximum = Math.max(0, entry.clip.sourceDuration - assemblyClipSourceSpan(entry.clip));
    entry.clip.sourceIn = clampNumber(entry.clip.sourceIn + Number(delta || 0), 0, maximum, entry.clip.sourceIn);
  });
  return next;
}

export function removeAssemblyClip(state, clipId, ripple = state?.ripple) {
  const next = cloneAssemblyState(normalizeAssemblyState(state));
  const found = findAssemblyClip(next, clipId);
  if (!found || found.track.locked) return next;
  const linkedEntries = linkedAssemblyClipEntries(next, clipId);
  if (linkedEntries.some((entry) => entry.track.locked)) return next;
  linkedEntries.forEach((entry) => {
    entry.track.clips = entry.track.clips.filter((clip) => clip.id !== entry.clip.id);
    if (ripple) shiftFollowingClips(entry.track, entry.clip.start + entry.clip.duration, -entry.clip.duration, entry.clip.id);
  });
  if (linkedEntries.some((entry) => entry.clip.id === next.selectedClipId)) next.selectedClipId = "";
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
    derivedFromMediaId: String(value.derivedFromMediaId || ""),
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
    hasAudioKnown: Boolean(value.hasAudioKnown || type === "audio"),
    waveformUrl: String(value.waveformUrl || "")
  };
}

function normalizeAssemblyClip(value = {}) {
  const duration = Math.max(minimumClipDuration, finiteNumber(value.duration, 1));
  return {
    id: String(value.id || createAssemblyId("clip")),
    mediaId: String(value.mediaId || ""),
    linkGroupId: String(value.linkGroupId || ""),
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
    hasAudio: Boolean(input.hasAudio || existing.hasAudio),
    hasAudioKnown: Boolean(input.hasAudioKnown || existing.hasAudioKnown),
    waveformUrl: input.waveformUrl || (urlChanged ? "" : existing.waveformUrl)
  });
}

function assemblyMediaKey(item) {
  return [String(item.url || ""), item.type || ""].join(":");
}

function assemblyTrackAcceptsMedia(track, media) {
  return track.type === "audio" ? media.type === "audio" : track.type === "video" && ["image", "video"].includes(media.type);
}

function assemblyClipboardClip(clip) {
  return {
    mediaId: clip.mediaId,
    duration: clip.duration,
    sourceIn: clip.sourceIn,
    sourceDuration: clip.sourceDuration,
    translateX: clip.translateX,
    translateY: clip.translateY,
    scale: clip.scale,
    opacity: clip.opacity,
    rotation: clip.rotation,
    flipHorizontal: clip.flipHorizontal,
    flipVertical: clip.flipVertical,
    speed: clip.speed,
    reverse: clip.reverse
  };
}

function assemblyLinkedTimingPatch(patch = {}) {
  const timingKeys = ["start", "duration", "sourceIn", "sourceDuration", "speed", "reverse"];
  return Object.fromEntries(timingKeys.filter((key) => Object.prototype.hasOwnProperty.call(patch, key)).map((key) => [key, patch[key]]));
}

function linkedAssemblyClipEntries(state, clipId) {
  const found = findAssemblyClip(state, clipId);
  if (!found) return [];
  if (!found.clip.linkGroupId) return [found];
  return state.tracks.flatMap((track) => track.clips
    .filter((clip) => clip.linkGroupId === found.clip.linkGroupId)
    .map((clip) => ({ track, clip, media: state.media.find((item) => item.id === clip.mediaId) })))
    .filter((entry) => entry.media);
}

function trimAssemblyClipEntry(state, entry, edge, time, ripple, frame) {
  const original = { ...entry.clip };
  const playbackRate = assemblyClipPlaybackRate(original);
  const sourceLimit = Math.max(frame * playbackRate, original.sourceDuration || original.duration * playbackRate);

  if (edge === "left") {
    const maximumStart = original.start + original.duration - frame;
    const nextStart = clampNumber(snapAssemblyTime(state, time), 0, maximumStart, original.start);
    const delta = nextStart - original.start;
    if (original.reverse) {
      const maximumExtension = Math.max(0, (sourceLimit - (original.sourceIn + assemblyClipSourceSpan(original))) / playbackRate);
      const appliedDelta = clampNumber(delta, -maximumExtension, original.duration - frame, 0);
      entry.clip.start = original.start + appliedDelta;
      entry.clip.duration = original.duration - appliedDelta;
    } else {
      const nextSourceIn = clampNumber(original.sourceIn + delta * playbackRate, 0, sourceLimit - frame * playbackRate, original.sourceIn);
      const appliedDelta = (nextSourceIn - original.sourceIn) / playbackRate;
      entry.clip.start = original.start + appliedDelta;
      entry.clip.sourceIn = nextSourceIn;
      entry.clip.duration = original.duration - appliedDelta;
    }
    return;
  }

  const requestedDuration = snapAssemblyTime(state, time) - original.start;
  const maximumDuration = original.reverse
    ? Math.max(frame, original.duration + original.sourceIn / playbackRate)
    : Math.max(frame, (sourceLimit - original.sourceIn) / playbackRate);
  const nextDuration = clampNumber(requestedDuration, frame, maximumDuration, original.duration);
  if (original.reverse) entry.clip.sourceIn = Math.max(0, original.sourceIn + (original.duration - nextDuration) * playbackRate);
  entry.clip.duration = nextDuration;
  if (ripple) shiftFollowingClips(entry.track, original.start + original.duration, nextDuration - original.duration, entry.clip.id);
}

function ensureEmbeddedAudioMedia(state, videoMedia) {
  let audioMedia = state.media.find((item) => item.derivedFromMediaId === videoMedia.id && item.type === "audio");
  const nextAudioMedia = normalizeAssemblyMedia({
    ...audioMedia,
    id: audioMedia?.id || createAssemblyId("media-audio"),
    sourceNodeId: videoMedia.sourceNodeId,
    sourcePort: videoMedia.sourcePort,
    linkedSource: videoMedia.linkedSource,
    derivedFromMediaId: videoMedia.id,
    url: videoMedia.url,
    type: "audio",
    label: `${videoMedia.label || videoMedia.fileName || "Video"} audio`,
    fileName: videoMedia.fileName,
    mimeType: videoMedia.mimeType,
    duration: videoMedia.duration,
    hasAudio: true,
    hasAudioKnown: true,
    waveformUrl: videoMedia.waveformUrl
  });
  if (audioMedia) {
    const index = state.media.findIndex((item) => item.id === audioMedia.id);
    state.media[index] = nextAudioMedia;
  } else {
    audioMedia = nextAudioMedia;
    state.media.push(audioMedia);
  }
  return nextAudioMedia;
}

function syncEmbeddedAudioMedia(state, videoMedia) {
  if (!state.media.some((item) => item.derivedFromMediaId === videoMedia.id)) return;
  ensureEmbeddedAudioMedia(state, videoMedia);
}

function removeEmbeddedAudioMedia(state, videoMediaId) {
  const derivedIds = new Set(state.media.filter((item) => item.derivedFromMediaId === videoMediaId).map((item) => item.id));
  if (!derivedIds.size) return state;
  const removedLinkGroupIds = new Set(state.tracks.flatMap((track) => track.clips)
    .filter((clip) => derivedIds.has(clip.mediaId) && clip.linkGroupId)
    .map((clip) => clip.linkGroupId));
  state.media = state.media.filter((item) => !derivedIds.has(item.id));
  state.tracks.forEach((track) => {
    track.clips = track.clips
      .filter((clip) => !derivedIds.has(clip.mediaId))
      .map((clip) => removedLinkGroupIds.has(clip.linkGroupId) ? { ...clip, linkGroupId: "" } : clip);
  });
  if (!state.tracks.some((track) => track.clips.some((clip) => clip.id === state.selectedClipId))) state.selectedClipId = "";
  return state;
}

function pairedAssemblyTrack(state, sourceTrack, targetType) {
  const sourceTracks = state.tracks.filter((track) => track.type === sourceTrack.type);
  const targetTracks = state.tracks.filter((track) => track.type === targetType);
  const sourceIndex = Math.max(0, sourceTracks.findIndex((track) => track.id === sourceTrack.id));
  const correspondingTrack = targetTracks[sourceIndex];
  if (correspondingTrack && !correspondingTrack.locked) return correspondingTrack;
  const availableTrack = targetTracks.find((track) => !track.locked);
  if (availableTrack) return availableTrack;

  const track = createAssemblyTrack(targetType, targetTracks.length + 1);
  const insertionIndex = state.tracks.findIndex((item) => assemblyTrackSortRank(item.type) > assemblyTrackSortRank(track.type));
  if (insertionIndex < 0) state.tracks.push(track);
  else state.tracks.splice(insertionIndex, 0, track);
  return track;
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
