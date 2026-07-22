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

export function keyDetail(activeLabel, status, validation) {
  const validationLabel = validation?.status === "valid"
    ? "Verified"
    : validation?.status === "invalid"
      ? "Rejected"
      : validation?.status === "unverified"
        ? "Could not verify"
        : "";
  const details = [validationLabel, String(activeLabel || "").trim()].filter(Boolean);
  if (details.length) return details.join(" / ");
  if (status !== "loading" && status !== "error") return "No active key";
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
