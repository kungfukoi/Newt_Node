import { featureUsageApi } from "./api/newtApi.js";

let warning = "";
export const featureUsageWarning = () => warning;
export function recordFeatureUsage(type, action) {
  // Counts contain no workflow names, prompts, media, model settings or credentials.
  const failed = () => {
    warning = "Some node usage could not be saved during this session. Counts may be incomplete.";
    window.dispatchEvent(new Event("newtnode:feature-usage-warning"));
  };
  try { featureUsageApi.record({ id: crypto.randomUUID(), type, action }).catch(failed); }
  catch { failed(); }
}
