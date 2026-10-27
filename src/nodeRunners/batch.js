import { runBatchEntries } from "../batch.js";

// Each entry gets isolated runner state and graph inputs. Only the collected
// results are published to the real node; workers never swap the live graph.
export async function runMediaBatch({ node, plan, execute, update, stopped, concurrency = 3 }) {
  const retry = Boolean(node.data.batchRetryEntry);
  const retained = retry ? (node.data.resultItems || []).filter(item => item.batchRunIndex !== plan[0].runIndex) : [];
  const retainedBatch = retry ? (node.data.batchResults || []).filter(item => item.batchRunIndex !== plan[0].runIndex) : [];
  const retainedFailures = retry ? (node.data.batchFailedEntries || []).filter(item => item.runIndex !== plan[0].runIndex) : [];
  const states = plan.map(entry => ({ entry, data: {}, finished: false }));
  const textMode = ["text", "textAgent", "skillDirector"].includes(node.type);
  function collect() {
    const items = [...retained], collection = [...retainedBatch], texts = [];
    for (const state of states) {
      const { entry, data } = state;
      const annotate = (item, index) => ({ ...item, label: `${entry.label} · ${index + 1}`, batchSourceId: entry.id,
        batchSourceUrl: entry.url, batchPrompt: entry.prompt || "", batchRunIndex: entry.runIndex,
        batchInputs: entry.inputs, batchNodeId: entry.inputs?.[0]?.batchId });
      if (textMode && data.resultText) {
        texts.push({ label: entry.label, text: data.resultText });
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
    return { items, collection, texts };
  }
  function publish() {
    if (stopped()) return;
    const { items, collection, texts } = collect();
    const completed = states.filter(state => state.finished).length;
    const active = states.find(state => !state.finished && state.data.status === "running")?.data || {};
    update({ status: "running", batchProgress: `${completed} / ${plan.length}`, ...(collection.length ? { batchResults: collection, batchMediaType: collection[0].type } : {}),
      ...Object.fromEntries(["keyerProgress", "keyerJobId", "videoOutpaintStage"].filter(key => active[key] !== undefined).map(key => [key, active[key]])),
      ...(items.length ? { resultItems: items, resultUrl: items[0].url, resultType: items[0].type, selectedResultIndex: 0 } : {}),
      ...(texts.length ? { resultText: texts.map(item => `${item.label}\n${item.text}`).join("\n\n") } : {}),
      remoteVideoRunIds: [...new Set(states.flatMap(state => state.data.remoteVideoRunIds || []))] });
  }
  update({ status: "running", error: "", batchRunActive: true, batchProgress: `0 / ${plan.length}`, batchFailedEntries: retainedFailures });
  await runBatchEntries(plan, { concurrency, stopped, run: async (entry, index) => {
    const state = states[index];
    try {
      state.outcome = await execute(entry, patch => { state.data = { ...state.data, ...patch }; publish(); });
      state.error = state.outcome?.status === "error" || state.data.error ? state.outcome?.error?.message || state.data.error || "Entry failed." : "";
    } catch (error) { state.error = error.message || String(error); }
    state.finished = true;
    publish();
    return state;
  } });
  if (stopped()) return { status: "error" };
  const failures = states.filter(state => state.error).map(state => ({ ...state.entry, error: state.error, variation: 0 }));
  const { items, collection, texts } = collect();
  const last = states.filter(state => !state.error).at(-1)?.data || {};
  // Preserve node-specific viewer/configuration state from a completed entry.
  const { status, error, resultItems, resultUrl, resultText, selectedResultIndex, remoteVideoRunIds, ...lastPatch } = last;
  const message = failures.length ? `${plan.length - failures.length} of ${plan.length} batch entries completed. ${failures[0].error}` : "";
  update({ ...lastPatch, status: failures.length ? "error" : "complete", error: message, batchRunActive: false, batchProgress: "", batchRetryEntry: null,
    batchFailedEntries: [...retainedFailures, ...failures], ...(collection.length ? { batchResults: collection } : {}),
    ...(items.length ? { resultItems: items, resultUrl: items[0].url, resultType: items[0].type, selectedResultIndex: 0 } : {}),
    ...(texts.length ? { resultText: texts.map(item => `${item.label}\n${item.text}`).join("\n\n") } : {}) });
  return { status: failures.length ? "error" : "complete", ...(failures.length ? { error: new Error(message) } : {}), resultItems: items };
}
