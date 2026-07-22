const preferredErrorKeys = ["message", "msg", "detail", "error_description", "error", "errors", "reason"];

export function apiErrorMessage(value, fallback = "Request failed.") {
  return errorDetail(value, new Set()) || String(fallback || "Request failed.").trim();
}

function errorDetail(value, seen) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Error) return String(value.message || value.name || "").trim();

  if (Array.isArray(value)) {
    return value
      .map((item) => errorDetail(item, seen))
      .filter(Boolean)
      .join("; ");
  }

  if (typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);

  let detail = "";
  for (const key of preferredErrorKeys) {
    if (!(key in value)) continue;
    detail = errorDetail(value[key], seen);
    if (detail) break;
  }

  const location = Array.isArray(value.loc)
    ? value.loc.filter((part) => part !== "body").map(String).filter(Boolean).join(".")
    : "";
  if (detail) return location ? `${location}: ${detail}` : detail;

  try {
    const serialized = JSON.stringify(value);
    return serialized && serialized !== "{}" ? serialized.slice(0, 700) : "";
  } catch {
    return "";
  }
}
