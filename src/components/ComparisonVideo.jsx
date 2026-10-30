import React from "react";

// Keep a source-clock playhead while changing comparison media. The retained
// result identity stays stable while downstream consumers use the selected view.
export function ComparisonVideo({ preview, src, onReady, onError }) {
  const snapshot = React.useRef({ time: 0, playing: false, volume: 1, muted: false, speed: 1 });
  const rate = preview.rate || 1, offset = preview.offset || 0;
  const remember = event => {
    const video = event.currentTarget;
    if (video.readyState < 1) return;
    snapshot.current = { time: Math.max(0, (video.currentTime - offset) / rate), playing: !video.paused, volume: video.volume, muted: video.muted, speed: video.playbackRate / rate };
  };
  const ready = event => {
    onReady?.(event);
    const video = event.currentTarget, saved = snapshot.current;
    const target = offset + saved.time * rate;
    video.currentTime = Math.min(Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.001) : target, target);
    video.volume = saved.volume;
    video.muted = saved.muted;
    video.playbackRate = saved.speed * rate;
    if (saved.playing) video.play().catch(() => {});
  };
  return <video aria-label={preview.label} src={src} controls loop playsInline preload="metadata" draggable={false} onLoadedMetadata={ready} onError={onError} onTimeUpdate={remember} onPlay={remember} onPause={remember} onVolumeChange={remember} onRateChange={remember} />;
}
