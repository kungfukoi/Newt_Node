import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };
const round = value => Math.round(value * 1000) / 1000;
function fitSamples(samples) {
  const offsets = samples.map(median);
  const deviation = samples.map((values, c) => median(values.map(v => Math.abs(v - offsets[c]))));
  const support = samples.map((values, c) => values.filter(v => Math.abs(v - offsets[c]) <= 8).length / Math.max(1, values.length));
  const reliable = samples[0].length >= 64 && offsets.every(v => Math.abs(v) <= 16) && deviation.every(v => v <= 4) && support.every(v => v >= 0.75);
  return { reliable, offsets: reliable ? offsets : [0, 0, 0], samples: samples[0].length, deviation };
}

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
    const horizontal = side === "top" || side === "bottom";
    const bins = Array.from({ length: Math.max(1, Math.min(8, Math.floor((horizontal ? sw : sh) / 24))) }, () => [[], [], []]);
    const boundaryBins = bins.map(() => [[], [], []]);
    for (let f = 0; f < frames; f++) for (let py = y + 1; py < y + sh - 1; py++) for (let px = x + 1; px < x + sw - 1; px++) {
      const distance = side === "left" ? px - x : side === "right" ? x + sw - 1 - px : side === "top" ? py - y : y + sh - 1 - py;
      if (distance < 1 || distance > overlap - 1) continue;
      const i = f * stride + (py * width + px) * 3;
      const a = reference.subarray(i, i + 3), b = generated.subarray(i, i + 3);
      if ([...a, ...b].some(v => v < 8 || v > 247)) continue;
      const position = horizontal ? (px - x) / (sw - 1) : (py - y) / (sh - 1);
      const bin = Math.min(bins.length - 1, Math.floor(position * bins.length));
      for (let c = 0; c < 3; c++) { samples[c].push(a[c] - b[c]); bins[bin][c].push(a[c] - b[c]); }
      if (distance !== 1) continue;
      const outerX = px + (side === "left" ? -3 : side === "right" ? 3 : 0);
      const outerY = py + (side === "top" ? -3 : side === "bottom" ? 3 : 0);
      if (outerX < 0 || outerX >= width || outerY < 0 || outerY >= height) continue;
      const outerIndex = f * stride + (outerY * width + outerX) * 3;
      const outer = generated.subarray(outerIndex, outerIndex + 3);
      if (outer.length !== 3 || [...outer].some((value, c) => value < 8 || value > 247 || Math.abs(value - b[c]) > 8)) continue;
      for (let c = 0; c < 3; c++) boundaryBins[bin][c].push(a[c] - outer[c]);
    }
    const fit = fitSamples(samples);
    const local = bins.map((values, index) => {
      const overlapFit = fitSamples(values);
      const boundaryFit = fitSamples(boundaryBins[index]);
      // Prefer the color at the actual join when it agrees with the
      // corresponding overlap and both measurements have reliable support.
      const agrees = boundaryFit.offsets.every((value, c) => Math.abs(value - overlapFit.offsets[c]) <= 6);
      const fit = overlapFit.reliable && boundaryFit.reliable && agrees ? boundaryFit : overlapFit;
      return { position: (index + 0.5) / bins.length, ...fit };
    });
    // Retain only supported surface samples. A moving limb or a bad tile must
    // not turn into a per-frame grade or an abrupt strip of uncorrected color.
    const supported = local.filter(tile => tile.reliable);
    const spatial = bins.length >= 3 && supported.length >= Math.ceil(bins.length * 0.75) ? supported : [];
    edges[side] = { applied: (fit.reliable && fit.offsets.some(v => Math.abs(v) >= 0.5)) || spatial.some(tile => tile.offsets.some(v => Math.abs(v) >= 0.5)), offsets: fit.offsets, samples: fit.samples, deviation: fit.deviation, spatial,
      reason: spatial.length ? "Bounded corresponding surface offsets along the seam, constant through the shot" : fit.reliable ? "Bounded paired-overlap offset, constant through the shot" : "Insufficient or inconsistent corresponding surface evidence; correction withheld" };
  }
  return { requested: true, applied: Object.values(edges).some(edge => edge.applied), edges, framesSampled: frames, method: "Robust spatial RGB offsets along corresponding seam surfaces; constant in time, no contrast fit or edge-row extrusion" };
}

function seamOffset(edge, channel, coordinate, start, length) {
  const tiles = edge.spatial || [];
  if (!tiles.length) return String(round(edge.offsets[channel]));
  let expression = String(round(tiles.at(-1).offsets[channel]));
  for (let i = tiles.length - 2; i >= 0; i--) {
    const a = tiles[i], b = tiles[i + 1];
    const position = `clip((${coordinate}-${round(start + a.position * (length - 1))})/${round((b.position - a.position) * (length - 1))},0,1)`;
    const interpolated = `${round(a.offsets[channel])}+(${round(b.offsets[channel] - a.offsets[channel])})*${position}`;
    expression = `if(lt(${coordinate},${round(start + b.position * (length - 1))}),${interpolated},${expression})`;
  }
  return expression;
}

export function extensionColorFilter(report, { w, h, sw, sh, x, y }) {
  if (!report.applied) return "null";
  const distance = { left: `abs(X-${x})`, right: `abs(X-${x + sw - 1})`, top: `abs(Y-${y})`, bottom: `abs(Y-${y + sh - 1})` };
  // Include uncorrected sides at zero to blend gently at corners, rather than
  // extending a bottom grade abruptly into a differently lit upper expansion.
  const sides = Object.keys(report.edges);
  // At the join, that seam's fit must dominate the opposite seam's lighting.
  const weights = sides.map(side => `1/(1+pow((${distance[side]})/32,2))`);
  const denominator = weights.map(weight => `(${weight})`).join("+");
  return "format=gbrp10le,geq=" + ["r", "g", "b"].map((channel, c) => {
    const numerator = sides.map((side, i) => `(( ${seamOffset(report.edges[side], c, side === "top" || side === "bottom" ? "X" : "Y", side === "top" || side === "bottom" ? x : y, side === "top" || side === "bottom" ? sw : sh)} )*(${weights[i]}))`).join("+");
    return `${channel}='clip(${channel}(X,Y)+(1023/255)*(${numerator})/(${denominator}),0,1023)'`;
  }).join(":");
}

// Measure a hard exposure step across the conditioning boundary on the plate
// itself. A grade applied equally on both sides cannot remove that step.
export function fitGeneratedColorJoin(generated, geometry, content) {
  const { width, height, x, y, sw, sh } = geometry;
  const stride = width * height * 3;
  const frames = Math.floor(generated.length / stride);
  const edges = {};
  for (const [side, horizontal, edge, direction, enabled] of [
    ["top", true, content.y, -1, y > 0],
    ["bottom", true, content.y + content.height - 1, 1, y + sh < height],
    ["left", false, content.x, -1, x > 0],
    ["right", false, content.x + content.width - 1, 1, x + sw < width]
  ]) {
    if (!enabled || edge < 2 || edge >= (horizontal ? height : width) - 2) continue;
    const samples = [[], [], []];
    const start = horizontal ? content.x : content.y;
    const length = horizontal ? content.width : content.height;
    for (let f = 0; f < frames; f++) for (let t = start + 2; t < start + length - 2; t++) {
      const pixel = n => f * stride + (horizontal ? n * width + t : t * width + n) * 3;
      const inner = pixel(edge), outer = pixel(edge + direction);
      const deeper = pixel(edge - direction), farther = pixel(edge + 2 * direction);
      for (let c = 0; c < 3; c++) {
        const a = generated[inner + c], b = generated[outer + c];
        const innerSlope = a - generated[deeper + c], outerSlope = generated[farther + c] - b;
        // Subtract the local gradient so a naturally sloped surface stays sloped.
        if (Math.abs(innerSlope) <= 8 && Math.abs(outerSlope) <= 8 && a > 7 && b > 7 && a < 248 && b < 248) {
          samples[c].push(a - b + (innerSlope + outerSlope) / 2);
        }
      }
    }
    const fit = fitSamples(samples);
    if (fit.reliable && fit.offsets.some(value => Math.abs(value) >= 1)) edges[side] = fit;
  }
  return edges;
}

export function generatedColorJoinFilter(edges, content, falloff) {
  const distances = {
    top: `${content.y}-Y`, bottom: `Y-${content.y + content.height - 1}`,
    left: `${content.x}-X`, right: `X-${content.x + content.width - 1}`
  };
  const sides = Object.keys(edges || {});
  if (!sides.length) return "null";
  const weights = sides.map(side => `gt(${distances[side]},0)*pow(clip(1-((${distances[side]})-1)/${falloff},0,1),2)`);
  return "format=gbrp10le,geq=" + ["r", "g", "b"].map((channel, c) => {
    const sum = sides.map((side, i) => `(${round(edges[side].offsets[c])})*(${weights[i]})`).join("+");
    return `${channel}='clip(${channel}(X,Y)+(1023/255)*(${sum})/max(1,${weights.join("+")}),0,1023)'`;
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
    const result = fitExtensionColor(reference, generated, geometry);
    const content = plan.generationContentRect || { x: plan.left, y: plan.top, width: plan.sourceWidth, height: plan.sourceHeight };
    const sampleContent = Object.fromEntries(Object.entries(content).map(([key, value]) => [key, Math.round(value * scale)]));
    return { ...result, generatedJoins: fitGeneratedColorJoin(generated, geometry, sampleContent) };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
