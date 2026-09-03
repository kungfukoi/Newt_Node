import { appendUniqueVideoResults, remoteVideoTerminal } from "./remoteVideoJobs.js";
import { existingResultItemsForNode } from "./mediaResults.js";
import { normalizeVideoGenerationResult } from "./nodeRunners/videoModels.js";

export function recoveredVideoPatches(nodes, jobs, activeNodeIds = new Set(), edges = []) {
  const patches = [];
  for (const node of nodes) {
    if (node.type !== "videoModel" || activeNodeIds.has(node.id)) continue;
    const owned = jobs.filter((job) => job.nodeId === node.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!owned.length) continue;
    const seen = new Set(node.data.remoteVideoRunIds || []);
    const unseen = owned.filter((job) => !seen.has(job.runId));
    if (!unseen.length) continue;
    const completed = unseen.filter((job) => job.state === "completed" && job.result?.video?.localUrl);
    const incoming = completed.map((job) => normalizeVideoGenerationResult(job.result, job.batchIndex - 1));
    const previous = existingResultItemsForNode(node, "video");
    const resultItems = appendUniqueVideoResults(previous, incoming);
    const latestGroup = owned.at(-1).groupId;
    const group = owned.filter((job) => job.groupId === latestGroup);
    const pending = group.some((job) => !remoteVideoTerminal(job));
    const errors = group.filter((job) => job.state === "failed").map((job) => `Run ${job.batchIndex}: ${job.message}`);
    const terminal = unseen.filter(remoteVideoTerminal);
    const patch = {
      status: pending ? "running" : group.some((job) => job.state === "completed") ? "complete" : "error",
      error: errors.join(" "),
      remoteVideoRunIds: [...seen, ...terminal.map((job) => job.runId)]
    };
    if (resultItems.length > previous.length) {
      Object.assign(patch, { resultItems, resultUrl: resultItems.at(-1).url, selectedResultIndex: resultItems.length - 1, resultText: "" });
    }
    if (terminal.length || node.data.status !== patch.status || node.data.error !== patch.error) patches.push({ nodeId: node.id, patch });
    const outputIds = new Set(completed.map((job) => job.outputTargetNodeId).filter(Boolean));
    for (const outputId of outputIds) {
      const output = nodes.find((item) => item.id === outputId && item.type === "output");
      if (!output || !edges.some((edge) => edge.from.nodeId === node.id && edge.to.nodeId === outputId)) continue;
      const items = completed.filter((job) => job.outputTargetNodeId === outputId).map((job) => normalizeVideoGenerationResult(job.result, job.batchIndex - 1));
      const outputItems = appendUniqueVideoResults(existingResultItemsForNode(output, "video"), items);
      patches.push({ nodeId: outputId, patch: {
        status: "complete", error: "", resultType: "video", resultItems: outputItems,
        resultUrl: outputItems.at(-1).url, selectedResultIndex: outputItems.length - 1,
        lastSavedAt: completed.at(-1).updatedAt, lastSavedFileName: outputItems.at(-1).fileName, lastSavedPath: outputItems.at(-1).filePath
      } });
    }
  }
  return patches;
}
