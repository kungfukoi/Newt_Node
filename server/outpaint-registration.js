import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const clip = (value, min, max) => Math.max(min, Math.min(max, value));

// Gradient correlation measures correspondence rather than exposure. Require
// agreement over time; a new object or deformed outline is not a translation.
export function estimateEdgeTranslation(reference, generated, width, height, frames, radius = 12) {
  const stride = width * height, matches = [];
  for (let frame = 0; frame < frames; frame++) {
    const offset = frame * stride, points = [];
    const gx = new Int16Array(stride), gy = new Int16Array(stride);
    for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
      const p = y * width + x, i = offset + p;
      gx[p] = clip(generated[i + 2] - generated[i - 2], -64, 64);
      gy[p] = clip(generated[i + 2 * width] - generated[i - 2 * width], -64, 64);
      if (x > radius + 2 && x < width - radius - 3 && y > radius + 2 && y < height - radius - 3 && x % 6 === 0 && y % 3 === 0) {
        const dx = clip(reference[i + 2] - reference[i - 2], -64, 64), dy = clip(reference[i + 2 * width] - reference[i - 2 * width], -64, 64);
        if (dx * dx + dy * dy > 100) points.push([p, dx, dy]);
      }
    }
    if (points.length < 40) continue;
    const score = (dx, dy) => {
      let dot = 0, a = 0, b = 0;
      for (const [p, rx, ry] of points) {
        const q = p + dy * width + dx, tx = gx[q], ty = gy[q];
        dot += rx * tx + ry * ty; a += rx * rx + ry * ry; b += tx * tx + ty * ty;
      }
      return a && b ? dot / Math.sqrt(a * b) : -1;
    };
    const before = score(0, 0); let best = { dx: 0, dy: 0, score: before };
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const value = score(dx, dy); if (value > best.score) best = { dx, dy, score: value };
    }
    const refine = axis => {
      const { dx, dy } = best;
      if (Math.abs(best[axis]) >= radius) return best[axis];
      const low = score(dx - (axis === "dx" ? 1 : 0), dy - (axis === "dy" ? 1 : 0));
      const high = score(dx + (axis === "dx" ? 1 : 0), dy + (axis === "dy" ? 1 : 0));
      const curvature = low - 2 * best.score + high;
      return best[axis] + (curvature < -0.00001 ? clip(0.5 * (low - high) / curvature, -0.5, 0.5) : 0);
    };
    matches.push({ dx: refine("dx"), dy: refine("dy"), correlation: best.score, before });
  }
  if (matches.length < Math.min(3, frames)) return { accepted: false, reason: "Insufficient textured overlap." };
  const dx = median(matches.map(v => v.dx)), dy = median(matches.map(v => v.dy));
  const agreeing = matches.filter(v => Math.abs(v.dx - dx) <= 1.5 && Math.abs(v.dy - dy) <= 1.5 && v.correlation >= 0.7);
  const correlation = matches.reduce((s, v) => s + v.correlation, 0) / matches.length;
  const before = matches.reduce((s, v) => s + v.before, 0) / matches.length;
  const accepted = agreeing.length / matches.length >= 0.75 && correlation - before >= 0.02 && Math.max(Math.abs(dx), Math.abs(dy)) < radius - 0.5 && Math.max(Math.abs(dx), Math.abs(dy)) > 0.25;
  return { accepted, dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100, correlation, before, sampledFrames: matches.length, reason: accepted ? "Stable native-pixel correspondence across the shot." : "No reliable stable improvement; fill geometry retained." };
}

export async function measureOutpaintRegistration({ plan, referencePath, generatedPath, runFfmpeg }) {
  const w = plan.outputWidth, h = plan.outputHeight, ratio = w / plan.width;
  const sw = Math.round(plan.sourceWidth * ratio / 2) * 2, sh = Math.round(plan.sourceHeight * h / plan.height / 2) * 2;
  const x = Math.round(plan.left * ratio), y = Math.round(plan.top * h / plan.height);
  const radius = 12, band = Math.min(128, Math.floor(Math.min(sw, sh) / 2) - 2);
  if (band < 40) return { applied: false, edges: {} };
  const regions = [
    { name: "top", enabled: y > 0, width: sw, height: band, x, y: y + 2 },
    { name: "bottom", enabled: y + sh < h, width: sw, height: band, x, y: y + sh - band - 2 },
    { name: "left", enabled: x > 0, width: band, height: sh, x: x + 2, y },
    { name: "right", enabled: x + sw < w, width: band, height: sh, x: x + sw - band - 2, y }
  ].filter(r => r.enabled);
  const directory = await mkdtemp(path.join(tmpdir(), "newt-outpaint-registration-"));
  const edges = {};
  try {
    for (const region of regions) {
      const buffers = [];
      for (const [label, file] of [["reference", referencePath], ["generated", generatedPath]]) {
        const target = path.join(directory, `${region.name}-${label}.gray`);
        await runFfmpeg(["-y", "-ss", String((plan.prerollFrames || 0) / plan.fps), "-i", file, "-t", String(plan.duration), "-vf", `fps=${Math.min(2, 8 / plan.duration)},scale=${w}:${h},format=gray,crop=${region.width}:${region.height}:${region.x}:${region.y}`, "-an", "-f", "rawvideo", target], "Measure outpaint edge registration", 120000);
        buffers.push(await readFile(target));
      }
      const frames = Math.floor(Math.min(...buffers.map(b => b.length)) / (region.width * region.height));
      edges[region.name] = frames ? estimateEdgeTranslation(...buffers, region.width, region.height, frames, radius) : { accepted: false, reason: "No sampled frames." };
    }
    return { applied: Object.values(edges).some(e => e.accepted), edges, maxShift: radius, method: "Stable native-pixel edge registration; generated pixels only" };
  } finally {
    if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith("newt-outpaint-registration-")) throw new Error("Refusing cleanup outside owned registration directory");
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
}

export function registrationFilter(registration, { w, h, sw, sh, x, y }, input = "bgRaw", output = "bgAligned") {
  const edges = Object.entries(registration?.edges || {}).filter(([, edge]) => edge.accepted);
  if (!edges.length) return `[${input}]null[${output}]`;
  const extent = Math.min(256, Math.floor(Math.min(sw, sh) / 2));
  const weights = edges.map(([name]) => `max(0,1-abs(${name === "top" ? `Y-${y}` : name === "bottom" ? `Y-${y + sh}` : name === "left" ? `X-${x}` : `X-${x + sw}`})/${extent})`);
  const total = `max(1,${weights.join("+")})`;
  const displacement = axis => `(${edges.map(([, edge], i) => `(${edge[axis]})*(${weights[i]})`).join("+")})/(${total})`;
  const px = `clip(X+(${displacement("dx")}),0,${w - 1})`, py = `clip(Y+(${displacement("dy")}),0,${h - 1})`;
  return `[${input}]format=gbrp16le,geq=r='r(${px},${py})':g='g(${px},${py})':b='b(${px},${py})':interpolation=bilinear[${output}]`;
}
