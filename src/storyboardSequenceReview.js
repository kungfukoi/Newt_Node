import { storyboardFrameDirection } from "./storyboardRevisions.js";
export function storyboardReviewSignature(frames, boardUrl = "") {
  return JSON.stringify([boardUrl, frames.map(frame => [storyboardFrameDirection(frame), frame.resultUrl, frame.exportUrl])]);
}
export function validateStoryboardSequenceReview(review, frames) {
  if (!review || typeof review.summary !== "string" || !review.summary.trim() || !Array.isArray(review.issues) || review.issues.length > 20) throw new Error("Invalid sequence review.");
  const ids = new Set(frames.map(frame => frame.id));
  for (const issue of review.issues) {
    if (!Array.isArray(issue.frameIds) || issue.frameIds.some(id => !ids.has(id)) || typeof issue.message !== "string" || !issue.message.trim()) throw new Error("Sequence review referred to invalid panels.");
  }
  return review;
}
