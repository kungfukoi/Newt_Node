import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { boundaryRegions, measureBoundary, boundaryReport } from "./outpaint-boundary.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = v => Math.round(v * 1000) / 1000;
const identity = () => [0, 1, 2].map(() => ({ gain: 1, offset: 0 }));

// Analysis is bounded to 192px and every frame, without loading production-resolution
// clips into memory. Geometry comes from the same quantized plan as the compositor.
export function matchingGeometry(plan) {
  const width = 192, height = Math.round(width * plan.height / plan.width);
  const x = Math.round(plan.left / plan.width * width), y = Math.round(plan.top / plan.height * height);
  const w = Math.round(plan.sourceWidth / plan.width * width), h = Math.round(plan.sourceHeight / plan.height * height);
  const points = [], boundary = [];
  for (let py = y + 2; py < y + h - 2; py += 2) for (let px = x + 2; px < x + w - 2; px += 2) {
    const edge = Math.min(x > 0 ? px - x : Infinity, y > 0 ? py - y : Infinity, x + w < width ? x + w - 1 - px : Infinity, y + h < height ? y + h - 1 - py : Infinity);
    if (edge <= 8) points.push((py * width + px) * 3);
  }
  if (y > 1) for (let px = x + 2; px < x + w - 2; px += 2) boundary.push([(y * width + px) * 3, -width * 3]);
  if (y + h < height - 1) for (let px = x + 2; px < x + w - 2; px += 2) boundary.push([((y + h - 1) * width + px) * 3, width * 3]);
  if (x > 1) for (let py = y + 2; py < y + h - 2; py += 2) boundary.push([(py * width + x) * 3, -3]);
  if (x + w < width - 1) for (let py = y + 2; py < y + h - 2; py += 2) boundary.push([(py * width + x + w - 1) * 3, 3]);
  return { width, height, points, boundary, source: { x, y, width: w, height: h }, stride: width * height * 3 };
}

export function fitOutpaintColor(reference, generated, geometry, frames) {
  const sums = identity().map(() => ({ n: 0, x: 0, y: 0, xx: 0, yy: 0, xy: 0 }));
  for (let f = 0; f < frames; f++) for (const p of geometry.points) for (let c = 0; c < 3; c++) {
    const i = f * geometry.stride + p + c, x = generated[i], y = reference[i], s = sums[c];
    if (x < 8 || x > 247 || y < 8 || y > 247) continue;
    s.n++; s.x += x; s.y += y; s.xx += x * x; s.yy += y * y; s.xy += x * y;
  }
  let reliable = true;
  const channels = sums.map(s => {
    if (!s.n) { reliable = false; return { gain: 1, offset: 0 }; }
    const vx = s.xx / s.n - (s.x / s.n) ** 2, vy = s.yy / s.n - (s.y / s.n) ** 2;
    const cov = s.xy / s.n - s.x * s.y / s.n ** 2;
    // Flat areas can constrain an offset, but cannot justify a contrast fit.
    if (vx > 25 && vy > 25 && cov / Math.sqrt(vx * vy) < 0.9) reliable = false;
    const slope = vx > 25 ? cov / vx : 1;
    // A fit pinned to a clamp is evidence of mismatched content, not a safe
    // reason to darken the entire extension. Local boundary matching can still run.
    if (slope < 0.9 || slope > 1.1) reliable = false;
    const gain = clamp(slope, 0.9, 1.1);
    const offset = s.y / s.n - gain * s.x / s.n;
    if (Math.abs(offset) > 32) reliable = false;
    return { gain: round(gain), offset: round(clamp(offset, -32, 32)) };
  });
  return { channels: reliable ? channels : identity(), applied: reliable, reason: reliable ? "Bounded RGB fit from the source overlap; constant over time to avoid correction flicker." : "Overlap differs too much for a safe color fit; correction was withheld." };
}

export function overlapError(reference, generated, g, frames, channels = identity(), lag = 0) {
  let sum = 0, n = 0;
  for (let f = Math.max(0, -lag); f < Math.min(frames, frames - lag); f++) for (const p of g.points) for (let c = 0; c < 3; c++) {
    sum += Math.abs(reference[f * g.stride + p + c] - clamp(generated[(f + lag) * g.stride + p + c] * channels[c].gain + channels[c].offset, 0, 255)); n++;
  }
  return n ? sum / n : 255;
}

export function inspectOutpaint(reference, generated, final, g, frames, plan, native, matching) {
  const channels = matching.channels, flags = [], segments = [];
  const before = overlapError(reference, generated, g, frames), after = overlapError(reference, generated, g, frames, channels);
  let bestLag = 0, best = after;
  for (let lag = -3; lag <= 3; lag++) {
    const error = overlapError(reference, generated, g, frames, channels, lag);
    if (error < best) { best = error; bestLag = lag; }
  }
  // Raw overlap color can differ after a successful spatial boundary repair.
  // Compare gradients as well, so a repaired color cast is not itself a failure.
  let structure = 0, structureSamples = 0;
  for (let f = 0; f < frames; f++) for (const p of g.points) for (let c = 0; c < 3; c++) for (const step of [3, g.width * 3]) {
    const i = f * g.stride + p + c;
    structure += Math.abs((reference[i] - reference[i + step]) - (generated[i] - generated[i + step]) * channels[c].gain); structureSamples++;
  }
  const structureError = structureSamples ? structure / structureSamples : 255;
  if (structureError > 10) flags.push("Generated overlap differs substantially from the original in structure.");
  if (bestLag && after - best > 1 && best < after * 0.85) flags.push(`Possible timing offset: generated overlap matches better ${bestLag} frame(s) away. No automatic retiming was applied.`);
  const missingFrames = Math.max(0, plan.frames - Math.round(Number(native.duration) * plan.fps));
  if (missingFrames > 1) { flags.push(`Generated extension is ${missingFrames} frames short; its tail is held while the source continues.`); segments.push({ start: round(Number(native.duration)), end: round(plan.duration), reason: "Held generated tail" }); }
  if (plan.looped) flags.push("Source repeats within the output; loop transitions require visual review.");
  let worstBoundary = 0;
  let frozen = false, inconsistent = false, flicker = false;
  let sourceError = 0, sourceSamples = 0;
  for (let f = 0; f < frames; f++) {
    let edge = 0, nearby = 0, n = 0, outerChange = 0, innerChange = 0;
    for (const [p, step] of g.boundary) for (let c = 0; c < 3; c++) {
      const i = f * g.stride + p + c;
      edge += Math.abs(final[i] - final[i + step]);
      nearby += (Math.abs(final[i - step] - final[i - step * 2]) + Math.abs(final[i + step] - final[i + step * 2])) / 2; n++;
      if (f) { outerChange += Math.abs(final[i + step * 2] - final[i + step * 2 - g.stride]); innerChange += Math.abs(reference[i - step * 2] - reference[i - step * 2 - g.stride]); }
    }
    const jump = n ? edge / n : 0, excess = n ? (edge - nearby) / n : 0;
    worstBoundary = Math.max(worstBoundary, jump);
    if (jump > 10 && excess > 6) segments.push({ start: round(f / plan.fps), end: round((f + 1) / plan.fps), reason: "Boundary discontinuity" });
    if (n && outerChange / n > 10 && innerChange / n < 1) { flicker = true; segments.push({ start: round(f / plan.fps), end: round((f + 1) / plan.fps), reason: "Possible extension flicker" }); }
    let referenceMotion = 0, generatedMotion = 0, residual = 0, samples = 0;
    for (const p of g.points) for (let c = 0; c < 3; c++) {
      const i = f * g.stride + p + c;
      residual += Math.abs(reference[i] - clamp(generated[i] * channels[c].gain + channels[c].offset, 0, 255)); samples++;
      if (f) { referenceMotion += Math.abs(reference[i] - reference[i - g.stride]); generatedMotion += Math.abs(generated[i] - generated[i - g.stride]); }
    }
    if (samples && residual / samples > 32) { inconsistent = true; segments.push({ start: round(f / plan.fps), end: round((f + 1) / plan.fps), reason: "Overlap mismatch" }); }
    if (samples && referenceMotion / samples > 2 && generatedMotion / samples < 0.2) { frozen = true; segments.push({ start: round(f / plan.fps), end: round((f + 1) / plan.fps), reason: "Generated overlap is frozen while the source moves" }); }
    const s = g.source, margin = Math.ceil((plan.settings?.feather || 0) / (plan.outputWidth || plan.width) * g.width) + 2;
    for (let py = s.y + margin; py < s.y + s.height - margin; py += 4) for (let px = s.x + margin; px < s.x + s.width - margin; px += 4) for (let c = 0; c < 3; c++) {
      const i = f * g.stride + (py * g.width + px) * 3 + c;
      sourceError += Math.abs(reference[i] - final[i]); sourceSamples++;
    }
  }
  if (segments.some(s => s.reason === "Boundary discontinuity")) flags.push("A boundary is sharper than adjacent image detail in one or more frames.");
  // Raw color differences are diagnostic, not a reason to reject a successfully
  // matched composite. The finished boundary is measured separately.
  if (frozen) flags.push("Generated overlap freezes while the source moves.");
  if (flicker) flags.push("The extension changes abruptly while nearby source detail stays still.");
  if (sourceSamples && sourceError / sourceSamples > 8) flags.push("Final source overlap differs from the prepared reference; inspect source restoration.");
  const merged = [];
  for (const segment of segments.sort((a, b) => a.start - b.start)) {
    const previous = [...merged].reverse().find(s => s.reason === segment.reason && segment.start <= s.end + 0.002);
    if (previous) previous.end = Math.max(previous.end, segment.end); else merged.push({ ...segment });
  }
  return { version: 1, status: flags.length ? "needs_review" : "passed_checks", scope: "Local numerical QC of every frame at 192px width. Anatomy, fine texture and semantic consistency require visual review; this is not a guarantee of seamlessness.", framesChecked: frames, analysisWidth: g.width, overlapErrorBefore: round(before), overlapErrorAfter: round(after), structureError: round(structureError), sourceReferenceError: round(sourceSamples ? sourceError / sourceSamples : 0), worstBoundaryJump: round(worstBoundary), suggestedOffsetFrames: after - best > 1 && best < after * 0.85 ? bestLag : 0, missingFrames, flags, segments: merged.slice(0, 100) };
}

export async function withOutpaintAnalysis({ prepared, generatedPath, runFfmpeg }, action) {
  const plan = prepared.plan, geometry = matchingGeometry(plan);
  const directory = await mkdtemp(path.join(tmpdir(), "newt-outpaint-qc-"));
  async function decode(filePath, name, pad = false, skipFrames = 0) {
    const target = path.join(directory, name + ".rgb");
    await runFfmpeg(["-y", "-i", filePath, "-vf", `fps=${plan.fps},${skipFrames ? `trim=start_frame=${skipFrames},setpts=PTS-STARTPTS,` : ""}${pad ? "tpad=stop_mode=clone:stop_duration=0.35," : ""}scale=${geometry.width}:${geometry.height},setsar=1`, "-frames:v", String(plan.frames), "-an", "-pix_fmt", "rgb24", "-f", "rawvideo", target], "Analyze outpainting " + name, 120000);
    const data = await readFile(target);
    if (data.length < geometry.stride * plan.frames) throw new Error("Analysis could not decode every expected frame.");
    return data;
  }
  async function boundaries(filePath, name) {
    const edges = {};
    for (const region of boundaryRegions(plan)) {
      const target = path.join(directory, `${name}-${region.name}.rgb`);
      await runFfmpeg(["-y", "-i", filePath, "-vf", `fps=${plan.fps},format=rgb24,${region.filter},setsar=1`, "-frames:v", String(plan.frames), "-an", "-pix_fmt", "rgb24", "-f", "rawvideo", target], "Inspect native outpaint boundary", 120000);
      const data = await readFile(target);
      if (data.length < region.stride * plan.frames) throw new Error("Boundary analysis missed expected frames.");
      edges[region.name] = measureBoundary(data, region, plan.frames);
    }
    return boundaryReport(edges);
  }
  try { return await action({ geometry, decode, boundaries, generated: await decode(generatedPath, "generated", true, plan.prerollFrames || 0) }); }
  finally {
    if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith("newt-outpaint-qc-")) throw new Error("Refusing cleanup outside owned outpaint analysis directory.");
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
