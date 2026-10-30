import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const quantile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
const round = value => Math.round(value * 1000) / 1000;

// Match gradients along the join at several known inward depths. A constant,
// shot-wide shear can reconnect a cable without retiming or warping the plate.
export function estimateSeamRegistration(reference, generated, { length, depth, frames, radius = 96, validation = false }) {
  const stride = length * depth, records = [], positions = [];
  if (reference.length !== frames * stride || generated.length !== reference.length || depth < 12 || length < radius * 2 + 8) return { accepted: false, reason: "Insufficient complete seam evidence" };
  for (let frame = 0; frame < frames; frame++) for (let distance = 4; distance < depth - 2; distance += 4) {
    const row = frame * stride + distance * length, points = [];
    for (let x = radius + 3; x < length - radius - 3; x++) {
      const value = reference[row + x + 2] - reference[row + x - 2];
      if (Math.abs(value) >= 6) points.push([x, value]);
    }
    if (points.length < 8) continue;
    const score = delta => {
      let dot = 0, a = 0, b = 0;
      for (const [x, value] of points) {
        const at = row + x + delta, other = generated[at + 2] - generated[at - 2];
        dot += value * other; a += value * value; b += other * other;
      }
      return a && b ? dot / Math.sqrt(a * b) : -1;
    };
    const baseline = score(0);
    if (validation) { records.push({ frame, distance, correlation: baseline }); continue; }
    const scores = Array.from({ length: radius * 2 + 1 }, (_, i) => ({ delta: i - radius, correlation: score(i - radius) }));
    const best = scores.reduce((a, b) => b.correlation > a.correlation ? b : a);
    const second = Math.max(...scores.filter(item => Math.abs(item.delta - best.delta) > 4).map(item => item.correlation));
    if (best.correlation < 0.85 || best.correlation - baseline < 0.15 || best.correlation - second < 0.06 || Math.abs(best.delta) >= radius - 2) continue;
    records.push({ frame, distance, shift: best.delta, correlation: best.correlation, baseline });
    positions.push(...points.map(([x]) => x));
  }
  const supportedFrames = new Set(records.map(record => record.frame)).size;
  if (validation) return { sampledFrames: frames, supportedFrames, samples: records.length, correlation: records.length ? median(records.map(record => record.correlation)) : -1,
    support: records.length ? records.filter(record => record.correlation >= 0.8).length / records.length : 0 };
  const expected = frames * Math.floor((depth - 3) / 4);
  if (supportedFrames < Math.max(3, Math.ceil(frames * 0.75)) || records.length < expected * 0.75) return { accepted: false, sampledFrames: frames, supportedFrames, reason: "No stable feature correspondence across the shot" };
  const slopes = [];
  for (let a = 0; a < records.length; a++) for (let b = a + 1; b < records.length; b++) if (Math.abs(records[b].distance - records[a].distance) >= 8) slopes.push((records[b].shift - records[a].shift) / (records[b].distance - records[a].distance));
  if (!slopes.length) return { accepted: false, reason: "Insufficient depth coverage" };
  const slope = median(slopes), shift = median(records.map(record => record.shift - slope * record.distance));
  const residual = quantile(records.map(record => Math.abs(record.shift - shift - slope * record.distance)), 0.9);
  const accepted = residual <= 2 && Math.abs(shift) < radius - 2 && Math.abs(slope) <= 0.75 && Math.abs(shift) >= 0.5;
  return { accepted, shift: round(shift), slope: round(slope), residual: round(residual), correlation: round(median(records.map(record => record.correlation))), before: round(median(records.map(record => record.baseline))),
    supportedFrames, sampledFrames: frames, supportStart: quantile(positions, 0.05), supportEnd: quantile(positions, 0.95), radius,
    reason: accepted ? "Stable corresponding feature positions and direction at the seam" : "Correspondence varies over time or depth; geometry retained" };
}

export function seamRegistrationFilter(edges, geometry) {
  const { w, h, sw, sh, x, y } = geometry;
  const fields = Object.entries(edges).filter(([, edge]) => edge.accepted).map(([name, edge]) => {
    const horizontal = name === "top" || name === "bottom";
    const distance = name === "top" ? `Y-${y}` : name === "bottom" ? `${y + sh - 1}-Y` : name === "left" ? `X-${x}` : `${x + sw - 1}-X`;
    const tangent = horizontal ? `X-${x}` : `Y-${y}`;
    const normal = `clip((abs(${distance})-32)/224,0,1)`;
    const margin = edge.radius * 3;
    const lateral = `clip(min((${tangent})-(${edge.supportStart - margin}),(${edge.supportEnd + margin})-(${tangent}))/${margin},0,1)`;
    const smooth = t => `((${t})*(${t})*(3-2*(${t})))`;
    const weight = `(1-${smooth(normal)})*${smooth(lateral)}`;
    const active = `lt(abs(${distance}),256)*gt(${tangent},${edge.supportStart - margin})*lt(${tangent},${edge.supportEnd + margin})`;
    return { horizontal, weight, active, maximum: Math.min(edge.radius, Math.abs(edge.shift) + Math.abs(edge.slope) * 64), shift: `clip(${edge.shift}+(${edge.slope})*clip(${distance},-64,64),-${edge.radius},${edge.radius})` };
  });
  const displacement = horizontal => {
    const matching = fields.filter(field => field.horizontal === horizontal);
    if (!matching.length) return "0";
    const numerator = matching.map(field => `(${field.shift})*(${field.weight})`).join("+");
    const denominator = matching.map(field => `(${field.weight})`).join("+");
    return `(${numerator})/max(1,${denominator})`;
  };
  // Padding also tapers displacement at the outside canvas boundary, avoiding
  // clamped edge-row extrusion. The original core is restored after this filter.
  const canvasMargin = round(Math.max(16, 2 * fields.reduce((sum, field) => sum + field.maximum, 0) + 8));
  const dx = `(${displacement(true)})*min(1,min(X,${w - 1}-X)/${canvasMargin})`;
  const dy = `(${displacement(false)})*min(1,min(Y,${h - 1}-Y)/${canvasMargin})`;
  const active = fields.map(field => `(${field.active})`).join("+") || "0";
  return "format=gbrp10le,geq=" + ["r", "g", "b"].map(channel => `${channel}='if(${active},${channel}(clip(X+(${dx}),0,${w - 1}),clip(Y+(${dy}),0,${h - 1})),${channel}(X,Y))'`).join(":") + ":interpolation=bilinear";
}

export async function registerOutpaintSeams({ referencePath, generated, plan, offset = 0, runFfmpeg, createTarget, body }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-seam-register-"));
  try {
    const w = plan.outputWidth, h = plan.outputHeight;
    const sw = Math.round(plan.sourceWidth / plan.width * w / 2) * 2, sh = Math.round(plan.sourceHeight / plan.height * h / 2) * 2;
    const x = Math.round(plan.left / plan.width * w), y = Math.round(plan.top / plan.height * h);
    const depth = Math.min(32, Math.floor(Math.min(sw, sh) / 4)), count = plan.outputFrames || plan.frames;
    const regions = [
      { name: "top", enabled: y > 0, length: sw, filter: `crop=${sw}:${depth}:${x}:${y}` },
      { name: "bottom", enabled: y + sh < h, length: sw, filter: `crop=${sw}:${depth}:${x}:${y + sh - depth},vflip` },
      { name: "left", enabled: x > 0, length: sh, filter: `crop=${depth}:${sh}:${x}:${y},transpose=2,vflip` },
      { name: "right", enabled: x + sw < w, length: sh, filter: `crop=${depth}:${sh}:${x + sw - depth}:${y},transpose=2` }
    ].filter(region => region.enabled);
    const extract = async (file, region, label, sample, lag = 0) => {
      const target = path.join(directory, label + ".gray"), start = (plan.prerollFrames || 0) + lag;
      await runFfmpeg(["-y", "-i", file, "-vf", `fps=${plan.fps},trim=start_frame=${start}:end_frame=${start + count},${sample ? `select='not(mod(n,${Math.max(1, Math.ceil(count / 8))}))',` : ""}scale=${w}:${h},format=gray,${region.filter}`, "-vsync", "0", "-an", "-f", "rawvideo", target], "Measure same-frame outpaint seam geometry", 120000);
      return readFile(target);
    };
    const edges = {};
    for (const region of regions) {
      const reference = await extract(referencePath, region, region.name + "-ref", true);
      const raw = await extract(generated.filePath, region, region.name + "-raw", true, offset);
      edges[region.name] = estimateSeamRegistration(reference, raw, { length: region.length, depth, frames: Math.ceil(count / Math.max(1, Math.ceil(count / 8))) });
    }
    if (!Object.values(edges).some(edge => edge.accepted)) return { generated, report: { applied: false, edges, reason: "No confident seam geometry correction" } };
    const candidate = await createTarget(body, "outpaint-seam-registration", ".mkv", true);
    const filter = seamRegistrationFilter(edges, { w, h, sw, sh, x, y });
    await runFfmpeg(["-y", "-i", generated.filePath, "-vf", `fps=${plan.fps},scale=${w}:${h},${filter},scale=out_color_matrix=bt709:out_range=tv,format=yuv444p10le`, "-frames:v", String(plan.frames), "-an", "-c:v", "ffv1", "-level", "3", "-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709", candidate.filePath], "Align generated seam features without moving the original source", 600000);
    let accepted = true;
    for (const region of regions.filter(region => edges[region.name].accepted)) {
      const reference = await extract(referencePath, region, region.name + "-all-ref", false);
      const aligned = await extract(candidate.filePath, region, region.name + "-all-aligned", false, offset);
      const validation = estimateSeamRegistration(reference, aligned, { length: region.length, depth, frames: count, validation: true });
      edges[region.name].validation = validation;
      accepted &&= validation.supportedFrames >= Math.ceil(count * 0.9) && validation.support >= 0.9 && validation.correlation >= 0.8 && validation.correlation > edges[region.name].before + 0.15;
    }
    return { generated: accepted ? candidate : generated, report: { applied: accepted, edges, alignedVideoUrl: candidate.publicPath, framesChecked: count,
      reason: accepted ? "Generated seam features aligned with every-frame validation; source pixels and timing unchanged" : "Correction failed every-frame correspondence validation; raw geometry retained" } };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
