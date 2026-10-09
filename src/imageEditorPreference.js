import { settingsApi } from "./api/newtApi.js";
import { normalizeImageEditModel } from "./imageEdit.js";
import { normalizeUserPreferences } from "./userPreferences.js";

export async function saveImageEditorModel(value) {
  const model = normalizeImageEditModel(value);
  // Read the latest preferences so changing the model cannot reset unrelated choices.
  const current = await settingsApi.load({ includeSecrets: false });
  const preferences = { ...normalizeUserPreferences(current.userPreferences), imageEditorModel: model };
  const saved = await settingsApi.save({ userPreferences: preferences });
  const next = normalizeUserPreferences(saved.userPreferences);
  if (next.imageEditorModel !== model) throw new Error("The image editor model was not saved. Try again.");
  window.dispatchEvent(new CustomEvent("newtnode:user-preferences-updated", { detail: next }));
  return next;
}
