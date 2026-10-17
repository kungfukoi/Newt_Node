import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";
import { assemblyRenderPayload } from "../src/assembly/assemblyState.js";
import { assemblyRenderSummary, buildAssemblyFfmpegArgs, createAssemblyRenderPlan } from "../server/assembly-render.js";
import { assemblyActiveClips, createAssemblyState, insertAssemblyMediaClip, normalizeAssemblyState, retimeAssemblyClip, setAssemblyView, syncAssemblyInputs, updateAssemblyClip, updateAssemblyMedia } from "../src/assembly/assemblyState.js";

test("render audio defaults on for older timelines and preserves an explicit off setting", () => {
  assert.equal(createAssemblyState().renderAudio, true);
  assert.equal(normalizeAssemblyState({}).renderAudio, true);
  const silent = setAssemblyView(createAssemblyState(), { renderAudio: false });
  assert.equal(normalizeAssemblyState(JSON.parse(JSON.stringify(silent))).renderAudio, false);
  assert.equal(assemblyRenderPayload(silent).renderAudio, false);
  assert.equal(assemblyRenderPayload(createAssemblyState()).renderAudio, true);
});

test("real timeline render mixes different audio sample rates with valid timestamps and audible samples", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "newt-timeline-audio-"));
  try {
    const sources = [32000, 44100].map((rate, index) => {
      const filePath = path.join(directory, `tone-${rate}.wav`);
      execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${440 + index * 220}:sample_rate=${rate}:duration=2`, filePath], { windowsHide: true });
      return { id: `audio-${index}`, filePath, hasAudio: true };
    });
    let state = createAssemblyState({ outputWidth: 64, outputHeight: 64 });
    state = syncAssemblyInputs(state, sources.map(source => ({ id: source.id, url: source.filePath, type: "audio", duration: 2 })));
    const track = state.tracks.find(item => item.type === "audio");
    sources.forEach((source, index) => { state = insertAssemblyMediaClip(state, source.id, track.id, index * 0.5); });
    const output = path.join(directory, "render.mp4");
    execFileSync(ffmpeg, buildAssemblyFfmpegArgs(createAssemblyRenderPlan(assemblyRenderPayload(state), sources), output), { windowsHide: true });
    const metadata = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", output], { encoding: "utf8", windowsHide: true }));
    const audio = metadata.streams.find(stream => stream.codec_type === "audio");
    assert.ok(audio);
    assert.ok(Math.abs(Number(audio.start_time)) < 0.1);
    assert.ok(Number(audio.duration) >= 2.4 && Number(audio.duration) < 2.7);
    const samples = execFileSync(ffmpeg, ["-v", "error", "-i", output, "-vn", "-f", "s16le", "-ac", "1", "pipe:1"], { windowsHide: true });
    assert.ok(samples.length > 200000);
    let peak = 0;
    for (let offset = 0; offset < samples.length; offset += 2) peak = Math.max(peak, Math.abs(samples.readInt16LE(offset)));
    assert.ok(peak > 1000, `Expected audible samples, peak was ${peak}`);
    const silentOutput = path.join(directory, "silent.mp4");
    execFileSync(ffmpeg, buildAssemblyFfmpegArgs(createAssemblyRenderPlan(assemblyRenderPayload({ ...state, renderAudio: false }), sources), silentOutput), { windowsHide: true });
    const silent = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-of", "json", silentOutput], { encoding: "utf8", windowsHide: true }));
    assert.equal(silent.streams.some(stream => stream.codec_type === "audio"), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("disabling render audio excludes embedded and separate audio while retaining preview audio", () => {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", url: "/v.mp4", type: "video", duration: 4, hasAudio: true },
    { id: "audio", url: "/a.wav", type: "audio", duration: 4 }
  ]);
  state = insertAssemblyMediaClip(state, "video", state.tracks.find(track => track.type === "video").id, 0);
  state = insertAssemblyMediaClip(state, "audio", state.tracks.find(track => track.type === "audio").id, 0);
  const resolved = [
    { id: "video", filePath: "v.mp4", hasAudio: true },
    { id: "audio", filePath: "a.wav", hasAudio: true }
  ];
  const audible = createAssemblyRenderPlan(state, resolved);
  assert.equal(audible.audioClips.length, 2);
  assert.ok(buildAssemblyFfmpegArgs(audible, "out.mp4").includes("[assembly-audio]"));
  state = setAssemblyView(state, { renderAudio: false });
  const silent = createAssemblyRenderPlan(state, resolved);
  assert.equal(silent.audioClips.length, 0);
  assert.deepEqual(silent.visualClips, audible.visualClips);
  assert.equal(assemblyRenderSummary(silent).renderAudio, false);
  const args = buildAssemblyFfmpegArgs(silent, "out.mp4");
  assert.ok(args.includes("-an"));
  assert.ok(!args.includes("[assembly-audio]"));
  assert.equal(assemblyActiveClips(state, 1, "audio").length, 2);
  assert.equal(createAssemblyRenderPlan(setAssemblyView(state, { renderAudio: true }), resolved).audioClips.length, 2);
});

test("timeline render plan keeps multiple visual and audio tracks", () => {
  let state = syncAssemblyInputs(createAssemblyState(), [
    { id: "video", sourceNodeId: "v", sourcePort: "videoOut", url: "/v.mp4", type: "video", duration: 4 },
    { id: "audio", sourceNodeId: "a", sourcePort: "audioOut", url: "/a.wav", type: "audio", duration: 6 },
    { id: "still", sourceNodeId: "i", sourcePort: "imageOut", url: "/i.png", type: "image", duration: 5 }
  ]);
  state = updateAssemblyMedia(state, "video", { duration: 4, hasAudio: true });
  const videoTracks = state.tracks.filter((track) => track.type === "video");
  const audioTrack = state.tracks.find((track) => track.type === "audio");
  state = insertAssemblyMediaClip(state, "video", videoTracks[0].id, 0);
  state = insertAssemblyMediaClip(state, "still", videoTracks[1].id, 0);
  state = insertAssemblyMediaClip(state, "audio", audioTrack.id, 0);
  const videoClip = state.tracks.flatMap((track) => track.clips).find((clip) => clip.mediaId === "video");
  state = updateAssemblyClip(state, videoClip.id, {
    translateX: 120,
    translateY: -45,
    scale: 125,
    opacity: 45,
    rotation: 15,
    flipHorizontal: true,
    flipVertical: true,
    reverse: true
  });
  state = retimeAssemblyClip(state, videoClip.id, 200, false);
  const resolved = [
    { id: "video", filePath: "C:/media/v.mp4", hasAudio: true },
    { id: "audio", filePath: "C:/media/a.wav", hasAudio: true },
    { id: "still", filePath: "C:/media/i.png", hasAudio: false }
  ];
  const plan = createAssemblyRenderPlan(state, resolved);
  assert.equal(plan.inputs.length, 3);
  assert.equal(plan.visualClips.length, 2);
  assert.equal(plan.audioClips.length, 2);
  const args = buildAssemblyFfmpegArgs(plan, "C:/out/render.mp4");
  const filter = args[args.indexOf("-filter_complex") + 1];
  assert.match(filter, /overlay=/);
  assert.match(filter, /amix=inputs=2/);
  assert.match(filter, /reverse/);
  assert.match(filter, /areverse/);
  assert.match(filter, /atempo=2/);
  assert.match(filter, /hflip/);
  assert.match(filter, /vflip/);
  assert.match(filter, /colorchannelmixer=aa=0\.45/);
  assert.match(filter, /rotate=/);
  assert.match(filter, /overlay=x=\(W-w\)\/2\+120:y=\(H-h\)\/2-45/);
  assert.equal(args.at(-1), "C:/out/render.mp4");
});
