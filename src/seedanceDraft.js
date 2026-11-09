import { isSeedance25Model } from "./seedance25.js";

export const seedanceDraftCompletionEndpoint = "bytedance/seedance-2.5/draft/complete";
export const seedanceAtlasDraftCompletionEndpoint = "bytedance/seedance-2.5/draft-complete";
export const seedanceDraftSuffix = "_draft";
export const seedanceDraftLifetimeMs = 7 * 24 * 60 * 60 * 1000;
export const supportsSeedanceDraft = provider => ["fal", "atlas", "krea"].includes(provider);
export const seedanceDraftProviderName = provider => ({ fal: "Fal", atlas: "Atlas Cloud", krea: "Krea" })[provider || "fal"] || "original provider";
export const seedanceDraftHint = provider => provider === "krea"
  ? "Krea preview only. Its API does not offer finishing this draft at 1080p; turning Draft off starts a new full-resolution generation."
  : "480p preview. Finish selected drafts at 1080p within seven days using the same provider and key; each stage is billed separately.";

export function validateSeedanceDraft({ model, seedanceDraft, provider } = {}) {
  if (seedanceDraft !== undefined && typeof seedanceDraft !== "boolean") {
    throw Object.assign(new Error("Draft mode must be on or off."), { status: 400 });
  }
  if (!seedanceDraft) return false;
  if (!isSeedance25Model(model) || !supportsSeedanceDraft(provider)) {
    throw Object.assign(new Error("Draft mode requires Seedance 2.5 with an enabled Fal, Atlas Cloud, or Krea key. Krea supports previews only."), { status: 400 });
  }
  return true;
}

export function seedanceDraftCost(stage = "preview", provider = "fal") {
  return { amountUsd: null, currency: "USD", estimated: true, mediaType: "video", pricingStatus: "unavailable",
    pricingBasis: `Seedance draft ${stage} is billed separately by ${seedanceDraftProviderName(provider)}; no verified estimate is available.` };
}

export function selectedSeedanceDraft(data = {}) {
  const items = data.resultItems || [];
  const item = items[data.selectedResultIndex || 0];
  return item?.seedanceDraft?.receiptId && item.seedanceDraft.completionSupported !== false ? item : null;
}

export function seedanceDraftsToFinish(resultItems, now = Date.now()) {
  const items = Array.isArray(resultItems) ? resultItems.filter(Boolean) : [];
  const unavailable = new Set(items.map(item => item.seedanceDraftSource).filter(Boolean));
  return items.filter(({ seedanceDraft: draft }) => {
    if (!draft?.receiptId || draft.completionSupported === false || unavailable.has(draft.receiptId)) return false;
    if (Date.parse(draft.expiresAt) <= now) return false;
    unavailable.add(draft.receiptId);
    return true;
  });
}

export function seedanceDraftFileStem(fileName) {
  return String(fileName || "").split(/[\\/]/).at(-1).replace(/\.[^.]+$/, "");
}

export function seedanceDraftPairStem(fileName) {
  return seedanceDraftFileStem(fileName).replace(/_draft$/i, "");
}

export function seedanceDraftDeliveryContext(item, items = [], fileNameTemplate = "") {
  if (item?.seedanceDraft) return { seedanceDraftOutput: true };
  if (!item?.seedanceDraftSource) return {};
  const draft = items?.find(result => result?.seedanceDraft?.receiptId === item.seedanceDraftSource);
  const pairedFileName = item.seedanceDraftDeliveryFileName || (draft?.seedanceDraftExportFileName
    ? seedanceDraftPairStem(draft.seedanceDraftExportFileName) + ".mp4" : "");
  if (pairedFileName) return { outputTargetFileName: "$filename", outputTargetSourceFileName: pairedFileName, seedanceFinishedFileName: pairedFileName };
  const previewFileName = item.seedanceDraftPreviewFileName || draft?.fileName;
  if (!previewFileName) return {};
  const template = String(fileNameTemplate || "").trim();
  return {
    outputTargetFileName: !template || template === "$node_$date_$time" ? "$filename" : template,
    outputTargetSourceFileName: previewFileName
  };
}

export function seedanceVersion(item, items = []) {
  if (!item?.seedanceDraft && !item?.seedanceDraftSource) return null;
  const draft = item.seedanceDraft ? item : items?.find(result => result?.seedanceDraft?.receiptId === item.seedanceDraftSource);
  const name = seedanceDraftPairStem(draft?.seedanceDraftExportFileName || item.seedanceDraftPreviewFileName || draft?.fileName)
    || draft?.label?.replace(/ \(480p\)$/, "") || "Seedance draft";
  const quality = item.seedanceDraftSource ? "HD · 1080p" : "Draft · 480p";
  return { name, quality, label: `${name} (${quality})` };
}

export function finishedSeedanceDraftState(data, receiptId, item) {
  const items = [...(data.resultItems || [])];
  let index = items.findIndex(result => result.seedanceDraftSource === receiptId);
  if (index < 0) { index = items.length; items.push(item); }
  return { resultItems: items, resultUrl: items[index].url, selectedResultIndex: index, resultType: "video" };
}
