import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import { createOutpaintFramePresence, parseFramePresence } from "../server/outpaint-frame-presence.js";
const execute = promisify(execFile);

test("frame presence rejects missing, duplicate and unrequested observations", () => {
  for (const frames of [[], [{ frame: 0, observation: "absent" }, { frame: 0, observation: "present" }], [{ frame: 0, observation: "absent" }, { frame: 2, observation: "present" }]]) {
    assert.throws(() => parseFramePresence(JSON.stringify({ frames }), [0, 1]), /every requested frame|incomplete or duplicate/);
  }
  assert.deepEqual(parseFramePresence('```json\n{"frames":[{"frame":1,"observation":"present"},{"frame":0,"observation":"absent"}]}\n```', [0, 1]), [{ frame: 0, observation: "absent" }, { frame: 1, observation: "present" }]);
});

test("all delivery frames are represented once with exact timing and no later-frame leakage in sheets", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-outpaint-presence-"));
  const source = path.join(directory, "source.mp4");
  const run = args => execute(ffmpeg, args, { windowsHide: true, timeout: 30000 });
  try {
    await run(["-y", "-f", "lavfi", "-i", "color=red:s=64x96:r=24", "-vf", "drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=fill:enable='gte(n,30)'", "-frames:v", "80", "-c:v", "libx264", "-pix_fmt", "yuv420p", source]);
    const records = [], sheets = [], calls = [];
    const inspect = createOutpaintFramePresence({
      resolveAsset: async () => ({ filePath: source }),
      probeVideo: async () => ({ width: 64, height: 96, fps: 24, num_frames: 80 }),
      createTarget: async (_body, kind) => ({ filePath: path.join(directory, kind + ".png"), publicPath: path.join(directory, kind + ".png") }),
      runFfmpeg: run,
      recordAnalysis: async record => records.push(record),
      analyzeImages: async ({ inputs, prompt }) => {
        calls.push(prompt); sheets.push(...inputs.map(item => item.url));
        const ids = prompt.match(/frame IDs: ([\d, ]+)\./)[1].split(",").map(Number);
        return { text: JSON.stringify({ frames: ids.map(frame => ({ frame, observation: frame < 6 ? "Person absent; background only" : "Subject now visible at bottom" })) }) };
      }
    });
    const result = await inspect({ sourceVideoUrl: "/source.mp4", preparedPlan: { width: 64, height: 96, fps: 24, prerollFrames: 24, outputFrames: 27, left: 0, top: 0, sourceWidth: 64, sourceHeight: 96 } });
    assert.equal(result.frameCount, 27); assert.equal(records.length, 2); assert.equal(sheets.length, 3);
    assert.equal(result.text.split("\n").length, 27);
    assert.match(result.text, /Frame 0, @Video1 1.0000s: Person absent/);
    assert.match(result.text, /Frame 26, @Video1 2.0833s/);
    assert.doesNotMatch(result.text, /delivery \d/);
    assert.match(calls[0], /must never be painted into earlier frames/);
    const pixels = await sharp(sheets[0]).removeAlpha().raw().toBuffer();
    const pixel = (x, y) => [...pixels.subarray((y * 1920 + x) * 3, (y * 1920 + x) * 3 + 3)];
    assert.ok(pixel(240, 150)[0] > 200, "First delivery panel must remain red (no later blue subject)");
    assert.ok(pixel(2 * 480 + 240, 300 + 150)[2] > 200, "Frame six must show its actual later blue content");
    await inspect({ sourceVideoUrl: "/source.mp4", referenceImageUrls: ["/reference.png"], preparedPlan: { width: 64, height: 96, fps: 24, prerollFrames: 24, outputFrames: 27, left: 0, top: 0, sourceWidth: 64, sourceHeight: 96 } });
    assert.equal(records.at(-1).inputs.at(-1).url, "/reference.png");
    assert.match(records.at(-1).prompt, /still images, not numbered footage frames/);
    assert.match(records.at(-1).prompt, /keep the source lighting authoritative/);
    const wan = await inspect({ sourceVideoUrl: "/source.mp4", referenceImageUrls: ["/reference.png"], preparedPlan: { width: 64, height: 96, fps: 24, frames: 80, settings: { model: "wan-vace" }, left: 0, top: 0, sourceWidth: 64, sourceHeight: 96 } });
    assert.equal(wan.frameCount, 80); assert.equal(wan.prerollFrames, 0);
    assert.equal(records.at(-1).inputs.at(-1).url, "/reference.png");
    await assert.rejects(inspect({ sourceVideoUrl: "/source.mp4", preparedPlan: { width: 10 } }), /timing changed/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
