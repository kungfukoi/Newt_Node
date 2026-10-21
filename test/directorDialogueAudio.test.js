import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, copyFile, stat, rm, mkdtemp } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import ffmpeg from "ffmpeg-static";
import { saveGeneratedVideoWithFallback } from "../server/video-save-fallback.js";

const run = promisify(execFile);
const source = (await readFile(new URL("../server/index.js", import.meta.url), "utf8")).replace(/\r/g, "");
function extract(name, dependencies) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0);
  const tail = source.slice(start);
  const end = tail.search(/\n(?:async )?function /);
  return new Function(...Object.keys(dependencies), `${tail.slice(0, end)}; return ${name};`)(...Object.values(dependencies));
}

test("Seedance finalization after restart passes and returns the saved dialogue audio", async () => {
  const dialogue = { url: "/outputs/dialogue.mp3", cues: [{ endSeconds: 1.2 }] };
  let downloadedBody;
  const finalize = extract("finalizeSeedanceVideo", {
    path, saveGeneratedVideoWithFallback, existsSync: () => false, workflowPackageOutputDirName: "outputs", workflowPackageDependencyDirName: "dependencies",
    createManagedAssetTarget: async () => ({ filePath: "mock.mp4" }),
    downloadVideo: async request => { downloadedBody = request.body; return { filePath: "mock.mp4", publicPath: "/outputs/mock.mp4" }; },
    appendHistory: async () => {}, projectFromBody: () => ({}), nodeFromBody: () => ({}), routeKindLabel: value => value
  });
  const result = await finalize({ requestId: "request", remote: { video: { url: "https://provider.example/video.mp4" } }, spec: {
    body: { directorDialogueAudio: dialogue }, settings: { generateAudio: true }, provider: "fal", cost: {}, routeKind: "reference-to-video"
  } });
  assert.deepEqual(downloadedBody.directorDialogueAudio, dialogue);
  assert.deepEqual(result.directorDialogueAudio, dialogue);
  const specStart = source.indexOf("    function seedanceJobSpec(input)");
  const specEnd = source.indexOf("    async function acceptSeedanceJob", specStart);
  const specFunction = source.slice(specStart, specEnd);
  // Exercise the real persisted spec builder with its enclosing route bindings.
  const names = ["runtimeProvider", "selectedVideoModel", "endpoint", "providerKeyFingerprint", "workflowContextPayload", "req", "listGenerationProgress", "prompt", "submittedPrompt", "routeKind", "seedance25", "cost", "generationPricingScope", "pricingRefresh", "runtimeAspectRatio", "runtimeDurationSeconds", "referenceVideoDurationSeconds", "resolution", "duration", "aspectRatio", "generateAudio", "requestedSeed", "startFrameUrl", "endFrameUrl", "referenceImageUrls", "referenceImageNames", "referenceVideoUrls", "referenceVideoNames", "referenceAudioUrls"];
  const values = ["fal", { displayName: "Seedance 2.5" }, "endpoint", () => "fingerprint", () => ({}), { body: { directorDialogueAudio: dialogue } }, () => [], "prompt", "submitted", "reference-to-video", true, {}, { getStore: () => ({}) }, { snapshot: () => ({}) }, "16:9", 5, 0, "720p", "5s", "16:9", true, null, "", "", [], [], [], [], [dialogue.url]];
  const referencePreparation = [{ role: "images", originalWidth: 2752, originalHeight: 308, width: 2752, height: 1101, padded: true }];
  names.push("atlasReferencePreparation", "draftKey", "editing", "sourceDurationSeconds", "draftMode", "referenceVideoDurations"); values.push(referencePreparation, "", false, undefined, false, []);
  const spec = new Function(...names, `${specFunction}; return seedanceJobSpec({});`)(...values);
  assert.deepEqual(spec.body.directorDialogueAudio, dialogue);
  assert.deepEqual(spec.settings.atlasReferencePreparation, referencePreparation);
  values[names.indexOf("runtimeProvider")] = "atlas";
  values[names.indexOf("referenceVideoUrls")] = ["/outputs/a.mp4", "/outputs/b.mp4"];
  values[names.indexOf("referenceVideoDurations")] = [5, 8];
  values[names.indexOf("referenceVideoDurationSeconds")] = 13;
  const build = () => new Function(...names, `${specFunction}; return seedanceJobSpec({});`)(...values);
  assert.deepEqual(build().settings.referenceVideoDurations, [5, 8]);
  assert.equal(build().settings.referenceVideoDurationSeconds, 13);
  values[names.indexOf("referenceVideoDurations")] = [5, 0];
  assert.deepEqual(build().settings.referenceVideoDurations, [5, null]);
  assert.equal(build().settings.referenceVideoDurationSeconds, null);
});

test("finished video retains the supplied dialogue audio instead of the model's generated voice", async t => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "newt-dialogue-media-"));
  t.after(() => {
    if (path.dirname(path.resolve(scratch)) !== path.resolve(os.tmpdir()) || !path.basename(scratch).startsWith("newt-dialogue-media-")) throw new Error("Unexpected test cleanup target");
    return rm(scratch, { recursive: true, force: true });
  });
  const modelVideo = path.join(scratch, "model.mp4"), speech = path.join(scratch, "selected-voice.wav"), final = path.join(scratch, "final.mp4");
  await run(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=2", "-f", "lavfi", "-i", "sine=frequency=880:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", modelVideo], { windowsHide: true });
  await run(ffmpeg, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1.2", "-c:a", "pcm_s16le", speech], { windowsHide: true });
  const replace = extract("replaceVideoAudioTrack", { path, randomUUID, copyFile, stat, rm, runFfmpeg: args => run(ffmpeg, args, { windowsHide: true }) });
  const download = extract("downloadVideo", {
    path, updateCurrentGenerationProgress: () => {}, queueMediaPersistence: work => work(),
    fetch: async () => new Response(await readFile(modelVideo)), createManagedAssetTarget: async () => ({ filePath: final, fileName: "final.mp4", publicPath: "/outputs/final.mp4" }),
    workflowPackageOutputDirName: () => "outputs", writeFileWithRetry: writeFile,
    probeVideoFile: async () => ({ duration: 2 }), resolveLocalAssetPathFromUrl: async url => { assert.equal(url, "/outputs/selected-voice.wav"); return { filePath: speech }; },
    replaceVideoAudioTrack: replace
  });
  const output = await download({ body: { directorDialogueAudio: { url: "/outputs/selected-voice.wav", cues: [{ endSeconds: 1.2 }] } } }, "https://provider.example/model.mp4", "video");
  assert.equal(output.publicPath, "/outputs/final.mp4");
  const decoded = await run(ffmpeg, ["-i", final, "-vn", "-ar", "8000", "-ac", "1", "-f", "s16le", "pipe:1"], { windowsHide: true, encoding: "buffer", maxBuffer: 1024 * 1024 });
  let crossings = 0;
  for (let i = 1; i < 8000; i++) if ((decoded.stdout.readInt16LE((i - 1) * 2) >= 0) !== (decoded.stdout.readInt16LE(i * 2) >= 0)) crossings++;
  assert.ok(Math.abs(crossings / 2 - 440) < 15, `Expected selected 440 Hz speech source, got ${crossings / 2} Hz`);
});
