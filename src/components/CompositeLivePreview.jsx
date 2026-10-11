import React from "react";
import { displayMediaUrl } from "../mediaAssets.js";
import { compositePreviewPixels, compositePreviewMask } from "../compositePreview.js";

export function CompositeLivePreview({ layers, stillDuration = 5, renderedResult, hasResult, runError }) {
  const canvasRef = React.useRef(null);
  const rootRef = React.useRef(null);
  const seekRef = React.useRef(null);
  const timeLabelRef = React.useRef(null);
  const playheadRef = React.useRef(0);
  const [resources, setResources] = React.useState(new Map());
  const [error, setError] = React.useState("");
  const [playing, setPlaying] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [time, setTime] = React.useState(0);
  const [frame, setFrame] = React.useState(0);
  const [showRendered, setShowRendered] = React.useState(false);
  const assetKey = JSON.stringify(layers.flatMap((layer) => [{ url: layer.url, type: layer.type }, { url: layer.maskUrl, type: layer.maskType }]).filter((asset) => asset.url));
  React.useEffect(() => {
    let active = true;
    const assets = new Map();
    setResources(new Map()); setError(""); setPlaying(false); setTime(0);
    playheadRef.current = 0;
    const ready = () => { if (active) setResources(new Map(assets)); };
    for (const asset of JSON.parse(assetKey)) {
      const key = `${asset.type}:${asset.url}`;
      if (assets.has(key)) continue;
      const element = asset.type === "video" ? document.createElement("video") : new Image();
      element.crossOrigin = "anonymous";
      if (asset.type === "video") {
        element.muted = true; element.playsInline = true; element.preload = "auto";
        element.onloadeddata = ready;
        element.onseeked = () => { if (active) setFrame((value) => value + 1); };
      } else element.onload = ready;
      element.onerror = () => { if (active) setError("A connected asset could not load for preview."); };
      assets.set(key, element);
      element.src = displayMediaUrl(asset.url);
    }
    return () => {
      active = false;
      for (const element of assets.values()) {
        element.onload = element.onerror = element.onloadeddata = element.onseeked = null;
        if (element.tagName === "VIDEO") { element.pause(); element.removeAttribute("src"); element.load(); }
        else element.src = "";
      }
    };
  }, [assetKey]);
  React.useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && !document.hidden));
    const visibility = () => setVisible(!document.hidden && Boolean(rootRef.current?.getBoundingClientRect().width));
    if (rootRef.current) observer.observe(rootRef.current);
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  const videos = [...resources.values()].filter((element) => element.tagName === "VIDEO");
  const firstVideo = layers.map((layer) => resources.get(`video:${layer.url}`)).find(Boolean);
  const duration = Number.isFinite(firstVideo?.duration) && firstVideo.duration > 0 ? firstVideo.duration : Number(stillDuration) || 5;
  React.useEffect(() => {
    for (const video of videos) {
      if (playing && visible && !showRendered) video.play().catch(() => { setPlaying(false); setError("Preview playback failed. You can still seek frames."); });
      else video.pause();
    }
  }, [playing, visible, showRendered, resources]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || showRendered || !visible) return;
    const scratch = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
    const loaded = (element) => element && (element.tagName === "VIDEO" ? element.readyState >= 2 : element.complete && element.naturalWidth > 0);
    let raf = 0;
    let lastPaint = -Infinity;
    const started = performance.now();
    const startTime = playheadRef.current;
    const draw = (timestamp) => {
      if (playing && timestamp - lastPaint < 83) { raf = requestAnimationFrame(draw); return; }
      lastPaint = timestamp;
      try {
        const base = resources.get(`${layers[0]?.type}:${layers[0]?.url}`);
        if (loaded(base)) {
          const baseWidth = base.videoWidth || base.naturalWidth;
          const baseHeight = base.videoHeight || base.naturalHeight;
          const scale = Math.min(1, 320 / Math.max(baseWidth, baseHeight));
          const width = Math.max(1, Math.round(baseWidth * scale));
          const height = Math.max(1, Math.round(baseHeight * scale));
          canvas.width = scratch.width = width; canvas.height = scratch.height = height;
          const output = context.createImageData(width, height);
          for (let index = 3; index < output.data.length; index += 4) output.data[index] = 255;
          const sample = (element, blur = 0, mask = false) => {
            scratchContext.clearRect(0, 0, width, height);
            if (mask) { scratchContext.fillStyle = "black"; scratchContext.fillRect(0, 0, width, height); }
            const sourceWidth = element.videoWidth || element.naturalWidth;
            const sourceHeight = element.videoHeight || element.naturalHeight;
            const fit = Math.min(width / sourceWidth, height / sourceHeight);
            scratchContext.filter = blur > 0 ? `blur(${blur * scale}px)` : "none";
            scratchContext.drawImage(element, (width - sourceWidth * fit) / 2, (height - sourceHeight * fit) / 2, sourceWidth * fit, sourceHeight * fit);
            scratchContext.filter = "none";
            return scratchContext.getImageData(0, 0, width, height).data;
          };
          for (const layer of layers) {
            const source = resources.get(`${layer.type}:${layer.url}`);
            const mask = resources.get(`${layer.maskType}:${layer.maskUrl}`);
            if (!loaded(source) || (layer.maskUrl && !loaded(mask))) continue;
            const sourcePixels = sample(source);
            const maskValues = mask ? compositePreviewMask(sample(mask, layer.maskBlur, true), width, height, layer.invertMask, layer.maskExpand * scale) : null;
            compositePreviewPixels(output.data, sourcePixels, layer, maskValues);
          }
          context.putImageData(output, 0, 0);
        }
      } catch { setError("This asset cannot be read for a browser preview. Run still renders the output."); setPlaying(false); return; }
      if (playing) {
        const currentTime = firstVideo ? firstVideo.currentTime : Math.min(duration, startTime + (timestamp - started) / 1000);
        playheadRef.current = currentTime;
        if (seekRef.current) seekRef.current.value = String(currentTime);
        if (timeLabelRef.current) timeLabelRef.current.textContent = `${currentTime.toFixed(1)}s`;
        // Keep the seek label local; never store thumbnail playback in workflow data.
        if (firstVideo?.ended || currentTime >= duration) { setTime(duration); setPlaying(false); }
        else raf = requestAnimationFrame(draw);
      }
    };
    draw(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [layers, resources, playing, visible, showRendered, frame, time, duration]);

  const seek = (value) => {
    setPlaying(false); setTime(value);
    playheadRef.current = value;
    for (const video of videos) if (Number.isFinite(video.duration)) video.currentTime = Math.min(value, Math.max(0, video.duration - 0.001));
    setFrame((current) => current + 1);
  };
  const startPlayback = () => {
    if (playing) { setTime(playheadRef.current); setPlaying(false); return; }
    if (time >= duration || firstVideo?.ended) seek(0);
    setPlaying(true);
  };
  return <div ref={rootRef} className="composite-live-preview nodrag">
    {showRendered ? renderedResult : <>
      <div className={`result-pane ${layers.length ? "has-result" : ""}`}>
        <canvas ref={canvasRef} aria-label="Live composite thumbnail" style={{ display: layers.length ? "block" : "none" }} />
        {!layers.length && <small>Connect images or videos to preview the composite.</small>}
      </div>
      <div className="composite-preview-transport">
        <button type="button" aria-label={playing ? "Pause composite preview" : "Play composite preview"} disabled={!resources.size || Boolean(error)} onClick={startPlayback}>{playing ? "Pause" : "Play"}</button>
        <input ref={seekRef} type="range" aria-label="Composite preview time" min="0" max={duration} step="0.01" value={time} onChange={(event) => seek(Number(event.target.value))} />
        <span ref={timeLabelRef}>{time.toFixed(1)}s</span>
      </div>
      <small role={error ? "status" : undefined}>{error || (layers.length && !resources.size ? "Loading preview…" : "Live thumbnail preview · Run renders full quality")}</small>
    </>}
    {hasResult && <button type="button" className="composite-preview-output-toggle" onClick={() => { setPlaying(false); setShowRendered(!showRendered); }}>{showRendered ? "Live preview" : "Rendered output"}</button>}
    {runError && <small role="status">{runError}</small>}
  </div>;
}
