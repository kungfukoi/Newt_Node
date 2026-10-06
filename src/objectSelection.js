// Independent selection geometry; masks are compact row-major [start, length] runs.
export const objectSelectionEndpoints = { auto: "fal-ai/sam2/auto-segment", point: "fal-ai/sam-3/image" };

export const sam2Defaults = Object.freeze({ pointsPerSide: 32, confidence: 0.88, stability: 0.95, minRegionArea: 100 });
export function validateSam2Settings(settings = {}) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Invalid SAM 2 settings.");
  const result = { ...sam2Defaults, ...settings };
  for (const [key, min, max, integer] of [["pointsPerSide", 8, 64, true], ["confidence", 0, 1], ["stability", 0, 1], ["minRegionArea", 0, 10000, true]]) {
    const value = result[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`SAM 2 ${key} must be ${integer ? "an integer" : "a number"} between ${min} and ${max}.`);
  }
  return Object.fromEntries(Object.keys(sam2Defaults).map(key => [key, result[key]]));
}

export function objectSelectionInput({ imageUrl, point, prompt, width, height, sam2 }) {
  if (prompt) return { image_url: imageUrl, prompt, apply_mask: false, output_format: "png", return_multiple_masks: true, max_masks: 64, include_scores: true };
  if (!point) {
    const settings = validateSam2Settings(sam2);
    return { image_url: imageUrl, output_format: "png", points_per_side: settings.pointsPerSide, pred_iou_thresh: settings.confidence, stability_score_thresh: settings.stability, min_mask_region_area: settings.minRegionArea };
  }
  return { image_url: imageUrl, prompt: "", point_prompts: [{
    x: Math.min(width - 1, Math.floor(point.x * width)), y: Math.min(height - 1, Math.floor(point.y * height)), label: 1
  }], apply_mask: false, output_format: "png", return_multiple_masks: true, max_masks: 3, include_scores: true };
}

export function maskContains(mask, point) {
  if (!mask || point.x < 0 || point.y < 0 || point.x >= 1 || point.y >= 1) return false;
  const pixel = Math.floor(point.y * mask.height) * mask.width + Math.floor(point.x * mask.width);
  let lo = 0, hi = mask.runs.length / 2 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, start = mask.runs[mid * 2], length = mask.runs[mid * 2 + 1];
    if (pixel < start) hi = mid - 1;
    else if (pixel >= start + length) lo = mid + 1;
    else return true;
  }
  return false;
}

export function objectAtPoint(masks, point) {
  // Prefer the smallest containing object over an enclosing person/background.
  let match = null;
  for (const mask of masks) if ((!match || mask.area < match.area) && maskContains(mask, point)) match = mask;
  return match;
}

export function selectObjectMarks(marks, mask, { shiftKey = false, altKey = false } = {}) {
  const next = shiftKey || altKey ? marks : marks.filter(mark => mark.layer !== "selection");
  return [...next, { tool: "object", layer: "selection", mask, subtract: altKey }];
}

export function drawObjectMask(ctx, mask, width, height) {
  const sx = width / mask.width, sy = height / mask.height;
  ctx.beginPath();
  for (let i = 0; i < mask.runs.length; i += 2) {
    let start = mask.runs[i], remaining = mask.runs[i + 1];
    while (remaining > 0) {
      const x = start % mask.width, y = Math.floor(start / mask.width), length = Math.min(remaining, mask.width - x);
      ctx.rect(x * sx, y * sy, length * sx, sy);
      start += length; remaining -= length;
    }
  }
  ctx.fill();
}
