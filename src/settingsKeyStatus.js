export function providerMetricValue(configured, validation, checking = false) {
  if (!configured) return "Not set";
  if (checking && !validation) return "Checking";
  if (validation?.status === "valid") return "Valid";
  if (validation?.status === "invalid") return "Invalid";
  if (validation?.status === "unverified") return "Unverified";
  return checking ? "Checking" : "Configured";
}

export function providerMetricTone(configured, validation) {
  if (!configured) return "";
  if (validation?.status === "valid") return "good";
  if (validation?.status === "invalid") return "bad";
  if (validation?.status === "unverified") return "warn";
  return "";
}

export function keyDetail(source, status, useSettingsOverride = false, validation) {
  const sourceLabel = source === "env" ? ".env" : source === "settings" ? "Settings" : "";
  const validationLabel = validation?.status === "valid"
    ? "Verified"
    : validation?.status === "invalid"
      ? "Rejected"
      : validation?.status === "unverified"
        ? "Could not verify"
        : "";
  const details = [validationLabel, sourceLabel].filter(Boolean);
  if (details.length) return details.join(" / ");
  if (useSettingsOverride) return "Settings override not set";
  if (status !== "loading" && status !== "error") return ".env key not set";
  return statusLabel(status);
}

export function unverifiedKeyValidation(settings) {
  return {
    fal: settings?.falKeyConfigured ? { status: "unverified", reason: "validation-request-failed" } : { status: "missing" },
    google: settings?.googleApiKeyConfigured ? { status: "unverified", reason: "validation-request-failed" } : { status: "missing" },
    krea: settings?.kreaApiKeyConfigured ? { status: "unverified", reason: "validation-request-failed" } : { status: "missing" },
    openAi: settings?.openAiApiKeyConfigured ? { status: "unverified", reason: "validation-request-failed" } : { status: "missing" }
  };
}

function statusLabel(status) {
  if (status === "loading") return "Loading";
  if (status === "error") return "Check server";
  return "Ready";
}
