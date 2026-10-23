import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };
const round = value => Math.round(value * 1000) / 1000;

// Paired pixels are known ground truth INSIDE the regenerated overlap, not
// neighboring rows of potentially different surfaces outside the picture.
// One bounded offset per side for the whole shot avoids per-frame grade pumping.
export function fitExtensionColor(reference, generated, geometry) {
  const { width, height, x, y, sw, sh, overlap } = geometry;
  const stride = width * height * 3;
  const frames = Math.min(Math.floor(reference.length / stride), Math.floor(generated.length / stride));
  const sides = [x > 0 && "left", y > 0 && "top", x + sw < width && "right", y + sh < height && "bottom"].filter(Boolean);
  const edges = {};
  for (const side of sides) {
    const samples = [[], [], []];
    for (let f = 0; f < frames; f++) for (let py = y + 1; py < y + sh - 1; py++) for (let px = x + 1; px < x + sw - 1; px++) {
      const distance = side === "left" ? px - x : side === "right" ? x + sw - 1 - px : side === "top" ? py - y : y + sh - 1 - py;
      if (distance < 1 || distance > overlap - 1) continue;
      const i = f * stride + (py * width + px) * 3;
      const a = reference.subarray(i, i + 3), b = generated.subarray(i, i + 3);
      if ([...a, ...b].some(v => v < 8 || v > 247)) continue;
      for (let c = 0; c < 3; c++) samples[c].push(a[c] - b[c]);
    }
    const offsets = samples.map(median);
    const deviations = samples.map((values, c) => median(values.map(v => Math.abs(v - offsets[c]))));
    const support = samples.map((values, c) => values.filter(v => Math.abs(v - offsets[c]) <= 8).length / Math.max(1, values.length));
    const reliable = samples[0].length >= 64 && offsets.every(v => Math.abs(v) <= 16) && deviations.every(v => v <= 4) && support.every(v => v >= 0.75);
    edges[side] = { applied: reliable && offsets.some(v => Math.abs(v) >= 0.5), offsets: reliable ? offsets : [0, 0, 0], samples: samples[0].length, deviation: deviations, reason: reliable ? "Bounded paired-overlap offset, constant through the shot" : "Insufficient or inconsistent corresponding surface evidence; correction withheld" };
  }
  return { requested: true, applied: Object.values(edges).some(edge => edge.applied), edges, framesSampled: frames, method: "Robust per-side RGB offsets; no contrast fit, per-frame grading or edge-row extrusion" };
}

export function extensionColorFilter(report, { w, h, sw, sh, x, y }) {
  if (!report.applied) return "null";
  const distance = { left: `abs(X-${x})`, right: `abs(X-${x + sw - 1})`, top: `abs(Y-${y})`, bottom: `abs(Y-${y + sh - 1})` };
  // Include uncorrected sides at zero to blend gently at corners, rather than
  // extending a bottom grade abruptly into a differently lit upper expansion.
  const sides = Object.keys(report.edges);
  const weights = sides.map(side => `1/(1+pow((${distance[side]})/${Math.max(32, Math.min(w, h) / 4)},2))`);
  const denominator = weights.map(weight => `(${weight})`).join("+");
  return "format=gbrp10le,geq=" + ["r", "g", "b"].map((channel, c) => {
    const numerator = sides.map((side, i) => `(${round(report.edges[side].offsets[c])}*(${weights[i]}))`).join("+");
    return `${channel}='clip(${channel}(X,Y)+(1023/255)*(${numerator})/(${denominator}),0,1023)'`;
  }).join(":");
}

export async function inspectExtensionColor({ referencePath, generatedPath, plan, offset = 0, runFfmpeg }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-outpaint-color-"));
  try {
    const scale = 384 / Math.max(plan.width, plan.height);
    const width = Math.round(plan.width * scale), height = Math.round(plan.height * scale);
    const geometry = { width, height, x: Math.round(plan.left * scale), y: Math.round(plan.top * scale), sw: Math.round(plan.sourceWidth * scale), sh: Math.round(plan.sourceHeight * scale), overlap: Math.floor(plan.settings.feather * plan.width / plan.outputWidth * scale) };
    if (geometry.overlap < 3) return { requested: true, applied: false, reason: "Blend width is too narrow for reliable color sampling", edges: {} };
    const count = plan.outputFrames || plan.frames;
    const step = Math.max(1, Math.ceil(count / 32));
    for (const [name, file, lag] of [["source", referencePath, 0], ["generated", generatedPath, offset]]) {
      const start = (plan.prerollFrames || 0) + lag;
      await runFfmpeg(["-y", "-i", file, "-vf", `fps=${plan.fps},trim=start_frame=${start}:end_frame=${start + count},select='not(mod(n,${step}))',scale=${width}:${height},format=rgb24`, "-frames:v", "32", "-an", "-f", "rawvideo", path.join(directory, name)], "Measure stable outpaint extension color", 120000);
    }
    const reference = await readFile(path.join(directory, "source")), generated = await readFile(path.join(directory, "generated"));
    if (reference.length !== generated.length) return { requested: true, applied: false, reason: "Color samples do not cover corresponding frames", edges: {} };
    return fitExtensionColor(reference, generated, geometry);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
