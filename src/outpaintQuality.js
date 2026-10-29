import { normalizeVideoOutpaintSettings } from "./videoOutpaint.js";

export function outpaintCanRefinish(item, settings, sourceUrl) {
  const details = item?.videoOutpaint;
  if (!details?.rawVideoUrl || !details.prepared?.plan?.settings || !details.prepared.sourceUrl) return false;
  if (sourceUrl && sourceUrl !== details.prepared.sourceUrl) return false;
  const original = normalizeVideoOutpaintSettings(details.prepared.plan.settings), current = normalizeVideoOutpaintSettings(settings);
  return ["model", "seedanceResolution", "aspectRatio", "frame", "start", "duration", "outputSize"].every(key => JSON.stringify(original[key]) === JSON.stringify(current[key]));
}

export function outpaintNeedsFinishing(item) {
  const details = item?.videoOutpaint;
  // Explicit debug delivery keeps defects for inspection and may reach Output.
  if (details?.matching?.repeatOutput === "all" && details.matching.finishVersion === 3 && details.qc?.status === "off") return false;
  if (details?.matching?.temporalAlignment?.status === "needs_review" || details?.matching?.seamValidation?.status === "needs_review") return true;
  if (details?.matching?.motionValidation?.status === "needs_review") return true;
  const finishedWithoutQc = details?.qc?.status === "off" && details?.matching?.finishVersion === 3;
  return Boolean(details && !details.localCrop && details.qc?.status !== "passed_checks" && !finishedWithoutQc);
}

export function outpaintOutputError(item) {
  return item?.warning || item?.videoOutpaint?.warning || "Outpaint local finishing has not completed. The raw result is retained.";
}

export function outpaintCanRegenerate(item) {
  // Current user policy: QC may finish/review locally, never buy another fill.
  return false;
}

// Compare candidates from the same source/canvas only. A review pass wins;
// otherwise keep the least defective measured candidate, never simply the last.
export function outpaintCandidateScore(item) {
  const qc = item?.videoOutpaint?.qc;
  if (!qc) return Infinity;
  if (qc.status === "passed_checks") return -1;
  const structural = qc.visual?.issues?.filter(issue => ["geometry", "timing", "anatomy"].includes(issue.category)).length || 0;
  const boundary = Number(qc.boundary?.score ?? qc.worstBoundaryJump);
  return structural * 1000 + (Number.isFinite(boundary) ? boundary : 500) + (qc.missingFrames || 0) * 100;
}
