import React from "react";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  FlagOff,
  Lock,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Redo2,
  Repeat2,
  Scissors,
  Trash2,
  Undo2,
  Unlock,
  Volume2,
  VolumeX
} from "lucide-react";
import { displayMediaUrl } from "../mediaAssets.js";
import {
  addAssemblyTrack,
  assemblyActiveClips,
  assemblyClipPlaybackRate,
  assemblyClipSourceTime,
  assemblyDuration,
  assemblyFrameDuration,
  clearAssemblyInOut,
  createAssemblyClipClipboard,
  createAssemblyHistory,
  importAssemblyOutputItem,
  insertAssemblyMediaClip,
  moveAssemblyClip,
  normalizeAssemblyState,
  pasteAssemblyClip,
  removeAssemblyClip,
  retimeAssemblyClip,
  setAssemblyInPoint,
  setAssemblyLoopInOut,
  setAssemblyOutPoint,
  setAssemblyPlayhead,
  setAssemblyView,
  slipAssemblyClip,
  snapAssemblyClipMoveStart,
  splitAssemblyClip,
  syncAssemblyInputs,
  trimAssemblyClip,
  updateAssemblyClip,
  updateAssemblyMedia,
  updateAssemblyTrack
} from "../assembly/assemblyState.js";
import { AssemblyPlaybackClock } from "../assembly/assemblyPlayback.js";
import { clearAssemblyLiveFrame, publishAssemblyLiveFrame } from "../assembly/assemblyLiveFrameBus.js";
import { assemblyMediaTechnicalReadout, assemblyPreviewElementState, assemblyPreviewLayerGeometry, assemblyPreviewMediaInstances, assemblyPreviewSeekTarget, assemblyRenderablePreviewLayers, assemblyScrubPreviewLayers, nextAssemblyPreviewEmission, requestAssemblyVideoFrame } from "../assembly/assemblyLivePreview.js";
import { startAssemblyClipDrag } from "../assembly/assemblyClipDrag.js";
import { assemblyTimeAtClientX } from "../assembly/assemblyPointer.js";
import { assemblyOutputPortState } from "../assembly/assemblyPreview.js";
import { AssemblyDetailsPanel } from "./AssemblyDetailsPanel.jsx";
import { AssemblyMediaBin, assemblyMediaDragType } from "./AssemblyMediaBin.jsx";
import "../assembly/assembly.css";
import "../assembly/assemblyMediaBin.css";
import { NodeRow, OutputPortRow } from "./NodePorts.jsx";

const timelineGutterWidth = 106;
const graphPreviewCheckpointIntervalMs = 250;

export function AssemblyNodeBody({
  node,
  inputItems = [],
  inputPorts = [],
  outputPorts = [],
  onUpdate,
  onRun,
  onProbeMedia,
  running,
  onConnectStart,
  onDisconnectInput,
  connectedPortKeys
}) {
  const initialState = React.useMemo(() => normalizeAssemblyState(node.data.assembly), [node.id]);
  const [timeline, setTimeline] = React.useState(initialState);
  const [playing, setPlaying] = React.useState(false);
  const [probeStatus, setProbeStatus] = React.useState("");
  const [dragTargetTrackId, setDragTargetTrackId] = React.useState("");
  const [draggingClipId, setDraggingClipId] = React.useState("");
  const [clipClipboard, setClipClipboard] = React.useState(null);
  const historyRef = React.useRef(createAssemblyHistory(initialState));
  const timelineRef = React.useRef(initialState);
  const clockRef = React.useRef(null);
  const rootRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const rulerRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const mediaElementsRef = React.useRef(new Map());
  const onProbeMediaRef = React.useRef(onProbeMedia);
  const playingRef = React.useRef(false);
  const probedMediaRef = React.useRef(new Set());
  const lastPreviewEmitRef = React.useRef(null);
  const lastGraphPreviewCheckpointRef = React.useRef(0);
  const lastExternalStateRef = React.useRef(JSON.stringify(initialState));
  const clipDragCleanupRef = React.useRef(null);
  const previewFailureRef = React.useRef("");
  const videoFrameCancelRef = React.useRef(new Map());
  const timelineScrubbingRef = React.useRef(false);
  const scrubPreviewPendingRef = React.useRef(false);

  const duration = assemblyDuration(timeline);
  const pixelsPerSecond = timeline.zoom;
  const timelineWidth = Math.max(760, duration * pixelsPerSecond + 80);
  const selected = findSelectedClip(timeline);
  const selectedMedia = selected ? timeline.media.find((item) => item.id === selected.clip.mediaId) : null;
  const mediaProbeKey = timeline.media.map((media) => `${media.id}:${media.url}`).join("|");
  const previewMediaInstances = assemblyPreviewMediaInstances(timeline);

  React.useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  React.useEffect(() => {
    onProbeMediaRef.current = onProbeMedia;
  }, [onProbeMedia]);

  React.useEffect(() => () => clipDragCleanupRef.current?.(), []);
  React.useEffect(() => () => {
    videoFrameCancelRef.current.forEach((cancel) => cancel?.());
    videoFrameCancelRef.current.clear();
  }, []);
  React.useEffect(() => () => clearAssemblyLiveFrame(node.id), [node.id]);

  React.useEffect(() => {
    const external = normalizeAssemblyState(node.data.assembly);
    const serialized = JSON.stringify(external);
    if (serialized === lastExternalStateRef.current) return;
    lastExternalStateRef.current = serialized;
    historyRef.current.replace(external);
    timelineRef.current = external;
    setTimeline(external);
  }, [node.data.assembly]);

  React.useEffect(() => {
    const synced = syncAssemblyInputs(timelineRef.current, inputItems);
    if (JSON.stringify(synced) === JSON.stringify(timelineRef.current)) return;
    replaceTimeline(synced, true);
  }, [inputItems]);

  React.useEffect(() => {
    let canceled = false;
    const pending = timeline.media.filter((media) => {
      const probeKey = [media.id, media.url].join(":");
      return media.url && !probedMediaRef.current.has(probeKey);
    });
    const probeMedia = onProbeMediaRef.current;
    if (!pending.length || typeof probeMedia !== "function") return undefined;
    pending.forEach((media) => probedMediaRef.current.add([media.id, media.url].join(":")));
    setProbeStatus(`Reading ${pending.length} source${pending.length === 1 ? "" : "s"}...`);

    Promise.allSettled(pending.map(async (media) => ({ media, result: await probeMedia(node, media) })))
      .then((results) => {
        if (canceled) return;
        let next = timelineRef.current;
        let completed = 0;
        results.forEach((entry, index) => {
          if (entry.status !== "fulfilled" || !entry.value.result) {
            const failedMedia = pending[index];
            if (failedMedia) probedMediaRef.current.delete([failedMedia.id, failedMedia.url].join(":"));
            return;
          }
          next = updateAssemblyMedia(next, entry.value.media.id, entry.value.result);
          completed += 1;
        });
        if (completed) replaceTimeline(next, true);
        setProbeStatus(results.some((entry) => entry.status === "rejected") ? "Some source details could not be read." : "");
      });

    return () => {
      canceled = true;
    };
  }, [node.id, mediaProbeKey]);

  React.useEffect(() => {
    const clock = new AssemblyPlaybackClock({
      duration,
      onTime: (time, playbackState) => {
        const current = timelineRef.current;
        const next = setAssemblyPlayhead(current, time);
        timelineRef.current = next;
        setTimeline(next);
        syncMediaElements(next, time, playbackState === "playing");
        renderCompositionFrame(next, time);
      },
      onState: (state) => {
        const nextPlaying = state === "playing";
        playingRef.current = nextPlaying;
        setPlaying(nextPlaying);
        if (!nextPlaying) {
          pauseAllMedia();
          persistTimeline(timelineRef.current);
        }
      }
    });
    clock.seek(timelineRef.current.playhead);
    clockRef.current = clock;
    return () => {
      clock.dispose();
      playingRef.current = false;
      pauseAllMedia();
      clockRef.current = null;
    };
  }, [node.id]);

  React.useEffect(() => {
    clockRef.current?.setDuration(duration);
  }, [duration]);

  React.useEffect(() => {
    clockRef.current?.setLoopRange(timeline.inPoint, timeline.outPoint, timeline.loopInOut);
  }, [timeline.inPoint, timeline.outPoint, timeline.loopInOut]);

  React.useEffect(() => {
    syncMediaElements(timeline, timeline.playhead, playingRef.current);
    renderCompositionFrame(timeline, timeline.playhead, true);
  }, [timeline.media.length, timeline.tracks.length]);

  function persistTimeline(next) {
    const normalized = normalizeAssemblyState(next);
    lastExternalStateRef.current = JSON.stringify(normalized);
    onUpdate(node.id, { assembly: normalized });
  }

  function replaceTimeline(next, persist = false) {
    const normalized = normalizeAssemblyState(next);
    historyRef.current.replace(normalized);
    timelineRef.current = normalized;
    setTimeline(normalized);
    if (persist) persistTimeline(normalized);
  }

  function commitTimeline(next) {
    const normalized = historyRef.current.commit(next);
    timelineRef.current = normalized;
    setTimeline(normalized);
    persistTimeline(normalized);
    syncMediaElements(normalized, normalized.playhead, playingRef.current);
    renderCompositionFrame(normalized, normalized.playhead, true);
  }

  function undo() {
    const next = historyRef.current.undo();
    timelineRef.current = next;
    setTimeline(next);
    persistTimeline(next);
    renderCompositionFrame(next, next.playhead, true);
  }

  function redo() {
    const next = historyRef.current.redo();
    timelineRef.current = next;
    setTimeline(next);
    persistTimeline(next);
    renderCompositionFrame(next, next.playhead, true);
  }

  function seek(time, persist = false) {
    const nextTime = clockRef.current?.seek(time) ?? Math.max(0, Number(time) || 0);
    const next = setAssemblyPlayhead(timelineRef.current, nextTime);
    timelineRef.current = next;
    setTimeline(next);
    syncMediaElements(next, nextTime, playingRef.current);
    renderCompositionFrame(next, nextTime, true);
    if (persist) persistTimeline(next);
  }

  function togglePlayback() {
    rootRef.current?.focus({ preventScroll: true });
    if (playingRef.current) clockRef.current?.pause();
    else {
      syncMediaElements(timelineRef.current, timelineRef.current.playhead, true);
      clockRef.current?.play();
    }
  }

  function toggleLoopInOut() {
    const current = timelineRef.current;
    const next = setAssemblyLoopInOut(current, !current.loopInOut);
    clockRef.current?.setLoopRange(next.inPoint, next.outPoint, next.loopInOut);
    commitTimeline(next);
    if (next.playhead !== current.playhead) clockRef.current?.seek(next.playhead);
  }

  function pauseAllMedia() {
    mediaElementsRef.current.forEach((element) => element?.pause?.());
  }

  function syncMediaElements(state, time, shouldPlay) {
    try {
      syncMediaElementsUnsafe(state, time, shouldPlay);
    } catch (error) {
      reportPreviewFailure("media sync", error);
    }
  }

  function syncMediaElementsUnsafe(state, time, shouldPlay) {
    const visualItems = assemblyActiveClips(state, time, "visual");
    const audioItems = assemblyActiveClips(state, time, "audio");
    const activeByClip = new Map(visualItems.map((item) => [item.id, { item, audible: false }]));
    audioItems.forEach((item) => activeByClip.set(item.id, { item, audible: true }));
    mediaElementsRef.current.forEach((element, clipId) => {
      const active = activeByClip.get(clipId);
      if (!active) {
        element.pause?.();
        return;
      }
      const { item, audible } = active;
      if ("muted" in element) element.muted = !audible;
      const sourceTime = assemblyClipSourceTime(item, time);
      const canPlayForward = shouldPlay && !item.reverse;
      if ("playbackRate" in element) element.playbackRate = assemblyClipPlaybackRate(item);
      const seekTarget = assemblyPreviewSeekTarget(element, sourceTime, state.frameRate, canPlayForward);
      if (seekTarget !== null) {
        try {
          element.currentTime = seekTarget;
        } catch {
          // The media element may still be loading metadata.
        }
      }
      if (canPlayForward && element.paused) {
        const playback = element.play?.();
        playback?.catch?.(() => {});
      }
      if (!canPlayForward && !element.paused) element.pause?.();
    });
  }

  function renderCompositionFrame(state, time, force = false) {
    try {
      renderCompositionFrameUnsafe(state, time, force);
    } catch (error) {
      reportPreviewFailure("frame render", error);
    }
  }

  function renderCompositionFrameUnsafe(state, time, force = false) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext?.("2d");
    if (!canvas || !context) return;
    const layers = [...assemblyActiveClips(state, time, "visual")].reverse();
    const drawableLayers = layers.map((item) => {
      const element = mediaElementsRef.current.get(item.id);
      const sourceTime = assemblyClipSourceTime(item, time);
      return {
        element,
        clip: item,
        ...assemblyPreviewElementState(item.media, element, sourceTime, state.frameRate, playingRef.current && !item.reverse)
      };
    });
    const scrubPreview = timelineScrubbingRef.current || scrubPreviewPendingRef.current;
    const renderableLayers = scrubPreview ? assemblyScrubPreviewLayers(drawableLayers) : assemblyRenderablePreviewLayers(drawableLayers);
    if (scrubPreview && !layers.length && !timelineScrubbingRef.current) scrubPreviewPendingRef.current = false;
    if (layers.length && !renderableLayers.length && !scrubPreview) return;

    const aspect = state.outputWidth / state.outputHeight;
    canvas.width = 640;
    canvas.height = Math.max(180, Math.round(canvas.width / aspect));
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);

    renderableLayers.forEach(({ element, clip, width, height }) => {
      drawAssemblyLayer(context, element, clip, canvas.width, canvas.height, width, height, state.outputWidth, state.outputHeight);
    });

    const now = globalThis.performance?.now?.() || Date.now();
    const emission = nextAssemblyPreviewEmission(lastPreviewEmitRef.current, now, state.frameRate, force);
    if (!emission.emit) return;
    lastPreviewEmitRef.current = emission.scheduledAt;
    try {
      const frameUrl = canvas.toDataURL("image/jpeg", 0.72);
      publishAssemblyLiveFrame({
        nodeId: node.id,
        url: frameUrl,
        frameTime: time,
        targetFrameRate: state.frameRate,
        emittedAt: now
      });
      if (scrubPreview && !timelineScrubbingRef.current && renderableLayers.at(-1)?.ready) scrubPreviewPendingRef.current = false;
      const shouldCheckpointGraph = !node.data.assemblyFrameUrl || now - lastGraphPreviewCheckpointRef.current >= graphPreviewCheckpointIntervalMs;
      if (shouldCheckpointGraph) {
        lastGraphPreviewCheckpointRef.current = now;
        onUpdate(node.id, {
          assemblyFrameUrl: frameUrl,
          assemblyFrameTime: time
        });
      }
    } catch (error) {
      console.warn("Timeline could not export its live preview frame.", error);
    }
  }

  function reportPreviewFailure(stage, error) {
    const message = String(error?.message || error || "Unknown preview error");
    const signature = `${stage}:${message}`;
    if (previewFailureRef.current === signature) return;
    previewFailureRef.current = signature;
    console.warn(`Timeline ${stage} failed without interrupting editing.`, error);
  }

  function handleMediaReady() {
    const current = timelineRef.current;
    syncMediaElements(current, current.playhead, playingRef.current);
    renderCompositionFrame(current, current.playhead, true);
  }

  function handleVideoMediaReady(clipId, element) {
    handleMediaReady();
    videoFrameCancelRef.current.get(clipId)?.();
    const cancel = requestAssemblyVideoFrame(element, () => {
      videoFrameCancelRef.current.delete(clipId);
      renderCompositionFrame(timelineRef.current, timelineRef.current.playhead, true);
    });
    videoFrameCancelRef.current.set(clipId, cancel);
  }

  function beginTimelineScrub(event, preserveGrabOffset = false) {
    if (event.button !== 0) return;
    rootRef.current?.focus({ preventScroll: true });
    const ruler = rulerRef.current;
    if (!ruler) return;
    event.preventDefault();
    event.stopPropagation();
    timelineScrubbingRef.current = true;
    scrubPreviewPendingRef.current = true;
    const captureTarget = event.currentTarget;
    const pointerId = event.pointerId;
    const pointerTime = (pointerEvent) => assemblyTimeAtClientX(ruler, pointerEvent.clientX, pixelsPerSecond);
    const grabOffset = preserveGrabOffset ? pointerTime(event) - timelineRef.current.playhead : 0;
    const update = (pointerEvent) => seek(pointerTime(pointerEvent) - grabOffset, false);
    const cleanup = () => {
      window.removeEventListener("pointermove", update);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      try {
        captureTarget.releasePointerCapture?.(pointerId);
      } catch {
        // Pointer capture may already have ended outside the timeline.
      }
      timelineScrubbingRef.current = false;
      renderCompositionFrame(timelineRef.current, timelineRef.current.playhead, true);
    };
    const finish = (pointerEvent) => {
      update(pointerEvent);
      persistTimeline(timelineRef.current);
      cleanup();
    };
    const cancel = () => {
      persistTimeline(timelineRef.current);
      cleanup();
    };
    captureTarget.setPointerCapture?.(pointerId);
    update(event);
    window.addEventListener("pointermove", update);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
  }

  function beginRulerScrub(event) {
    beginTimelineScrub(event);
  }

  function beginPlayheadScrub(event) {
    beginTimelineScrub(event, true);
  }

  function beginTrim(event, clipId, edge) {
    event.preventDefault();
    event.stopPropagation();
    const base = timelineRef.current;
    const found = findClip(base, clipId);
    if (!found) return;
    const startX = event.clientX;
    const boundary = edge === "left" ? found.clip.start : found.clip.start + found.clip.duration;
    let latest = base;
    const move = (pointerEvent) => {
      latest = trimAssemblyClip(base, clipId, edge, boundary + (pointerEvent.clientX - startX) / pixelsPerSecond, base.ripple);
      timelineRef.current = latest;
      setTimeline(latest);
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      commitTimeline(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
  }

  function beginSlip(event, clipId) {
    if (timeline.tool !== "slip" || event.button !== 0) return false;
    event.preventDefault();
    event.stopPropagation();
    const base = timelineRef.current;
    const startX = event.clientX;
    let latest = base;
    const move = (pointerEvent) => {
      latest = slipAssemblyClip(base, clipId, (pointerEvent.clientX - startX) / pixelsPerSecond);
      timelineRef.current = latest;
      setTimeline(latest);
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      commitTimeline(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    return true;
  }

  function beginClipMove(event, clip, track) {
    if (event.button !== 0 || track.locked) return false;
    clipDragCleanupRef.current?.();
    const startState = setAssemblyView(timelineRef.current, { selectedClipId: clip.id });
    const media = startState.media.find((item) => item.id === clip.mediaId);
    const cleanup = startAssemblyClipDrag({
      event,
      clip,
      track,
      state: startState,
      media,
      pixelsPerSecond,
      scrollElement: scrollRef.current,
      snapStart: snapAssemblyClipMoveStart,
      moveClip: moveAssemblyClip,
      onMove: (next, trackId) => {
        timelineRef.current = next;
        setTimeline(next);
        setDragTargetTrackId(trackId);
      },
      onFinish: (next) => {
        clipDragCleanupRef.current = null;
        setDraggingClipId("");
        setDragTargetTrackId("");
        commitTimeline(next);
      },
      onCancel: (next) => {
        clipDragCleanupRef.current = null;
        setDraggingClipId("");
        setDragTargetTrackId("");
        replaceTimeline(next, false);
      }
    });
    if (!cleanup) return false;
    timelineRef.current = startState;
    setTimeline(startState);
    setDraggingClipId(clip.id);
    setDragTargetTrackId(track.id);
    clipDragCleanupRef.current = cleanup;
    return true;
  }

  function handleClipPointerDown(event, clip, track) {
    rootRef.current?.focus({ preventScroll: true });
    if (timeline.tool === "slip" && beginSlip(event, clip.id)) return;
    if (timeline.tool === "select" && beginClipMove(event, clip, track)) return;
    const next = setAssemblyView(timelineRef.current, { selectedClipId: clip.id });
    timelineRef.current = next;
    setTimeline(next);
  }

  function handleClipClick(event, clip) {
    event.stopPropagation();
    if (timeline.tool !== "blade") return;
    const rect = event.currentTarget.parentElement.getBoundingClientRect();
    const time = (event.clientX - rect.left) / pixelsPerSecond;
    commitTimeline(splitAssemblyClip(timelineRef.current, clip.id, time));
  }

  function handleLaneDrop(event, trackId) {
    const mediaId = event.dataTransfer.getData(assemblyMediaDragType());
    if (!mediaId) return;
    event.preventDefault();
    event.stopPropagation();
    setDragTargetTrackId("");
    const time = assemblyTimeAtClientX(event.currentTarget, event.clientX, pixelsPerSecond);
    commitTimeline(insertAssemblyMediaClip(timelineRef.current, mediaId, trackId, time));
  }

  function handleMediaBinOutputDrop(item) {
    const current = timelineRef.current;
    const next = importAssemblyOutputItem(current, item);
    if (JSON.stringify(next) === JSON.stringify(current)) return false;
    commitTimeline(next);
    return true;
  }

  function selectTool(tool) {
    const next = setAssemblyView(timelineRef.current, { tool });
    replaceTimeline(next, true);
  }

  function jumpToMarker(time) {
    if (time === null || time === undefined) return;
    rootRef.current?.focus({ preventScroll: true });
    seek(time, true);
  }

  function copySelectedClip() {
    const clipboard = createAssemblyClipClipboard(timelineRef.current);
    if (!clipboard) return false;
    setClipClipboard(clipboard);
    return true;
  }

  function pasteCopiedClip() {
    if (!clipClipboard) return false;
    const current = timelineRef.current;
    const next = pasteAssemblyClip(current, clipClipboard, current.playhead);
    if (next === current) return false;
    commitTimeline(next);
    return true;
  }

  function previewSelectedClip(patch) {
    const clipId = timelineRef.current.selectedClipId;
    if (!clipId) return;
    const next = updateAssemblyClip(timelineRef.current, clipId, patch);
    timelineRef.current = next;
    setTimeline(next);
    syncMediaElements(next, next.playhead, playingRef.current);
    renderCompositionFrame(next, next.playhead, true);
  }

  function updateSelectedClip(patch) {
    const clipId = timelineRef.current.selectedClipId;
    if (!clipId) return;
    commitTimeline(updateAssemblyClip(timelineRef.current, clipId, patch));
  }

  function previewRetimeSelectedClip(speed) {
    const clipId = timelineRef.current.selectedClipId;
    if (!clipId) return;
    const next = retimeAssemblyClip(timelineRef.current, clipId, speed, timelineRef.current.ripple);
    timelineRef.current = next;
    setTimeline(next);
    syncMediaElements(next, next.playhead, playingRef.current);
    renderCompositionFrame(next, next.playhead, true);
  }

  function retimeSelectedClip(speed) {
    const clipId = timelineRef.current.selectedClipId;
    if (!clipId) return;
    commitTimeline(retimeAssemblyClip(timelineRef.current, clipId, speed, timelineRef.current.ripple));
  }

  function handleKeyDown(event) {
    if (event.target.closest("input, textarea, select")) return;
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && key === "c") {
      event.preventDefault();
      event.stopPropagation();
      copySelectedClip();
      return;
    }
    if (modifier && key === "v") {
      event.preventDefault();
      event.stopPropagation();
      pasteCopiedClip();
      return;
    }
    if (modifier && key === "z") {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (!modifier && !event.altKey && event.key.toLowerCase() === "i") {
      event.preventDefault();
      commitTimeline(setAssemblyInPoint(timelineRef.current));
      return;
    }
    if (!modifier && !event.altKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      commitTimeline(setAssemblyOutPoint(timelineRef.current));
      return;
    }
    if (!modifier && !event.altKey && event.key === "{" && timelineRef.current.inPoint !== null) {
      event.preventDefault();
      jumpToMarker(timelineRef.current.inPoint);
      return;
    }
    if (!modifier && !event.altKey && event.key === "}" && timelineRef.current.outPoint !== null) {
      event.preventDefault();
      jumpToMarker(timelineRef.current.outPoint);
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      togglePlayback();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      const current = timelineRef.current;
      if (current.selectedClipId) commitTimeline(removeAssemblyClip(current, current.selectedClipId, current.ripple));
      return;
    }
    if (event.key.toLowerCase() === "s" && timeline.selectedClipId) {
      event.preventDefault();
      commitTimeline(splitAssemblyClip(timelineRef.current, timeline.selectedClipId, timeline.playhead));
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      seek(timeline.playhead + (event.key === "ArrowLeft" ? -1 : 1) * assemblyFrameDuration(timeline), true);
    }
  }

  return (
    <div
      ref={rootRef}
      className="node-body assembly-node-body nowheel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="assembly-port-strip assembly-node-drag-surface">
        <div className="assembly-output-ports">
          {outputPorts.map((port) => (
            <OutputPortRow
              key={port.id}
              node={node}
              port={{
                ...port,
                ...assemblyOutputPortState(port.id, node.data.resultUrl)
              }}
              onConnectStart={onConnectStart}
              onDisconnectInput={onDisconnectInput}
              connectedPortKeys={connectedPortKeys}
            />
          ))}
        </div>
      </div>

      <AssemblyMediaBin
        media={timeline.media}
        onOutputDrop={handleMediaBinOutputDrop}
        connectionControls={(
          <div className="assembly-input-ports">
            {inputPorts.map((port) => (
              <NodeRow key={port.id} label={port.label} inputPort={port} node={node} onConnectStart={onConnectStart} onDisconnectInput={onDisconnectInput} connectedPortKeys={connectedPortKeys}>
                <button type="button" className={inputItems.some((item) => item.sourcePortTarget === port.id) ? "connected-field" : ""}>
                  {inputItems.filter((item) => item.sourcePortTarget === port.id).length || "Add"}
                </button>
              </NodeRow>
            ))}
          </div>
        )}
      />

      <AssemblyDetailsPanel
        selection={selected}
        media={selectedMedia}
        frameRate={timeline.frameRate}
        outputWidth={timeline.outputWidth}
        outputHeight={timeline.outputHeight}
        onPreviewUpdate={previewSelectedClip}
        onUpdate={updateSelectedClip}
        onPreviewRetime={previewRetimeSelectedClip}
        onRetime={retimeSelectedClip}
      />

      <div className="assembly-toolbar nodrag" onPointerDown={(event) => event.stopPropagation()}>
        <div className="assembly-tool-group" role="toolbar" aria-label="Timeline edit tools">
          <IconButton active={timeline.tool === "select"} title="Select and move clips" onClick={() => selectTool("select")}><MousePointer2 size={14} /></IconButton>
          <IconButton active={timeline.tool === "blade"} title="Split clips" onClick={() => selectTool("blade")}><Scissors size={14} /></IconButton>
          <IconButton active={timeline.tool === "slip"} title="Slip clip source timing" onClick={() => selectTool("slip")}><span className="assembly-slip-icon">Slip</span></IconButton>
          <IconButton active={timeline.ripple} title="Ripple trim and delete" onClick={() => replaceTimeline(setAssemblyView(timelineRef.current, { ripple: !timeline.ripple }), true)}><span className="assembly-ripple-icon">Ripple</span></IconButton>
        </div>
        <div className="assembly-tool-group">
          <IconButton title="Undo" disabled={!historyRef.current.canUndo()} onClick={undo}><Undo2 size={14} /></IconButton>
          <IconButton title="Redo" disabled={!historyRef.current.canRedo()} onClick={redo}><Redo2 size={14} /></IconButton>
          <IconButton title="Copy selected clip (Ctrl/Cmd+C)" disabled={!timeline.selectedClipId} onClick={copySelectedClip}><Copy size={14} /></IconButton>
          <IconButton title="Paste clip at playhead (Ctrl/Cmd+V)" disabled={!clipClipboard} onClick={pasteCopiedClip}><ClipboardPaste size={14} /></IconButton>
          <IconButton title="Split selected clip at playhead" disabled={!timeline.selectedClipId} onClick={() => commitTimeline(splitAssemblyClip(timelineRef.current, timeline.selectedClipId, timeline.playhead))}><Scissors size={14} /></IconButton>
          <IconButton title="Delete selected clip (Delete/Backspace)" disabled={!timeline.selectedClipId} onClick={() => commitTimeline(removeAssemblyClip(timelineRef.current, timeline.selectedClipId, timeline.ripple))}><Trash2 size={14} /></IconButton>
        </div>
        <div className="assembly-marker-tools" role="toolbar" aria-label="Timeline range markers">
          <IconButton active={timeline.inPoint !== null} title="Set In point" onClick={() => commitTimeline(setAssemblyInPoint(timelineRef.current))}><BetweenHorizontalStart size={14} /></IconButton>
          <IconButton active={timeline.outPoint !== null} title="Set Out point" onClick={() => commitTimeline(setAssemblyOutPoint(timelineRef.current))}><BetweenHorizontalEnd size={14} /></IconButton>
          <IconButton title="Go to In point" disabled={timeline.inPoint === null} onClick={() => jumpToMarker(timeline.inPoint)}><span className="assembly-marker-jump">{"{"}</span></IconButton>
          <IconButton title="Go to Out point" disabled={timeline.outPoint === null} onClick={() => jumpToMarker(timeline.outPoint)}><span className="assembly-marker-jump">{"}"}</span></IconButton>
          <IconButton title="Clear In and Out points" disabled={timeline.inPoint === null && timeline.outPoint === null} onClick={() => commitTimeline(clearAssemblyInOut(timelineRef.current))}><FlagOff size={14} /></IconButton>
        </div>
        <div className="assembly-transport">
          <IconButton active={timeline.loopInOut} title="Loop playback between In and Out" disabled={timeline.inPoint === null || timeline.outPoint === null || timeline.outPoint <= timeline.inPoint} onClick={toggleLoopInOut}><Repeat2 size={15} /></IconButton>
          <IconButton title={playing ? "Pause" : "Play"} onClick={togglePlayback}>{playing ? <Pause size={15} /> : <Play size={15} />}</IconButton>
          <time>{formatTimecode(timeline.playhead, timeline.frameRate)}</time>
          <span>/ {formatTimecode(duration, timeline.frameRate)}</span>
        </div>
        <label className="assembly-zoom-control">
          <span>Zoom</span>
          <input type="range" min="24" max="360" step="4" value={timeline.zoom} onChange={(event) => replaceTimeline(setAssemblyView(timelineRef.current, { zoom: Number(event.target.value) }), true)} />
        </label>
        <div className="assembly-track-actions">
          <button type="button" onClick={() => commitTimeline(addAssemblyTrack(timelineRef.current, "video"))}><Plus size={13} /> Video</button>
          <button type="button" onClick={() => commitTimeline(addAssemblyTrack(timelineRef.current, "audio"))}><Plus size={13} /> Audio</button>
        </div>
      </div>

      <div ref={scrollRef} className="assembly-timeline-scroll nodrag nowheel" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
        <div className="assembly-timeline" style={{ width: timelineGutterWidth + timelineWidth }}>
          <div className="assembly-ruler-row">
            <div className="assembly-ruler-gutter">Tracks</div>
            <div ref={rulerRef} className="assembly-ruler" style={{ width: timelineWidth }} onPointerDown={beginRulerScrub}>
              {rulerTicks(duration, pixelsPerSecond).map((tick) => (
                <span key={tick.time} className={tick.major ? "major" : ""} style={{ left: tick.time * pixelsPerSecond }}>
                  {tick.major ? <i>{formatRulerTime(tick.time)}</i> : null}
                </span>
              ))}
            </div>
          </div>
          {timeline.tracks.map((track) => (
            <div key={track.id} className={`assembly-track-row ${track.type}`}>
              <div className="assembly-track-header">
                <strong>{track.name}</strong>
                <div>
                  {track.type !== "audio" && (
                    <IconButton title={track.hidden ? "Show track" : "Hide track"} onClick={() => commitTimeline(updateAssemblyTrack(timelineRef.current, track.id, { hidden: !track.hidden }))}>
                      {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    </IconButton>
                  )}
                  <IconButton title={track.muted ? "Unmute track" : "Mute track"} onClick={() => commitTimeline(updateAssemblyTrack(timelineRef.current, track.id, { muted: !track.muted }))}>
                    {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </IconButton>
                  <IconButton title={track.locked ? "Unlock track" : "Lock track"} onClick={() => commitTimeline(updateAssemblyTrack(timelineRef.current, track.id, { locked: !track.locked }))}>
                    {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </IconButton>
                </div>
              </div>
              <div
                className={`assembly-track-lane ${dragTargetTrackId === track.id ? "is-drop-target" : ""}`}
                data-track-id={track.id}
                style={{ width: timelineWidth, "--assembly-second-width": `${pixelsPerSecond}px` }}
                onDragOver={(event) => {
                  if (!Array.from(event.dataTransfer.types || []).includes(assemblyMediaDragType())) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  if (dragTargetTrackId !== track.id) setDragTargetTrackId(track.id);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setDragTargetTrackId("");
                }}
                onDrop={(event) => handleLaneDrop(event, track.id)}
                onPointerDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  seek(assemblyTimeAtClientX(event.currentTarget, event.clientX, pixelsPerSecond), true);
                }}
              >
                {track.clips.map((clip) => {
                  const media = timeline.media.find((item) => item.id === clip.mediaId);
                  if (!media) return null;
                  return (
                    <div
                      key={clip.id}
                      className={`assembly-clip ${media.type} ${timeline.selectedClipId === clip.id ? "selected" : ""} ${timeline.tool === "slip" ? "slip-ready" : ""} ${draggingClipId === clip.id ? "dragging" : ""}`}
                      style={{ left: clip.start * pixelsPerSecond, width: Math.max(10, clip.duration * pixelsPerSecond), "--assembly-waveform": media.waveformUrl ? `url("${displayMediaUrl(media.waveformUrl)}")` : "none" }}
                      onPointerDown={(event) => handleClipPointerDown(event, clip, track)}
                      onClick={(event) => handleClipClick(event, clip)}
                      title={`${media.label}\n${formatTimecode(clip.duration, timeline.frameRate)}`}
                    >
                      <button type="button" className="assembly-trim-handle left" aria-label="Trim clip start" onPointerDown={(event) => beginTrim(event, clip.id, "left")} />
                      <span>{media.label}</span>
                      <small>{formatClipDuration(clip.duration)}{clip.speed !== 100 ? ` | ${clip.speed}%` : ""}{clip.reverse ? " | R" : ""}</small>
                      <button type="button" className="assembly-trim-handle right" aria-label="Trim clip end" onPointerDown={(event) => beginTrim(event, clip.id, "right")} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {timeline.inPoint !== null && timeline.outPoint !== null && timeline.outPoint >= timeline.inPoint ? (
            <div
              className="assembly-marked-range"
              style={{
                left: timelineGutterWidth + timeline.inPoint * pixelsPerSecond,
                width: Math.max(1, (timeline.outPoint - timeline.inPoint) * pixelsPerSecond)
              }}
              aria-hidden="true"
            />
          ) : null}
          {timeline.inPoint !== null ? (
            <div className="assembly-range-marker in" style={{ left: timelineGutterWidth + timeline.inPoint * pixelsPerSecond }} aria-hidden="true"><span>I</span></div>
          ) : null}
          {timeline.outPoint !== null ? (
            <div className="assembly-range-marker out" style={{ left: timelineGutterWidth + timeline.outPoint * pixelsPerSecond }} aria-hidden="true"><span>O</span></div>
          ) : null}
          <div
            className="assembly-playhead"
            style={{ left: timelineGutterWidth + timeline.playhead * pixelsPerSecond }}
            role="slider"
            tabIndex={0}
            aria-label="Timeline playhead"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={timeline.playhead}
            aria-valuetext={formatTimecode(timeline.playhead, timeline.frameRate)}
            title="Drag to scrub"
            onPointerDown={beginPlayheadScrub}
          >
            <i />
          </div>
        </div>
      </div>

      <div className="assembly-footer nodrag" onPointerDown={(event) => event.stopPropagation()}>
        <div className="assembly-selection-status">
          {selected && selectedMedia ? (
            <><strong>{selectedMedia.label}</strong><span>In {formatClipDuration(selected.clip.sourceIn)} / {formatClipDuration(selected.clip.duration)} | {assemblyMediaTechnicalReadout(selectedMedia)}</span></>
          ) : <span>{timeline.media.length ? "Select a clip to edit" : "Connect video, audio, or still nodes to begin"}</span>}
          {probeStatus && <small>{probeStatus}</small>}
        </div>
        <label><span>W</span><input type="number" min="16" step="2" value={timeline.outputWidth} onChange={(event) => replaceTimeline(setAssemblyView(timelineRef.current, { outputWidth: Number(event.target.value) }), true)} /></label>
        <label><span>H</span><input type="number" min="16" step="2" value={timeline.outputHeight} onChange={(event) => replaceTimeline(setAssemblyView(timelineRef.current, { outputHeight: Number(event.target.value) }), true)} /></label>
        <label><span>FPS</span><input type="number" min="1" max="120" value={timeline.frameRate} onChange={(event) => replaceTimeline(setAssemblyView(timelineRef.current, { frameRate: Number(event.target.value) }), true)} /></label>
        <button type="button" className="run-node-button assembly-render-button" disabled={running || !timeline.media.length} onClick={() => onRun({ ...node, data: { ...node.data, assembly: timelineRef.current } })}>
          {running ? "Rendering..." : "Render Timeline"}
        </button>
      </div>

      <canvas ref={canvasRef} className="assembly-frame-canvas" aria-hidden="true" />
      <div className="assembly-media-pool" aria-hidden="true">
        {previewMediaInstances.map(({ key, media }) => media.type === "image" ? (
          <img key={key} ref={(element) => rememberMediaElement(key, element)} crossOrigin="anonymous" src={displayMediaUrl(media.url)} alt="" onLoad={handleMediaReady} />
        ) : media.type === "video" ? (
          <video key={key} ref={(element) => rememberMediaElement(key, element)} crossOrigin="anonymous" src={displayMediaUrl(media.url)} preload="metadata" playsInline onLoadedMetadata={handleMediaReady} onLoadedData={(event) => handleVideoMediaReady(key, event.currentTarget)} onSeeked={(event) => handleVideoMediaReady(key, event.currentTarget)} />
        ) : (
          <audio key={key} ref={(element) => rememberMediaElement(key, element)} crossOrigin="anonymous" src={displayMediaUrl(media.url)} preload="metadata" onLoadedMetadata={handleMediaReady} />
        ))}
      </div>
    </div>
  );

  function rememberMediaElement(clipId, element) {
    if (element) mediaElementsRef.current.set(clipId, element);
    else {
      mediaElementsRef.current.delete(clipId);
      videoFrameCancelRef.current.get(clipId)?.();
      videoFrameCancelRef.current.delete(clipId);
    }
  }
}

function IconButton({ active = false, disabled = false, title, onClick, children }) {
  return <button type="button" className={`assembly-icon-button ${active ? "active" : ""}`} disabled={disabled} title={title} aria-label={title} onClick={onClick}>{children}</button>;
}

function drawAssemblyLayer(context, element, clip, frameWidth, frameHeight, mediaWidth, mediaHeight, outputWidth, outputHeight) {
  const geometry = assemblyPreviewLayerGeometry(clip, frameWidth, frameHeight, mediaWidth, mediaHeight, outputWidth, outputHeight);
  context.save();
  context.globalAlpha = geometry.opacity;
  context.translate(geometry.centerX, geometry.centerY);
  context.rotate(geometry.rotation);
  context.scale(geometry.flipX, geometry.flipY);
  context.drawImage(element, -geometry.width / 2, -geometry.height / 2, geometry.width, geometry.height);
  context.restore();
}

function findClip(state, clipId) {
  for (const track of state.tracks) {
    const clip = track.clips.find((item) => item.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

function findSelectedClip(state) {
  return state.selectedClipId ? findClip(state, state.selectedClipId) : null;
}

function rulerTicks(duration, pixelsPerSecond) {
  const majorStep = pixelsPerSecond < 40 ? 10 : pixelsPerSecond < 90 ? 5 : pixelsPerSecond < 180 ? 2 : 1;
  const minorStep = majorStep / 5;
  const count = Math.ceil(duration / minorStep);
  return Array.from({ length: count + 1 }, (_, index) => {
    const time = index * minorStep;
    return { time, major: Math.abs(time / majorStep - Math.round(time / majorStep)) < 0.001 };
  });
}

function formatRulerTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return minutes ? `${minutes}:${String(remainder).padStart(2, "0")}` : `${remainder}s`;
}

function formatTimecode(seconds, frameRate) {
  const fps = Math.max(1, Math.round(Number(frameRate) || 24));
  const totalFrames = Math.max(0, Math.round((Number(seconds) || 0) * fps));
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return [hours, mins, secs, frames].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatClipDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  return value < 10 ? `${value.toFixed(2)}s` : `${value.toFixed(1)}s`;
}
