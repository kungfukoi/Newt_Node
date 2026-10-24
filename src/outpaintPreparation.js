import { normalizeVideoOutpaintSettings } from "./videoOutpaint.js";

export function lastOutpaintPreparation(data = {}) {
  return data.videoOutpaintPrepared || [...(data.resultItems || [])].reverse().find(item => item.videoOutpaint?.prepared?.videoUrl && item.videoOutpaint?.prepared?.plan?.settings)?.videoOutpaint.prepared || null;
}

export function preparedOutpaintSettings(prepared, current) {
  const settings = normalizeVideoOutpaintSettings(current);
  if (!prepared?.plan?.settings) return settings;
  return normalizeVideoOutpaintSettings({ ...prepared.plan.settings,
    referenceRoles: settings.referenceRoles, restoreSource: settings.restoreSource,
    matchExtensionColor: settings.matchExtensionColor, autoMatch: settings.autoMatch,
    keepAllRepeats: settings.keepAllRepeats,
    ...(settings.model === "wan-vace" ? { outputSize: settings.outputSize } : {})
  });
}

export function outpaintPreparationError(prepared, sourceUrl, canvasUrl, model) {
  if (!prepared?.plan?.settings || !prepared.videoUrl || !prepared.generationVideoUrl || !prepared.maskImageUrl) return "Prepare canvas & mask before running outpainting.";
  if ((prepared.canvasVideoUrl || prepared.sourceUrl) !== (canvasUrl || sourceUrl)) return "Source changed. Prepare a new canvas before analyzing or running.";
  if (prepared.plan.settings.model !== model) return "Outpaint model changed. Prepare a new canvas before analyzing or running.";
  return "";
}
