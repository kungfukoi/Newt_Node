// Detect flat black padding or the selected Seedance gray/green padding,
// not arbitrary source objects. Require contiguous outer-edge matching lines.
export function inspectOutpaintCoverage(reference, generated, g, frames, fps, { requireFullCoverage = false, paddingColor = "black" } = {}) {
  const s = g.source;
  const regions = [
    { name: "top", count: s.y, length: s.width, point: (line, p) => [s.x + p, line] },
    { name: "bottom", count: g.height - s.y - s.height, length: s.width, point: (line, p) => [s.x + p, g.height - 1 - line] },
    { name: "left", count: s.x, length: s.height, point: (line, p) => [line, s.y + p] },
    { name: "right", count: g.width - s.x - s.width, length: s.height, point: (line, p) => [g.width - 1 - line, s.y + p] }
  ].filter(r => r.count >= 4 && r.length >= 8);
  const invalid = new Set(), findings = [];
  for (const region of regions) {
    const missing = [];
    for (let f = 0; f < frames; f++) {
      let sourceBrightness = 0, n = 0;
      for (let y = s.y + 2; y < s.y + s.height - 2; y += 8) for (let x = s.x + 2; x < s.x + s.width - 2; x += 8) {
        const i = f * g.stride + (y * g.width + x) * 3;
        sourceBrightness += (reference[i] + reference[i + 1] + reference[i + 2]) / 3; n++;
      }
      if (!n || sourceBrightness / n < 20) continue; // Preserve intentional fades.
      let blackLines = 0;
      for (let line = 0; line < region.count - 2; line++) {
        let black = 0, samples = 0;
        for (let p = 2; p < region.length - 2; p += 2) {
          const [x, y] = region.point(line, p), i = f * g.stride + (y * g.width + x) * 3;
          const emptyGray = paddingColor === "gray" && [generated[i], generated[i + 1], generated[i + 2]].every(value => Math.abs(value - 127) <= 4);
          const emptyGreen = paddingColor === "green" && generated[i] <= 8 && generated[i + 1] >= 247 && generated[i + 2] <= 8;
          if (emptyGray || emptyGreen || generated[i] < 10 && generated[i + 1] < 10 && generated[i + 2] < 10) black++;
          samples++;
        }
        if (black / samples < 0.98) break;
        blackLines++;
      }
      if (blackLines >= 2) missing.push(f);
    }
    // A transition from empty padding to a filled edge is stronger evidence than
    // a permanently black surface. Do not buy a retry for ambiguous dark scenes.
    if (missing.length && (requireFullCoverage || missing.length < frames && missing.at(-1) < frames - 1)) {
      missing.forEach(f => invalid.add(f));
      findings.push({ region: region.name, start: missing[0] / fps, end: (missing.at(-1) + 1) / fps, firstFilledFrame: missing.at(-1) + 1 });
    }
  }
  return { missingFillFrames: invalid.size, regions: findings, status: invalid.size ? "needs_review" : "passed_checks" };
}
