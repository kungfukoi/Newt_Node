import React from "react";
import { createPortal } from "react-dom";
import { Film, Image as ImageIcon, Music2, X } from "lucide-react";
import { displayMediaUrl, hasOutputItemDragData, outputItemFromDataTransfer } from "../mediaAssets.js";

const mediaDragType = "application/x-newtnode-assembly-media";

export function AssemblyMediaBin({ media = [], connectionControls = null, onOutputDrop = null }) {
  const [viewerMediaId, setViewerMediaId] = React.useState("");
  const [outputDropActive, setOutputDropActive] = React.useState(false);
  const viewerMedia = media.find((item) => item.id === viewerMediaId) || null;

  React.useEffect(() => {
    if (!viewerMediaId) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setViewerMediaId("");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerMediaId]);

  React.useEffect(() => {
    if (viewerMediaId && !viewerMedia) setViewerMediaId("");
  }, [viewerMedia, viewerMediaId]);

  function handleOutputDragOver(event) {
    if (!onOutputDrop || !hasOutputItemDragData(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    if (!outputDropActive) setOutputDropActive(true);
  }

  function handleOutputDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setOutputDropActive(false);
  }

  function handleOutputDrop(event) {
    if (!onOutputDrop || !hasOutputItemDragData(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setOutputDropActive(false);
    const item = outputItemFromDataTransfer(event.dataTransfer);
    if (!item || !["image", "video", "audio"].includes(item.type)) return;
    onOutputDrop(item);
  }

  return (
    <>
      <aside
        className={`assembly-media-bin nodrag nowheel ${outputDropActive ? "is-output-drop-target" : ""}`}
        aria-label="Timeline media bin"
        onPointerDown={(event) => event.stopPropagation()}
        onDragOver={handleOutputDragOver}
        onDragLeave={handleOutputDragLeave}
        onDrop={handleOutputDrop}
      >
        <header className="assembly-media-bin-header">
          <strong>Media</strong>
          <span>{media.length}</span>
        </header>
        {connectionControls && <div className="assembly-media-bin-inputs">{connectionControls}</div>}
        <div className="assembly-media-bin-list">
          {media.map((item) => (
            <div
              key={item.id}
              className={`assembly-media-bin-item ${item.type}`}
              draggable
              role="button"
              tabIndex={0}
              title="Drag to a compatible track. Double-click to preview."
              onDragStart={(event) => beginMediaDrag(event, item)}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setViewerMediaId(item.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                setViewerMediaId(item.id);
              }}
            >
              <MediaThumbnail media={item} />
              <div className="assembly-media-bin-caption">
                <strong>{item.label}</strong>
                <small>{mediaDetails(item)}</small>
              </div>
            </div>
          ))}
          {!media.length && (
            <div className="assembly-media-bin-empty">
              <Film size={20} />
              <span>No media</span>
            </div>
          )}
        </div>
      </aside>
      {viewerMedia && <MediaViewer media={viewerMedia} onClose={() => setViewerMediaId("")} />}
    </>
  );
}

export function assemblyMediaDragType() {
  return mediaDragType;
}

function beginMediaDrag(event, media) {
  event.stopPropagation();
  event.dataTransfer.setData(mediaDragType, media.id);
  event.dataTransfer.effectAllowed = "copy";
}

function MediaThumbnail({ media }) {
  const source = displayMediaUrl(media.url);
  const aspectRatio = media.width && media.height ? String(media.width) + " / " + String(media.height) : media.type === "audio" ? "16 / 5" : "16 / 9";
  if (media.type === "image") {
    return <div className="assembly-media-bin-thumb" style={{ aspectRatio }}><img src={source} alt="" draggable={false} /><span className="assembly-media-type"><ImageIcon size={11} /></span></div>;
  }
  if (media.type === "video") {
    return <div className="assembly-media-bin-thumb" style={{ aspectRatio }}><video src={source} muted playsInline preload="metadata" draggable={false} onLoadedMetadata={primeVideoThumbnail} /><span className="assembly-media-type"><Film size={11} /></span></div>;
  }
  return (
    <div className="assembly-media-bin-thumb audio" style={{ aspectRatio }}>
      {media.waveformUrl ? <img src={displayMediaUrl(media.waveformUrl)} alt="" draggable={false} /> : <Music2 size={24} />}
      <span className="assembly-media-type"><Music2 size={11} /></span>
    </div>
  );
}

function MediaViewer({ media, onClose }) {
  if (typeof document === "undefined" || !document.body) return null;
  const source = displayMediaUrl(media.url);
  return createPortal(
    <div
      className="assembly-media-viewer-backdrop nodrag nowheel"
      role="presentation"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
      onWheel={(event) => event.stopPropagation()}
    >
      <section
        className="assembly-media-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={media.label}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") onClose();
        }}
      >
        <header>
          <strong>{media.label}</strong>
          <button type="button" title="Close media preview" aria-label="Close media preview" onClick={onClose}><X size={18} /></button>
        </header>
        <div className={`assembly-media-viewer-stage ${media.type}`}>
          {media.type === "image" && <img src={source} alt={media.label} draggable={false} />}
          {media.type === "video" && <video src={source} controls playsInline autoPlay />}
          {media.type === "audio" && (
            <div className="assembly-media-viewer-audio">
              {media.waveformUrl ? <img src={displayMediaUrl(media.waveformUrl)} alt="" draggable={false} /> : <Music2 size={48} />}
              <audio src={source} controls autoPlay />
            </div>
          )}
        </div>
        <footer><span>{mediaDetails(media)}</span><span>{media.fileName}</span></footer>
      </section>
    </div>,
    document.body
  );
}

function primeVideoThumbnail(event) {
  const video = event.currentTarget;
  if (!Number.isFinite(video.duration) || video.duration <= 0.01) return;
  try {
    video.currentTime = Math.min(0.05, video.duration / 2);
  } catch {
    // Some streaming sources do not allow an eager thumbnail seek.
  }
}

function mediaDetails(media) {
  const duration = Number(media.duration || 0);
  const dimensions = media.width && media.height ? `${media.width}x${media.height}` : "";
  const durationText = media.type === "image" ? "Still" : formatDuration(duration);
  return [media.linkedSource ? "Linked" : "Snapshot", durationText, dimensions].filter(Boolean).join(" / ");
}

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${value.toFixed(value < 10 ? 2 : 1)}s`;
  const minutes = Math.floor(value / 60);
  const remainder = Math.floor(value % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
