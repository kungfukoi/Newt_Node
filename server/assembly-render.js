import { assemblyClipPlaybackRate, assemblyClipSourceSpan, assemblyContentDuration, normalizeAssemblyState } from "../src/assembly/assemblyState.js";

export function createAssemblyRenderPlan(assembly, resolvedMedia = []) {
  const timeline = normalizeAssemblyState(assembly);
  const resolvedById = new Map((resolvedMedia || []).map((item) => [item.id, item]));
  const inputs = [];
  const visualClips = [];
  const audioClips = [];
  const contentDuration = assemblyContentDuration(timeline);
  const usesRange = timeline.inPoint !== null && timeline.outPoint !== null && timeline.outPoint > timeline.inPoint;
  const rangeStart = usesRange ? timeline.inPoint : 0;
  const rangeEnd = usesRange ? timeline.outPoint : contentDuration;

  timeline.tracks.forEach((track, trackIndex) => {
    track.clips.forEach((sourceClip) => {
      const clip = assemblyClipForRenderRange(sourceClip, rangeStart, rangeEnd);
      if (!clip) return;
      const media = timeline.media.find((item) => item.id === clip.mediaId);
      const resolved = resolvedById.get(clip.mediaId);
      if (!media || !resolved?.filePath) return;
      const inputIndex = inputs.length;
      inputs.push({ inputIndex, track, trackIndex, clip, media: { ...media, ...resolved } });
      if (track.type === "video" && !track.hidden && ["video", "image"].includes(media.type)) {
        visualClips.push({ inputIndex, track, trackIndex, clip, media: { ...media, ...resolved } });
      }
      if (!track.muted && ((track.type === "audio" && media.type === "audio") || (track.type === "video" && resolved.hasAudio))) {
        audioClips.push({ inputIndex, track, trackIndex, clip, media: { ...media, ...resolved } });
      }
    });
  });

  return {
    frameRate: timeline.frameRate,
    width: timeline.outputWidth,
    height: timeline.outputHeight,
    duration: Math.max(1 / timeline.frameRate, rangeEnd - rangeStart),
    rangeStart,
    rangeEnd,
    usesRange,
    inputs,
    visualClips: visualClips.sort((first, second) => second.trackIndex - first.trackIndex || first.clip.start - second.clip.start),
    audioClips,
    timeline
  };
}

function assemblyClipForRenderRange(clip, rangeStart, rangeEnd) {
  const clipStart = Math.max(0, Number(clip?.start) || 0);
  const clipDuration = Math.max(0, Number(clip?.duration) || 0);
  const overlapStart = Math.max(clipStart, rangeStart);
  const overlapEnd = Math.min(clipStart + clipDuration, rangeEnd);
  if (overlapEnd <= overlapStart) return null;

  const playbackRate = assemblyClipPlaybackRate(clip);
  const headTrim = (overlapStart - clipStart) * playbackRate;
  const duration = overlapEnd - overlapStart;
  const sourceSpan = duration * playbackRate;
  const originalSourceIn = Math.max(0, Number(clip.sourceIn) || 0);
  const sourceIn = clip.reverse
    ? originalSourceIn + Math.max(0, assemblyClipSourceSpan(clip) - headTrim - sourceSpan)
    : originalSourceIn + headTrim;

  return {
    ...clip,
    start: overlapStart - rangeStart,
    duration,
    sourceIn
  };
}

export function buildAssemblyFfmpegArgs(plan, outputPath) {
  if (!plan?.inputs?.length) throw new Error("Timeline has no resolved media inputs.");
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  plan.inputs.forEach(({ clip, media }) => {
    if (media.type === "image") {
      args.push("-loop", "1", "-t", ffmpegSeconds(clip.duration), "-i", media.filePath);
      return;
    }
    args.push("-ss", ffmpegSeconds(clip.sourceIn), "-t", ffmpegSeconds(assemblyClipSourceSpan(clip)), "-i", media.filePath);
  });

  const filters = [`color=c=black:s=${plan.width}x${plan.height}:r=${plan.frameRate}:d=${ffmpegSeconds(plan.duration)}[assembly-base]`];
  let videoLabel = "assembly-base";
  plan.visualClips.forEach((item, index) => {
    const clipLabel = `assembly-v-${index}`;
    const outputLabel = `assembly-overlay-${index}`;
    const playbackRate = assemblyClipPlaybackRate(item.clip);
    const sourceSpan = assemblyClipSourceSpan(item.clip);
    const timing = item.media.type === "image"
      ? `trim=duration=${ffmpegSeconds(item.clip.duration)},setpts=PTS-STARTPTS+${ffmpegSeconds(item.clip.start)}/TB`
      : [
          `trim=duration=${ffmpegSeconds(sourceSpan)}`,
          item.clip.reverse ? "reverse" : "",
          `setpts=(PTS-STARTPTS)/${ffmpegNumber(playbackRate)}+${ffmpegSeconds(item.clip.start)}/TB`
        ].filter(Boolean).join(",");
    const transforms = [
      `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=decrease:flags=lanczos`,
      assemblyScaleFilter(item.clip.scale),
      item.clip.flipHorizontal ? "hflip" : "",
      item.clip.flipVertical ? "vflip" : "",
      "format=rgba",
      assemblyOpacityFilter(item.clip.opacity),
      assemblyRotateFilter(item.clip.rotation),
      "setsar=1"
    ].filter(Boolean).join(",");
    filters.push(`[${item.inputIndex}:v:0]${timing},${transforms}[${clipLabel}]`);
    filters.push(
      `[${videoLabel}][${clipLabel}]overlay=x=(W-w)/2${signedFfmpegOffset(item.clip.translateX)}:y=(H-h)/2${signedFfmpegOffset(item.clip.translateY)}:` +
      `eof_action=pass:shortest=0:format=auto[${outputLabel}]`
    );
    videoLabel = outputLabel;
  });
  filters.push(`[${videoLabel}]format=yuv420p[assembly-video]`);

  const audioLabels = [];
  plan.audioClips.forEach((item, index) => {
    const label = `assembly-a-${index}`;
    const delay = Math.max(0, Math.round(item.clip.start * 1000));
    const playbackRate = assemblyClipPlaybackRate(item.clip);
    const sourceSpan = assemblyClipSourceSpan(item.clip);
    const timing = [
      `atrim=duration=${ffmpegSeconds(sourceSpan)}`,
      "asetpts=PTS-STARTPTS",
      item.clip.reverse ? "areverse" : "",
      ...assemblyAtempoFilters(playbackRate),
      `atrim=duration=${ffmpegSeconds(item.clip.duration)}`
    ].filter(Boolean).join(",");
    filters.push(
      `[${item.inputIndex}:a:0]${timing},` +
      `adelay=${delay}:all=1,apad=whole_dur=${ffmpegSeconds(plan.duration)},atrim=duration=${ffmpegSeconds(plan.duration)}[${label}]`
    );
    audioLabels.push(`[${label}]`);
  });
  if (audioLabels.length) {
    filters.push(`${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0,atrim=duration=${ffmpegSeconds(plan.duration)}[assembly-audio]`);
  }

  args.push("-filter_complex", filters.join(";"), "-map", "[assembly-video]");
  if (audioLabels.length) args.push("-map", "[assembly-audio]", "-c:a", "aac", "-b:a", "192k");
  else args.push("-an");
  args.push(
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", String(plan.frameRate),
    "-t", ffmpegSeconds(plan.duration),
    "-movflags", "+faststart",
    outputPath
  );
  return args;
}

export function assemblyRenderSummary(plan) {
  return {
    duration: plan.duration,
    frameRate: plan.frameRate,
    width: plan.width,
    height: plan.height,
    sourceCount: plan.inputs.length,
    visualClipCount: plan.visualClips.length,
    audioClipCount: plan.audioClips.length,
    trackCount: plan.timeline.tracks.length
  };
}

function assemblyScaleFilter(scale) {
  const factor = Math.max(0.01, Number(scale || 100) / 100);
  if (Math.abs(factor - 1) < 0.000001) return "";
  return `scale='max(2,trunc(iw*${ffmpegNumber(factor)}/2)*2)':'max(2,trunc(ih*${ffmpegNumber(factor)}/2)*2)':flags=lanczos`;
}

function assemblyOpacityFilter(value) {
  const opacity = Math.min(100, Math.max(0, Number(value ?? 100))) / 100;
  if (opacity >= 0.999999) return "";
  return `colorchannelmixer=aa=${ffmpegNumber(opacity)}`;
}

function assemblyRotateFilter(rotation) {
  const radians = (Number(rotation) || 0) * Math.PI / 180;
  if (Math.abs(radians) < 0.000001) return "";
  const angle = ffmpegNumber(radians);
  return `rotate=${angle}:ow=rotw(${angle}):oh=roth(${angle}):c=none`;
}

function assemblyAtempoFilters(rate) {
  let remaining = Math.max(0.01, Number(rate) || 1);
  const filters = [];
  while (remaining > 2) {
    filters.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  if (Math.abs(remaining - 1) > 0.000001) filters.push(`atempo=${ffmpegNumber(remaining)}`);
  return filters;
}

function signedFfmpegOffset(value) {
  const number = Number(value) || 0;
  return number < 0 ? ffmpegNumber(number) : `+${ffmpegNumber(number)}`;
}

function ffmpegNumber(value) {
  return Number(Number(value || 0).toFixed(6)).toString();
}

function ffmpegSeconds(value) {
  return Math.max(0, Number(value) || 0).toFixed(6);
}
