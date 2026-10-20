import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import { createAssemblyFramePlan, buildAssemblyFfmpegArgs } from "../server/assembly-render.js";

function timeline(url) {
  return { outputWidth: 80, outputHeight: 40, frameRate: 24, inPoint: 0, outPoint: 0.1,
    media: [{ id: "source", url, type: "video", duration: 2 }],
    tracks: [{ id: "v1", type: "video", clips: [{ id: "clip", mediaId: "source", start: 0, duration: 2, sourceIn: 0, sourceDuration: 2 }] }] };
}

test("extracts the requested source frame at composition size, independently of range markers", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "newt-extract-frame-"));
  try {
    const source = path.join(dir, "source.mp4");
    execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=red:s=64x32:r=24:d=1", "-f", "lavfi", "-i", "color=blue:s=64x32:r=24:d=1", "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", source], { windowsHide: true });
    const state = timeline(source);
    const resolved = [{ id: "source", filePath: source, duration: 2, fps: 24 }];
    async function pixelAt(time, stateOverride = state) {
      const output = path.join(dir, `frame-${time}-${stateOverride.tracks[0].clips[0]?.reverse || false}.png`);
      const plan = createAssemblyFramePlan(stateOverride, resolved, time);
      execFileSync(ffmpeg, buildAssemblyFfmpegArgs(plan, output, { stillFrame: true }), { windowsHide: true });
      const metadata = await sharp(output).metadata();
      assert.equal(metadata.width, 80);
      assert.equal(metadata.height, 40);
      return [...await sharp(output).extract({ left: 40, top: 20, width: 1, height: 1 }).removeAlpha().raw().toBuffer()];
    }
    const red = await pixelAt(0.25);
    const blue = await pixelAt(1.25);
    assert.ok(red[0] > 200 && red[2] < 30, `Expected red: ${red}`);
    assert.ok(blue[2] > 200 && blue[0] < 30, `Expected blue: ${blue}`);
    state.tracks[0].clips[0].reverse = true;
    const reversed = await pixelAt(0.25);
    assert.ok(reversed[2] > 200 && reversed[0] < 30, `Expected reversed blue: ${reversed}`);
    const blank = await pixelAt(3);
    assert.ok(blank.every(channel => channel < 5));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("snapshot keeps active layer order and transforms while applying slip, speed and hidden tracks", () => {
  const state = timeline("source.mp4");
  state.tracks[0].clips[0] = { ...state.tracks[0].clips[0], start: 2, duration: 2, sourceIn: 0.5, speed: 200, translateX: 12, opacity: 45, rotation: 15 };
  state.tracks.push({ id: "hidden", type: "video", hidden: true, clips: [{ id: "hiddenClip", mediaId: "source", start: 0, duration: 5 }] });
  const plan = createAssemblyFramePlan(state, [{ id: "source", filePath: "source.mp4", duration: 10 }], 2.5);
  assert.equal(plan.visualClips.length, 1);
  assert.equal(plan.visualClips[0].clip.sourceIn, 1.5);
  assert.equal(plan.visualClips[0].clip.translateX, 12);
  assert.equal(plan.visualClips[0].clip.opacity, 45);
  assert.equal(plan.visualClips[0].clip.rotation, 15);
  assert.equal(plan.audioClips.length, 0);
  for (const invalid of [-1, NaN, Infinity, "1"]) assert.throws(() => createAssemblyFramePlan(state, [], invalid), /frame time/);
});
