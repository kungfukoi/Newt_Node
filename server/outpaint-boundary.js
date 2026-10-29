import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Evaluate thin strips at native pixel spacing across the join. Only the long
// axis is reduced, so a one-pixel matte cannot disappear in a whole-frame resize.
export function boundaryRegions(plan) {
  const w = plan.outputWidth, h = plan.outputHeight;
  const sw = Math.round(plan.sourceWidth / plan.width * w / 2) * 2;
  const sh = Math.round(plan.sourceHeight / plan.height * h / 2) * 2;
  const x = Math.round(plan.left / plan.width * w), y = Math.round(plan.top / plan.height * h);
  const regions = [];
  for (const [name, vertical, edge, length, start, room] of [
    ["top", false, y, sw, x, Math.min(y, sh / 2)],
    ["bottom", false, y + sh, sw, x, Math.min(h - y - sh, sh / 2)],
    ["left", true, x, sh, y, Math.min(x, sw / 2)],
    ["right", true, x + sw, sh, y, Math.min(w - x - sw, sw / 2)]
  ]) {
    const radius = Math.min(8, Math.floor(room));
    if (radius < 3) continue;
    const width = Math.min(384, length), height = radius * 2;
    const crop = vertical ? `crop=${height}:${length}:${edge - radius}:${start},transpose=1` : `crop=${length}:${height}:${start}:${edge - radius}`;
    regions.push({ name, width, height, radius, filter: `${crop},scale=${width}:${height}`, stride: width * height * 3 });
  }
  return regions;
}

export function measureBoundary(data, region, frames) {
  let total = 0, worst = 0, temporal = 0, previous;
  for (let f = 0; f < frames; f++) {
    let edge = 0, nearby = 0, count = 0;
    for (let x = 0; x < region.width; x++) for (let c = 0; c < 3; c++) {
      const at = y => data[f * region.stride + (y * region.width + x) * 3 + c];
      edge += Math.abs(at(region.radius) - at(region.radius - 1));
      nearby += (Math.abs(at(region.radius - 2) - at(region.radius - 3)) + Math.abs(at(region.radius + 1) - at(region.radius + 2))) / 2;
      count++;
    }
    const excess = Math.max(0, (edge - nearby) / count);
    total += excess; worst = Math.max(worst, excess);
    if (previous !== undefined) temporal = Math.max(temporal, Math.abs(excess - previous));
    previous = excess;
  }
  return { mean: total / frames, worst, temporal };
}

export function boundaryReport(edges) {
  const values = Object.values(edges);
  const worst = Math.max(0, ...values.map(v => v.worst));
  const temporal = Math.max(0, ...values.map(v => v.temporal));
  const mean = values.reduce((sum, v) => sum + v.mean, 0) / Math.max(1, values.length);
  return { edges, mean, worst, temporal, score: mean + worst * 0.25 + temporal * 0.25, status: worst > 8 ? "needs_review" : "passed_checks", scope: "Every-frame native-spacing boundary strips; this does not certify anatomy or geometry." };
}

export async function inspectFinishedBoundary({ filePath, plan, runFfmpeg }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-finished-seams-"));
  try {
    const edges = {};
    for (const region of boundaryRegions(plan)) {
      const target = path.join(directory, region.name + ".rgb");
      await runFfmpeg(["-y", "-i", filePath, "-vf", `${region.filter},format=rgb24`, "-frames:v", String(plan.frames), "-an", "-f", "rawvideo", target], "Check finished outpaint seams at native pixel spacing", 120000);
      const data = await readFile(target);
      if (data.length !== region.stride * plan.frames) return { status: "needs_review", reason: "Incomplete finished seam evidence", edges };
      edges[region.name] = measureBoundary(data, region, plan.frames);
    }
    return boundaryReport(edges);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export function improvesBoundary(candidate, baseline) {
  return candidate.score + 0.2 < baseline.score && Object.entries(candidate.edges).every(([name, edge]) => {
    const before = baseline.edges[name];
    return before && edge.worst <= before.worst + 1 && edge.temporal <= before.temporal + 1;
  });
}

// Only source pixels inside the authorized overlap participate. Never extrapolate
// a single edge row or replace the generated interior with a discontinuous patch.
export function overlapBlendFilters({ w, h, sw, sh, x, y, feather }) {
  const edges = [x > 0 ? "X" : null, x + sw < w ? `${sw - 1}-X` : null, y > 0 ? "Y" : null, y + sh < h ? `${sh - 1}-Y` : null].filter(Boolean);
  if (!edges.length || feather <= 0) return [`[bg][source]overlay=${x}:${y}:shortest=1:format=yuv444p10[out]`];
  const inward = edges.reduce((a, b) => `min(${a},${b})`);
  const a = `min(1,max(0,${inward})/${feather})`;
  return [`[source]format=yuva444p10le,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='1023*(${a})*(${a})*(3-2*(${a}))'[original]`, `[bg][original]overlay=${x}:${y}:shortest=1:format=yuv444p10[out]`];
}
