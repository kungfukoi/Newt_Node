import { assemblyContentDuration, normalizeAssemblyState } from "../src/assembly/assemblyState.js";

export function createAssemblyRenderPlan(assembly, resolvedMedia = []) {
  const timeline = normalizeAssemblyState(assembly);
  const resolvedById = new Map((resolvedMedia || []).map((item) => [item.id, item]));
  const inputs = [];
  const visualClips = [];
  const audioClips = [];

  timeline.tracks.forEach((track, trackIndex) => {
    track.clips.forEach((clip) => {
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
    duration: assemblyContentDuration(timeline),
    inputs,
    visualClips: visualClips.sort((first, second) => second.trackIndex - first.trackIndex || first.clip.start - second.clip.start),
    audioClips,
    timeline
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
    args.push("-ss", ffmpegSeconds(clip.sourceIn), "-t", ffmpegSeconds(clip.duration), "-i", media.filePath);
  });

  const filters = [`color=c=black:s=${plan.width}x${plan.height}:r=${plan.frameRate}:d=${ffmpegSeconds(plan.duration)}[assembly-base]`];
  let videoLabel = "assembly-base";
  plan.visualClips.forEach((item, index) => {
    const clipLabel = `assembly-v-${index}`;
    const outputLabel = `assembly-overlay-${index}`;
    filters.push(
      `[${item.inputIndex}:v:0]trim=duration=${ffmpegSeconds(item.clip.duration)},setpts=PTS-STARTPTS+${ffmpegSeconds(item.clip.start)}/TB,` +
      `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
      `pad=${plan.width}:${plan.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=rgba[${clipLabel}]`
    );
    filters.push(`[${videoLabel}][${clipLabel}]overlay=eof_action=pass:shortest=0:format=auto[${outputLabel}]`);
    videoLabel = outputLabel;
  });
  filters.push(`[${videoLabel}]format=yuv420p[assembly-video]`);

  const audioLabels = [];
  plan.audioClips.forEach((item, index) => {
    const label = `assembly-a-${index}`;
    const delay = Math.max(0, Math.round(item.clip.start * 1000));
    filters.push(
      `[${item.inputIndex}:a:0]atrim=duration=${ffmpegSeconds(item.clip.duration)},asetpts=PTS-STARTPTS,` +
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

function ffmpegSeconds(value) {
  return Math.max(0, Number(value) || 0).toFixed(6);
}
