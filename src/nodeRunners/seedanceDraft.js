import { nodeApi } from "../api/newtApi.js";
import { workflowContextPayload } from "../workflowContext.js";
import { normalizeVideoGenerationResult } from "./videoModels.js";
import { selectedSeedanceDraft, finishedSeedanceDraftState, seedanceDraftsToFinish, seedanceVersion } from "../seedanceDraft.js";

export async function finishSeedanceDraft({ node, workflowContext, getCurrent, update, receiptIds, groupId, complete = nodeApi.completeSeedanceDraft }) {
  if (node.data.status === "running") return { status: "skipped" };
  const selected = selectedSeedanceDraft(node.data);
  if (receiptIds === undefined && selected) {
    const receiptId = selected.seedanceDraft.receiptId;
    const finished = node.data.resultItems.find(item => item.seedanceDraftSource === receiptId);
    if (finished) {
      update(finishedSeedanceDraftState(node.data, receiptId, finished));
      return { status: "complete", items: [] };
    }
  }
  const requested = new Set(receiptIds ?? [selected?.seedanceDraft.receiptId]);
  const drafts = seedanceDraftsToFinish(node.data.resultItems).filter(item => requested.has(item.seedanceDraft.receiptId));
  if (!drafts.length) return { status: "skipped" };

  const operation = crypto.randomUUID();
  update({ status: "running", seedanceFinishing: operation, error: "" });
  const context = workflowContextPayload(workflowContext);
  const outcomes = await Promise.allSettled(drafts.map(async (draft, index) => {
    const receiptId = draft.seedanceDraft.receiptId;
    const result = await complete({ receiptId, ...context, nodeId: node.id, nodeTitle: node.data.title,
      draftCompletionDestination: true, previewFileName: draft.seedanceDraftExportFileName || draft.fileName || draft.url,
      generationGroupId: groupId, generationBatchIndex: index + 1, generationBatchTotal: drafts.length });
    return { ...normalizeVideoGenerationResult(result, index), seedanceDraftSource: receiptId };
  }));
  const current = getCurrent();
  if (current?.data.seedanceFinishing !== operation || current.data.status !== "running") return { status: "skipped" };
  let resultState = {};
  const items = [], errors = [];
  for (const [index, outcome] of outcomes.entries()) {
    const draft = drafts[index];
    if (outcome.status === "fulfilled") {
      const item = outcome.value;
      const version = seedanceVersion(item, current.data.resultItems);
      items.push({ ...item, label: version.label });
      resultState = finishedSeedanceDraftState({ ...current.data, ...resultState }, draft.seedanceDraft.receiptId, items.at(-1));
    } else {
      errors.push(`${seedanceVersion(draft).name}: ${outcome.reason?.message || outcome.reason}`);
    }
  }
  const status = items.length ? "complete" : "error";
  const error = [...errors, ...items.map(item => item.warning).filter(Boolean)].join(" ");
  update({ ...resultState, status, seedanceFinishing: "", error });
  return { status, items, error };
}
