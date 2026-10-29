import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";
import { createVideoOutpaintService } from "../server/video-outpaint.js";
const execute = promisify(execFile);

test("real FFmpeg outpainting prep and restoration preserve the source center, generated border, timing and audio", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-outpaint-media-"));
  // Shared Intel macOS runners can take over 30 seconds for the ProRes master.
  const run = args => execute(ffmpeg, args, { windowsHide: true, timeout: 120000 });
  let reviewReplies = [], reviewCount = 0;
  const probe = async file => {
    const { stdout } = await execute(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { windowsHide: true, timeout: 10000 });
    const data = JSON.parse(stdout), video = data.streams.find(s => s.codec_type === "video");
    return { codec: video.codec_name, profile: video.profile, pixelFormat: video.pix_fmt, width: video.width, height: video.height, duration: Number(video.duration || data.format.duration), fps: 24, frames: Number(video.nb_frames), audio: data.streams.some(s => s.codec_type === "audio"), audioDuration: Number(data.streams.find(s => s.codec_type === "audio")?.duration || 0) };
  };
  try {
    const source = path.join(directory, "source.mp4"), generated = path.join(directory, "generated.mp4");
    await run(["-y", "-f", "lavfi", "-i", "color=red:s=64x64:r=24", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "3.5", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", source]);
    await run(["-y", "-f", "lavfi", "-i", "color=blue:s=432x768:r=24", "-frames:v", "81", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", generated]);
    const service = createVideoOutpaintService({ resolveAsset: async filePath => ({ filePath }), probeVideo: probe,
      createTarget: async (body, kind, ext) => ({ filePath: path.join(directory, kind + ext), publicPath: path.join(directory, kind + ext), fileName: kind + ext }),
      runFfmpeg: run, statFile: stat, reviewVisual: async () => { reviewCount++; return reviewReplies.shift() || { status: "passed_checks", summary: "Mocked review", issues: [] }; } });
    const prepared = await service.prepare({ videoOutpaint: { outputSize: "720p", feather: 32 } }, source);
    const padded = await probe(prepared.videoUrl), mask = await probe(prepared.maskVideoUrl);
    assert.equal(padded.frames, 81); assert.equal(mask.frames, 81); assert.equal(padded.duration, mask.duration);
    const output = await service.finish({}, prepared, { filePath: generated });
    const final = await probe(output.filePath);
    assert.deepEqual([final.width, final.height, final.frames], [720, 1280, 81]); assert.equal(final.audio, true);
    assert.equal(final.codec, "h264"); assert.equal(final.pixelFormat, "yuv420p");
    const pixel = async (x, y, file = output.filePath) => {
      const { stdout } = await execute(ffmpeg, ["-v", "error", "-ss", "1", "-i", file, "-vf", `crop=2:2:${x}:${y},format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, timeout: 10000, encoding: "buffer" });
      return [...stdout.subarray(0, 3)];
    };
    const center = await pixel(360, 640), border = await pixel(360, 10);
    const conditionedBorder = await pixel(360, 10, prepared.generationVideoUrl);
    const conditionedCore = await pixel(360, 640, prepared.generationVideoUrl);
    assert.ok(conditionedBorder.every(v => Math.abs(v - 127) <= 3), `VACE missing area must be neutral gray: ${conditionedBorder}`);
    assert.ok(conditionedCore[0] > 200 && conditionedCore[2] < 20, "VACE must retain original source core");
    assert.equal((await probe(prepared.generationVideoUrl)).frames, mask.frames);
    assert.ok((await pixel(360, prepared.plan.top + 10, prepared.generationVideoUrl)).every(v => Math.abs(v - 127) <= 3), "Inward overlap must also be neutral gray");
    assert.ok((await pixel(360, prepared.plan.top + 10, prepared.maskVideoUrl)).every(v => v > 240), "Inward overlap must be inside the generation mask");
    assert.ok(center[0] > 200 && center[2] < 20, `Original red source was not restored: ${center}`);
    assert.ok(border[2] > 200 && border[0] < 20, `Generated blue border was not retained: ${border}`);
    const split = path.join(directory, "split.mp4");
    await run(["-y", "-f", "lavfi", "-i", "color=red:s=64x64:r=24", "-vf", "drawbox=x=32:y=0:w=32:h=64:color=lime:t=fill", "-t", "3.5", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", split]);
    const offset = await service.prepare({ videoOutpaint: { aspectRatio: "1:1", frame: { x: 0.5, y: -0.25, width: 1 }, outputSize: "720p", feather: 0 } }, split);
    assert.deepEqual(offset.plan.sourceCrop, { x: 32, y: 0, width: 32, height: 48 });
    const maskInside = await pixel(100, 300, offset.maskVideoUrl), maskOutside = await pixel(500, 300, offset.maskVideoUrl);
    assert.ok(maskInside.every(value => value < 10)); assert.ok(maskOutside.every(value => value > 240));
    const offsetOutput = await service.finish({}, offset, { filePath: generated });
    const retained = await pixel(100, 400, offsetOutput.filePath), right = await pixel(600, 400, offsetOutput.filePath), top = await pixel(100, 10, offsetOutput.filePath);
    assert.ok(retained[1] > 200 && retained[0] < 20, `Offset source crop was not restored: ${retained}`);
    assert.ok(right[2] > 200 && top[2] > 200, "Generated right/top areas were overwritten by cropped-out source footage.");
    const outward = { ...offset, plan: { ...offset.plan, settings: { ...offset.plan.settings, feather: 32, autoMatch: false, finalQc: true } } };
    const outwardOutput = await service.finish({}, outward, { filePath: generated });
    const protectedEdge = await pixel(300, 400, outwardOutput.filePath), blendOutside = await pixel(370, 400, outwardOutput.filePath);
    assert.ok(protectedEdge[1] > 200 && protectedEdge[2] < 30, `Feather modified the protected source core: ${protectedEdge}`);
    assert.ok(blendOutside[2] > 200 && blendOutside[1] < 20, `Generated background must stay unchanged: ${blendOutside}`);
    assert.equal(outwardOutput.qc.status, "off");
    // The source ring fades inward; no correction, streak or black band can
    // enter generated background outside either original boundary.
    const geometry = offset.plan;
    const left = Math.round(geometry.left / geometry.width * geometry.outputWidth);
    const edgeY = Math.round(geometry.top / geometry.height * geometry.outputHeight);
    const sourceEdge = await pixel(left + 100, edgeY, outwardOutput.filePath);
    const halfOverlap = await pixel(left + 100, edgeY + 16, outwardOutput.filePath);
    const originalCore = await pixel(left + 100, edgeY + 40, outwardOutput.filePath);
    assert.ok(sourceEdge[2] > 200 && sourceEdge[1] < 20, `Outer edge must meet untouched fill: ${sourceEdge}`);
    assert.ok(halfOverlap[1] > 40 && halfOverlap[2] > 40, `Inward ring must blend plate with fill: ${halfOverlap}`);
    assert.ok(originalCore[1] > 200 && originalCore[2] < 20, `Core must stay fully opaque: ${originalCore}`);
    const short = path.join(directory, "short.mp4");
    await run(["-y", "-f", "lavfi", "-i", "color=red:s=64x64:r=24", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-vf", "drawbox=x=0:y=0:w=iw:h=ih:color=lime:t=fill:enable='gte(n,20)'", "-t", String(40 / 24), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", short]);
    const looped = await service.prepare({ videoOutpaint: { outputSize: "720p", feather: 0 } }, short);
    assert.equal(looped.plan.looped, true); assert.equal(looped.plan.loopFrames, 40);
    assert.equal((await probe(looped.videoUrl)).frames, 81);
    assert.equal((await probe(looped.maskVideoUrl)).frames, 81);
    const loopedOutput = await service.finish({}, looped, { filePath: generated });
    const loopedInfo = await probe(loopedOutput.filePath);
    assert.equal(loopedInfo.frames, 81); assert.equal(loopedInfo.duration, 3.375);
    assert.ok(loopedInfo.audioDuration > 3.3, "Audio did not repeat through the extended output.");
    for (const [time, channel] of [[0.25, 0], [1.1, 1], [1.92, 0], [2.8, 1], [3.333, 0]]) {
      const { stdout } = await execute(ffmpeg, ["-v", "error", "-ss", String(time), "-i", loopedOutput.filePath, "-vf", "crop=2:2:360:640,format=rgb24", "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, timeout: 10000, encoding: "buffer" });
      assert.ok(stdout[channel] > 200, `Repeated source changed speed or stopped at ${time} seconds: ${[...stdout.subarray(0, 3)]}`);
    }
    // A nonzero start repeats only the remaining segment, and silent clips stay valid.
    const silentLoop = await service.prepare({ videoOutpaint: { start: 2.5 } }, split);
    assert.equal(silentLoop.plan.looped, true); assert.equal(silentLoop.plan.loopFrames, 24);
    const silentInfo = await probe(silentLoop.loopedSourceUrl);
    assert.equal(silentInfo.frames, 81); assert.equal(silentInfo.audio, false);
    const seedanceGenerated = path.join(directory, "seedance-generated.mp4");
    await run(["-y", "-f", "lavfi", "-i", "color=blue:s=432x768:r=24", "-vf", "drawbox=x=0:y=0:w=iw:h=ih:color=lime:t=fill:enable='lt(n,24)'", "-frames:v", "93", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", seedanceGenerated]);
    const seedancePrepared = await service.prepare({ videoOutpaint: { model: "seedance-2.5", outputSize: "720p", feather: 0 } }, short);
    assert.equal(seedancePrepared.plan.frames, 97); assert.equal((await probe(seedancePrepared.videoUrl)).frames, 97);
    assert.equal(seedancePrepared.plan.prerollFrames, 0);
    assert.equal(seedancePrepared.plan.generationPaddingColor, "green");
    assert.equal((await probe(seedancePrepared.generationVideoUrl)).frames, 97);
    const greenPadding = await pixel(360, 10, seedancePrepared.generationVideoUrl);
    assert.ok(greenPadding[0] <= 8 && greenPadding[1] >= 247 && greenPadding[2] <= 8, `Seedance submitted padding must be RGB 0, 255, 0, including zero-feather preparations: ${greenPadding}`);
    assert.ok((await pixel(360, 10, seedancePrepared.videoUrl)).every(v => v < 10), "Original padded source stays available for comparison");
    const seedanceOutput = await service.finish({}, seedancePrepared, { filePath: seedanceGenerated });
    const seedanceInfo = await probe(seedanceOutput.filePath);
    assert.equal(seedanceInfo.frames, 40); assert.ok(Math.abs(seedanceInfo.duration - 40 / 24) < 0.001);
    assert.ok(seedanceInfo.audioDuration > 1.6 && seedanceInfo.audioDuration < 1.75);
    assert.equal(seedanceOutput.qc.status, "off");
    assert.equal(seedanceOutput.matching.motionValidation.status, "needs_review", "Different generated source colors must not count as motion-verified");
    assert.match(seedanceOutput.fileName, /outpaint-motion-candidate/, "Rejected candidates must not target the accepted export");
    const deliveredBorder = await pixel(360, 10, seedanceOutput.filePath);
    assert.ok(deliveredBorder[2] > 200 && deliveredBorder[1] < 20, "Delivery no longer uses the original source clock.");
    assert.equal(seedancePrepared.plan.looped, false); assert.equal(seedancePrepared.plan.tailPadded, true);
    assert.equal(seedancePrepared.maskVideoUrl, undefined);
    assert.equal((await probe(seedancePrepared.maskImageUrl)).codec, "png");
    const unfilled = await service.finish({}, seedancePrepared, { filePath: seedancePrepared.videoUrl });
    assert.equal(unfilled.matching.motionValidation.flaggedFrames, 0, "Identical source frames must pass correspondence");
    assert.equal(unfilled.matching.motionValidation.coverage.missingFillFrames, 40);
    assert.equal(unfilled.matching.motionValidation.status, "needs_review", "Preserving black padding must not pass merely because source motion matches");
    const greenUnfilled = await service.finish({}, seedancePrepared, { filePath: seedancePrepared.generationVideoUrl });
    assert.equal(greenUnfilled.matching.motionValidation.flaggedFrames, 0);
    assert.equal(greenUnfilled.matching.motionValidation.coverage.missingFillFrames, 40);
    assert.equal(greenUnfilled.matching.motionValidation.status, "needs_review", "Preserving the new green padding must not pass the output gate");
    const { stdout: heldPixel } = await execute(ffmpeg, ["-v", "error", "-ss", "3", "-i", seedancePrepared.videoUrl, "-vf", `crop=2:2:${seedancePrepared.plan.width / 2}:${seedancePrepared.plan.height / 2},format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, timeout: 10000, encoding: "buffer" });
    assert.ok(heldPixel[1] > 200 && heldPixel[0] < 20, "Model submission repeats the shot instead of holding its last frame.");
    const repeated = await service.prepare({ videoOutpaint: { model: "seedance-2.5", seedanceResolution: "480p", repeatCount: 2, keepAllRepeats: false, feather: 0 } }, short);
    assert.equal(repeated.plan.prerollFrames, 40);
    assert.equal((await probe(repeated.generationVideoUrl)).frames, repeated.plan.frames);
    for (const [frame, channel] of [[0, 0], [19, 0], [20, 1], [39, 1], [40, 0], [59, 0], [60, 1], [79, 1], [96, 1]]) {
      const { stdout } = await execute(ffmpeg, ["-v", "error", "-i", repeated.generationVideoUrl, "-vf", `select=eq(n\\,${frame}),crop=2:2:240:426,format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, timeout: 10000, encoding: "buffer" });
      assert.ok(stdout[channel] > 200, `Repeated canvas changed source motion at frame ${frame}: ${[...stdout.subarray(0, 3)]}`);
    }
    const repeatedOutput = await service.finish({}, repeated, { filePath: seedanceGenerated });
    const repeatedInfo = await probe(repeatedOutput.filePath);
    assert.equal(repeatedInfo.frames, 40);
    assert.ok(repeatedInfo.audioDuration > 1.6 && repeatedInfo.audioDuration < 1.75);
    const firstPixel = async (x, y, file) => {
      const { stdout } = await execute(ffmpeg, ["-v", "error", "-i", file, "-vf", `crop=2:2:${x}:${y},format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, timeout: 10000, encoding: "buffer" });
      return [...stdout.subarray(0, 3)];
    };
    assert.ok((await firstPixel(240, 10, repeatedOutput.filePath))[2] > 200, "Delivery must begin in copy two's blue fill, skipping copy one's green reveal");
    assert.ok((await firstPixel(240, 426, repeatedOutput.filePath))[0] > 200, "Source restoration must restart at the original shot's first red frame");
    const unrestored = { ...repeated, plan: { ...repeated.plan, settings: { ...repeated.plan.settings, restoreSource: false } } };
    const unrestoredOutput = await service.finish({}, unrestored, { filePath: seedanceGenerated });
    assert.ok((await firstPixel(240, 10, unrestoredOutput.filePath))[2] > 200, "Final-copy trimming must also work without restoration");
    const debug = { ...repeated, plan: { ...repeated.plan, settings: { ...repeated.plan.settings, keepAllRepeats: true } } };
    const fullGenerated = path.join(directory, "full-generated.mp4");
    await run(["-y", "-i", seedanceGenerated, "-vf", "tpad=stop_mode=clone:stop_duration=1", "-frames:v", String(debug.plan.frames), "-c:v", "libx264", "-pix_fmt", "yuv420p", fullGenerated]);
    const debugOutput = await service.finish({}, debug, { filePath: fullGenerated });
    const debugInfo = await probe(debugOutput.filePath);
    assert.equal(debugInfo.frames, debug.plan.frames);
    assert.ok(Math.abs(debugInfo.audioDuration - debug.plan.duration) < 0.01);
    assert.equal(debugOutput.matching.repeatOutput, "all");
    assert.equal(debugOutput.matching.motionValidation.framesChecked, debug.plan.frames);
    assert.ok((await firstPixel(240, 10, debugOutput.filePath))[1] > 200, "Debug must preserve the first pass's green reveal rather than seek to pass two");
    for (const [frame, channel] of [[0, 0], [20, 1], [40, 0], [60, 1], [79, 1], [96, 1]]) {
      const { stdout } = await execute(ffmpeg, ["-v", "error", "-i", debugOutput.filePath, "-vf", `select=eq(n\\,${frame}),crop=2:2:240:426,format=rgb24`, "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { windowsHide: true, timeout: 10000, encoding: "buffer" });
      assert.ok(stdout[channel] > 200, `Debug restoration must repeat the original source at frame ${frame}: ${[...stdout.subarray(0, 3)]}`);
    }
    const debugUnrestored = { ...debug, plan: { ...debug.plan, settings: { ...debug.plan.settings, restoreSource: false } } };
    const debugUnrestoredOutput = await service.finish({}, debugUnrestored, { filePath: fullGenerated });
    assert.equal((await probe(debugUnrestoredOutput.filePath)).frames, debug.plan.frames);
    assert.ok((await firstPixel(240, 10, debugUnrestoredOutput.filePath))[1] > 200);
    const debugSilent = await service.prepare({ videoOutpaint: { model: "seedance-2.5", seedanceResolution: "480p", start: 2.5, repeatCount: 2, feather: 0 } }, split);
    const debugSilentOutput = await service.finish({}, debugSilent, { filePath: fullGenerated });
    const debugSilentInfo = await probe(debugSilentOutput.filePath);
    assert.equal(debugSilentInfo.frames, debugSilent.plan.frames);
    assert.equal(debugSilentInfo.audio, false, "Debug repeats with a nonzero start must support silent source clips");
    const insufficient = { ...seedancePrepared, plan: { ...seedancePrepared.plan, outputFrames: 96, outputDuration: 4 } };
    await assert.rejects(service.finish({}, insufficient, { filePath: seedanceGenerated }), /does not cover/);
    const graySource = path.join(directory, "gray-source.mp4"), grayGenerated = path.join(directory, "gray-generated.mp4");
    await run(["-y", "-f", "lavfi", "-i", "color=c=0x808080:s=64x64:r=24", "-t", "3.5", "-c:v", "libx264", "-pix_fmt", "yuv420p", graySource]);
    await run(["-y", "-f", "lavfi", "-i", "color=c=0x606060:s=432x768:r=24", "-frames:v", "81", "-c:v", "libx264", "-pix_fmt", "yuv420p", grayGenerated]);
    const grayPrepared = await service.prepare({ videoOutpaint: { outputSize: "720p", feather: 32 } }, graySource);
    const matched = await service.finish({}, grayPrepared, { filePath: grayGenerated });
    assert.equal(matched.matching.applied, false); assert.equal(matched.qc.status, "off");
    const untouchedFill = await pixel(360, 10, matched.filePath), protectedCore = await pixel(360, 640, matched.filePath);
    assert.ok(untouchedFill[0] < 105 && protectedCore[0] > 120, "Keep generated background and original core unchanged");
    assert.equal(reviewCount, 0, "QC must never submit paid review");
    assert.match(matched.filePath, /video-outpaint\.mp4$/);
  } finally {
    const relative = path.relative(os.tmpdir(), directory);
    if (!relative.startsWith("newt-outpaint-media-") || relative.includes(path.sep)) throw new Error("Refusing cleanup outside owned test directory.");
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
