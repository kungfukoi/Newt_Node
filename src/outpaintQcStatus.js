const labels = {
  color: "color and brightness", seam: "edge seams", texture: "texture consistency",
  detail: "fine detail", anatomy: "anatomy", geometry: "shape continuity",
  timing: "timing", flicker: "temporal consistency", uncertainty: "visual consistency"
};

export function outpaintQcStatus({ running, preparing, stage, findings = [], details, message = "" }) {
  const issues = running ? findings : details?.qc?.visual?.issues || [];
  const targets = [...new Set(issues.map(issue => labels[issue.category]).filter(Boolean))].slice(0, 3);
  if (running) {
    const task = message.startsWith("Finish: ") ? message.slice(8) : message.startsWith("QC: ") ? message.slice(4) : message.startsWith("Canvas: ") ? message.slice(8) : preparing ? "Preparing source canvas…" : stage === "qc-edits" ? "Matching color and blending edges…" : "Waiting for generated fill…";
    return [task, targets.length ? `Checking ${targets.join(", ")}.` : ""].filter(Boolean).join("\n");
  }
  if (details?.localCrop) return "Crop only — no fill to check.";
  const motion = details?.matching?.motionValidation;
  if (motion?.coverage?.status === "needs_review") return `Incomplete fill needs review.\n${motion.coverage.missingFillFrames} frames have possible unfilled outer bands; Output is held.`;
  if (motion?.status === "needs_review") return `Motion needs review.\n${motion.flaggedFrames} frames differ from the source; Output is held.`;
  if (motion?.status === "passed_checks") return "Source correspondence checked.\nGenerated anatomy and props still need visual review.";
  if (details?.qc?.status === "off") return "QC disabled.\nSource overlap blended.";
  if (details?.qc?.status === "passed_checks") return "QC passed.";
  if (details?.qc?.status === "needs_review") {
    const reason = details.qc.missingFillFrames ? "Incomplete fill remains." : targets.length ? `Remaining: ${targets.join(", ")}.` : "Blend or consistency checks need review.";
    return `Needs review.\n${reason}`;
  }
  return "QC disabled — source overlap blends after fill.";
}
