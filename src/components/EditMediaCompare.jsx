import React from "react";
import { MediaCompareDivider } from "./MediaCompareDivider.jsx";
import "./editMediaCompare.css";

const views = [["original", "Original"], ["split", "Compare"], ["edit", "Edit"]];

export function EditMediaCompare({ mediaType, originalUrl, editUrl }) {
  const hasPair = Boolean(originalUrl && editUrl);
  const [view, setView] = React.useState(hasPair ? "split" : originalUrl ? "original" : "edit");
  const [split, setSplit] = React.useState(50);
  const [duration, setDuration] = React.useState(0);
  const [time, setTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [error, setError] = React.useState("");
  const originalRef = React.useRef(null);
  const editRef = React.useRef(null);
  const isVideo = mediaType === "video";

  function videos() {
    return [originalRef.current, editRef.current].filter(Boolean);
  }

  function updateDuration() {
    const durations = videos().map(video => video.duration);
    setDuration(durations.length && durations.every(value => Number.isFinite(value) && value > 0)
      ? Math.min(...durations)
      : 0);
  }

  function seek(value) {
    for (const video of videos()) video.currentTime = value;
    setTime(value);
  }

  function pause() {
    for (const video of videos()) video.pause();
    setPlaying(false);
  }

  async function togglePlayback() {
    if (playing) {
      pause();
      return;
    }
    setError("");
    if (time >= duration) seek(0);
    setPlaying(true);
    try {
      await Promise.all(videos().map(video => video.play()));
    } catch (error) {
      if (error.name === "AbortError") return;
      pause();
      setError("Could not play the videos.");
    }
  }

  function updateTime(event) {
    const clock = originalRef.current || editRef.current;
    if (event.currentTarget !== clock || !duration) return;
    const nextTime = Math.min(clock.currentTime, duration);
    if (clock.currentTime >= duration) {
      pause();
      if (videos().some(video => video.currentTime !== duration)) seek(duration);
    } else if (!clock.paused && editRef.current && editRef.current !== clock) {
      const edited = editRef.current;
      if (!edited.seeking && Math.abs(edited.currentTime - nextTime) > 0.08) edited.currentTime = nextTime;
    }
    setTime(nextTime);
  }

  function renderMedia(url, label, ref, hidden, clipPath, muted) {
    if (!url) return null;
    const style = { clipPath, visibility: hidden ? "hidden" : undefined };
    return isVideo ? (
      <video
        ref={ref}
        src={url}
        aria-label={label}
        style={style}
        muted={muted}
        preload="auto"
        playsInline
        onLoadedMetadata={updateDuration}
        onDurationChange={updateDuration}
        onTimeUpdate={updateTime}
        onEnded={pause}
        onError={() => { pause(); setDuration(0); setError(label + " video could not load."); }}
      />
    ) : <img src={url} alt={label} style={style} draggable={false} onError={() => setError(label + " image could not load.")} />;
  }

  const splitView = view === "split";
  return (
    <section className="edit-media-compare nodrag nopan" aria-label={isVideo ? "Video comparison" : "Image comparison"}>
      <div className="edit-effect-tabs" role="group" aria-label="Comparison view">
        {views.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "active" : ""}
            aria-pressed={view === id}
            disabled={id === "split" ? !hasPair : id === "original" ? !originalUrl : !editUrl}
            onClick={() => setView(id)}
          >{label}</button>
        ))}
      </div>
      <div className="edit-media-compare-viewport">
        {renderMedia(editUrl, "Edit", editRef, view === "original", undefined, Boolean(originalUrl) && view !== "edit")}
        {renderMedia(originalUrl, "Original", originalRef, view === "edit", splitView ? "inset(0 " + (100 - split) + "% 0 0)" : undefined, view === "edit")}
        {splitView && <MediaCompareDivider split={split} setSplit={setSplit} />}
        {!originalUrl && !editUrl && <span>Connect Original and Edit inputs.</span>}
      </div>
      {isVideo && (originalUrl || editUrl) && (
        <div className="edit-media-compare-transport">
          <button type="button" onClick={togglePlayback} disabled={!duration}>{playing ? "Pause" : "Play"}</button>
          <input type="range" aria-label="Comparison playback position" min={0} max={duration} step="any" value={time} disabled={!duration} onChange={event => seek(Number(event.target.value))} />
        </div>
      )}
      {error && <div role="status">{error}</div>}
    </section>
  );
}
