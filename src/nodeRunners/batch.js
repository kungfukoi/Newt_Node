import { batchPromptSummary, runBatchEntries } from "../batch.js";
import { existingResultItemsForNode } from "../mediaResults.js";
import { appendUniqueVideoResults } from "../remoteVideoJobs.js";

// Each entry gets isolated runner state and graph inputs. Only the collected
// results are published to the real node; workers never swap the live graph.
export async function runMediaBatch({ node, plan, execute, update, stopped, keepImagePreview = false, selectedResultUrl = () => node.data.resultUrl, concurrency = 3 }) {
  const retry = Boolean(node.data.batchRetryEntry);
  const keepVideoPreview = node.type === "videoModel";
  const previousVideos = keepVideoPreview ? existingResultItemsForNode(node, "video") : [];
  const previousImages = keepImagePreview ? existingResultItemsForNode(node, "image") : [];
  const previousImageUrls = new Set(previousImages.map(item => item.url));
  const retryItems = keepImagePreview ? node.data.batchResults : node.data.resultItems;
  const retained = retry ? (retryItems || []).filter(item => item.batchRunIndex !== plan[0].runIndex) : [];
  const retainedBatch = retry ? (node.data.batchResults || []).filter(item => item.batchRunIndex !== plan[0].runIndex) : [];
  const retainedFailures = retry ? (node.data.batchFailedEntries || []).filter(item => item.runIndex !== plan[0].runIndex) : [];
  const states = plan.map(entry => ({ entry, data: {}, finished: false }));
  const textMode = ["text", "textAgent", "skillDirector"].includes(node.type);
  function collect() {
    const items = [...retained], collection = [...retainedBatch];
    for (const state of states) {
      const { entry, data } = state;
      const annotate = (item, index) => ({ ...item, label: `${entry.label} · ${index + 1}`, batchSourceId: entry.id,
        batchSourceUrl: entry.url, batchPrompt: entry.prompt || "", batchRunIndex: entry.runIndex,
        batchInputs: entry.inputs, batchNodeId: entry.inputs?.[0]?.batchId });
      if (textMode && data.resultText && !state.error) {
        collection.push({ ...entry, id: `${entry.id}:prompt`, prompt: data.resultText, batchRunIndex: entry.runIndex });
      } else {
        const results = Array.isArray(data.resultItems) ? data.resultItems : data.resultUrl ? [{ url: data.resultUrl, type: data.resultType || "image" }] : [];
        results.filter(item => item.url).forEach((item, index) => {
          const result = annotate(item, index);
          items.push(result);
          if (["image", "video"].includes(result.type)) collection.push({ ...result, id: `${entry.id}:result:${index}`, prompt: "" });
        });
      }
    }
    items.sort((a, b) => (a.batchRunIndex || 0) - (b.batchRunIndex || 0));
    collection.sort((a, b) => (a.batchRunIndex || 0) - (b.batchRunIndex || 0));
    return { items, collection };
  }
  function imagePreviewPatch(items) {
    const resultItems = [...previousImages, ...items.filter(item => !previousImageUrls.has(item.url))];
    const selectedUrl = selectedResultUrl();
    const selectedResultIndex = Math.max(0, resultItems.findIndex(item => item.url === selectedUrl));
    const item = resultItems[selectedResultIndex];
    return item ? { resultItems, resultUrl: item.url, resultType: item.type, selectedResultIndex } : {};
  }
  function publish() {
    if (stopped()) return;
    const { items, collection } = collect();
    const completed = states.filter(state => state.finished).length;
    const active = states.find(state => !state.finished && state.data.status === "running")?.data || {};
    // Keep the gallery available while publishing only this batch's entries downstream.
    const previewItems = keepVideoPreview ? appendUniqueVideoResults(previousVideos, items) : items;
    const previewIndex = keepVideoPreview ? Math.max(0, previewItems.findIndex(item => item.url === selectedResultUrl())) : 0;
    const previewItem = previewItems[previewIndex];
    update({ status: "running", batchProgress: `${completed} / ${plan.length}`, batchResults: collection, ...(collection.length ? { batchMediaType: collection[0].type } : {}),
      ...Object.fromEntries(["keyerProgress", "keyerJobId", "videoOutpaintStage"].filter(key => active[key] !== undefined).map(key => [key, active[key]])),
      ...(keepImagePreview ? imagePreviewPatch(items) : items.length && previewItem ? { resultItems: previewItems, resultUrl: previewItem.url, resultType: previewItem.type, selectedResultIndex: previewIndex } : {}),
      ...(textMode ? { resultText: batchPromptSummary(collection) } : {}),
      remoteVideoRunIds: [...new Set(states.flatMap(state => state.data.remoteVideoRunIds || []))] });
  }
  update({ status: "running", error: "", batchRunActive: true, batchProgress: `0 / ${plan.length}`, batchFailedEntries: retainedFailures,
    batchResults: retainedBatch,
    ...(!keepVideoPreview && !keepImagePreview ? { resultItems: retained, resultUrl: retained[0]?.url || "", selectedResultIndex: 0 } : {}),
    ...(textMode ? { resultText: batchPromptSummary(retainedBatch) } : {}) });
  await runBatchEntries(plan, { concurrency, stopped, run: async (entry, index) => {
    const state = states[index];
    try {
      state.outcome = await execute(entry, patch => { state.data = { ...state.data, ...patch }; publish(); });
      state.error = state.outcome?.status === "error" || state.data.error ? state.outcome?.error?.message || state.data.error || "Entry failed." : "";
      if (textMode && !state.error && !state.data.resultText?.trim()) state.error = "Text Agent returned no prompt for this entry.";
    } catch (error) { state.error = error.message || String(error); }
    state.finished = true;
    publish();
    return state;
  } });
  if (stopped()) return { status: "error" };
  const failures = states.filter(state => state.error).map(state => ({ ...state.entry, error: state.error, variation: 0 }));
  const { items, collection } = collect();
  const last = states.filter(state => !state.error).at(-1)?.data || {};
  // Preserve node-specific viewer/configuration state from a completed entry.
  const { status, error, resultItems, resultUrl, resultText, selectedResultIndex, remoteVideoRunIds, ...lastPatch } = last;
  // Entry conversations are private. Keep the shared instruction available for
  // the next explicit batch run instead of publishing the last worker's draft.
  if (node.type === "textAgent") {
    for (const key of ["agentDraft", "agentMessages", "textPromptHistoryIndex", "textPromptHistoryDraft"]) delete lastPatch[key];
  }
  const message = failures.length ? `${plan.length - failures.length} of ${plan.length} batch entries completed. ${failures[0].error}` : "";
  const replacePreview = items.length > (keepVideoPreview ? retained.length : 0);
  update({ ...lastPatch, status: failures.length ? "error" : "complete", error: message, batchRunActive: false, batchProgress: "", batchRetryEntry: null,
    batchFailedEntries: [...retainedFailures, ...failures], batchResults: collection,
    ...(keepImagePreview ? imagePreviewPatch(items) : replacePreview ? { resultItems: items, resultUrl: items[0].url, resultType: items[0].type, selectedResultIndex: 0 } : {}),
    ...(textMode ? { resultText: batchPromptSummary(collection) } : {}) });
  return { status: failures.length ? "error" : "complete", ...(failures.length ? { error: new Error(message) } : {}), resultItems: items };
}
