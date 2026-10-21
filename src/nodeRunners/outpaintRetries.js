// Keep the runner API stable for saved workflows and both run entry points.
// QC is strictly finishing/review: each explicit Run buys at most one video.
export async function runOutpaintRetries({ node, generate, onResult = () => {}, onRetry = () => {}, isStopped = () => false }) {
  if (isStopped()) throw new Error("Outpainting stopped.");
  const { videoOutpaintRepair, videoOutpaintRepairFindings, ...data } = node.data;
  const result = await generate({ ...node, data });
  if (node.data.utilityVideoModel === "Video Outpaint") await onResult(Array.isArray(result) ? result : [result], 1);
  return result;
}
