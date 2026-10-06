import React from "react";
import { modelProviderOptionState } from "../modelProviderRouting.js";

export default function ModelProviderOption({ model, mediaType = "image", preferences, availability, disabled = false, children }) {
  const state = modelProviderOptionState(model, mediaType, preferences, availability);
  return <option value={model} disabled={disabled || state.disabled} title={state.reason || undefined} style={disabled || state.disabled ? { color: "#888" } : undefined}>
    {children || model}{state.disabled ? " — unavailable with selected provider" : ""}
  </option>;
}
