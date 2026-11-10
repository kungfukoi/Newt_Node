import { displayMediaUrl } from "../mediaAssets.js";
import { assemblyActiveClips, assemblyClipSourceTime } from "./assemblyState.js";
import { assemblyPreviewLayerGeometry, assemblyPreviewTargetFrameRate } from "./assemblyLivePreview.js";

const maxFrames = 48;
const maxBytes = 48 * 1024 * 1024;

export function createAssemblyPreviewCache(onProgress) {
  const frames = new Map();
  const sources = new Map();
  const canvas = document.createElement("canvas");
  let state, signature, fps, lastIndex, cursor, direction, playing;
  let enabled = false, suspended = false, bytes = 0, failures = 0;
  let timer, job;

  function stop() {
    clearTimeout(timer);
    timer = undefined;
    job?.abort();
    job = undefined;
    for (const source of sources.values()) releaseSource(source);
    sources.clear();
  }

  function clear() {
    stop();
    frames.clear();
    bytes = 0;
    failures = 0;
    onProgress(0);
  }

  function schedule(delay) {
    if (timer !== undefined || job || !enabled || suspended || !state || lastIndex < 0 || failures >= 3) return;
    timer = setTimeout(() => {
      timer = undefined;
      void fill();
    }, delay);
  }

  async function fill() {
    let index = cursor;
    const lookahead = Math.min(maxFrames, Math.ceil(fps * 1.6));
    for (let n = 0; n < lookahead && index >= 0 && index <= lastIndex; n++, index += direction) {
      if (frames.has(index)) continue;
      const controller = new AbortController();
      job = controller;
      try {
        const image = await composeFrame(canvas, state, index / fps, sources, controller.signal);
        if (controller.signal.aborted) return;
        frames.set(index, image);
        bytes += image.src.length * 2 + image.width * image.height * 4;
        while (frames.size > maxFrames || bytes > maxBytes) {
          const farthest = [...frames.keys()].reduce((a, b) => Math.abs(a - cursor) > Math.abs(b - cursor) ? a : b);
          const old = frames.get(farthest);
          bytes -= old.src.length * 2 + old.width * old.height * 4;
          frames.delete(farthest);
          // At the memory limit, wait for the playhead to advance before replacing more frames.
          if (!frames.has(index)) break;
        }
        failures = 0;
        onProgress(frames.size);
        job = undefined;
        if (frames.has(index)) schedule(playing ? 24 : 8);
        else if (!playing) stop();
      } catch {
        if (!controller.signal.aborted) {
          stop();
          failures++;
          schedule(300);
        }
      }
      return;
    }
    onProgress(frames.size);
    if (!playing) stop();
  }

  return {
    setEnabled(next) {
      enabled = next;
      if (enabled) schedule(140);
      else clear();
    },
    update(nextState, time, { active, reverse, scrubbing }) {
      if (!state || state.tracks !== nextState.tracks || state.media !== nextState.media || state.frameRate !== nextState.frameRate || state.outputWidth !== nextState.outputWidth || state.outputHeight !== nextState.outputHeight) {
        const nextSignature = compositionSignature(nextState);
        if (signature !== nextSignature) {
          clear();
          signature = nextSignature;
          fps = assemblyPreviewTargetFrameRate(nextState.frameRate);
          lastIndex = Math.ceil(fps * nextState.tracks.reduce((end, track) => {
            if (track.hidden || track.type === "audio") return end;
            return track.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), end);
          }, 0)) - 1;
        }
        state = nextState;
      }
      const index = Math.floor(time * fps + 1e-6);
      if (Math.abs(index - cursor) > fps || (scrubbing && !suspended)) stop();
      if (index !== cursor && !active) failures = 0;
      cursor = index;
      direction = reverse ? -1 : 1;
      playing = active;
      suspended = scrubbing;
      schedule(active ? 24 : 140);
      return active && !scrubbing ? frames.get(index) : undefined;
    },
    dispose: stop
  };
}

function compositionSignature(state) {
  return JSON.stringify([state.frameRate, state.outputWidth, state.outputHeight,
    state.media.map(({ id, type, url }) => [id, type, url]),
    state.tracks.filter(track => track.type !== "audio").map(({ hidden, clips }) => [hidden, clips])]);
}

async function composeFrame(canvas, state, time, sources, signal) {
  const layers = assemblyActiveClips(state, time).reverse();
  const active = new Set(layers.map(clip => clip.id));
  for (const [id, source] of sources) {
    if (active.has(id)) continue;
    releaseSource(source);
    sources.delete(id);
  }
  const elements = await Promise.all(layers.map(async clip => {
    let element = sources.get(clip.id);
    if (!element) {
      element = document.createElement(clip.media.type === "video" ? "video" : "img");
      element.crossOrigin = "anonymous";
      if (clip.media.type === "video") {
        element.preload = "auto";
        element.muted = true;
      }
      sources.set(clip.id, element);
      element.src = displayMediaUrl(clip.media.url);
    }
    if (clip.media.type === "image") {
      if (!element.complete || !element.naturalWidth) await waitForMedia(element, "load", signal);
    } else {
      if (element.readyState < 2) await waitForMedia(element, "loadeddata", signal);
      const target = Math.min(assemblyClipSourceTime(clip, time), Math.max(0, element.duration - 0.001));
      if (Math.abs(element.currentTime - target) > 0.0005) {
        await waitForMedia(element, "seeked", signal, () => { element.currentTime = target; });
      }
    }
    return element;
  }));
  signal.throwIfAborted();
  const aspect = state.outputWidth / state.outputHeight;
  const width = Math.max(1, Math.min(640, Math.round(640 * aspect)));
  const height = Math.min(640, Math.max(1, Math.round(width / aspect)));
  if (canvas.width !== width) canvas.width = Math.max(1, width);
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  layers.forEach((clip, index) => drawAssemblyLayer(context, elements[index], clip, canvas.width, canvas.height,
    elements[index].videoWidth || elements[index].naturalWidth, elements[index].videoHeight || elements[index].naturalHeight,
    state.outputWidth, state.outputHeight));
  const image = new Image();
  image.src = canvas.toDataURL("image/jpeg", 0.72);
  await image.decode();
  return image;
}

function waitForMedia(element, event, signal, start) {
  return new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", failed);
      element.removeEventListener(event, ready);
      element.removeEventListener("error", failed);
      if (error) reject(error);
      else resolve();
    };
    const ready = () => finish();
    const failed = () => finish(new Error("Preview cache media unavailable"));
    const timeout = setTimeout(failed, 1500);
    if (signal.aborted || element.error) failed();
    else {
      element.addEventListener(event, ready);
      element.addEventListener("error", failed);
      signal.addEventListener("abort", failed);
      try { start?.(); } catch (error) { finish(error); }
    }
  });
}

function releaseSource(source) {
  source.removeAttribute("src");
  source.load?.();
}

export function drawAssemblyLayer(context, element, clip, frameWidth, frameHeight, mediaWidth, mediaHeight, outputWidth, outputHeight) {
  const geometry = assemblyPreviewLayerGeometry(clip, frameWidth, frameHeight, mediaWidth, mediaHeight, outputWidth, outputHeight);
  context.save();
  context.globalAlpha = geometry.opacity;
  context.translate(geometry.centerX, geometry.centerY);
  context.rotate(geometry.rotation);
  context.scale(geometry.flipX, geometry.flipY);
  context.drawImage(element, -geometry.width / 2, -geometry.height / 2, geometry.width, geometry.height);
  context.restore();
}
