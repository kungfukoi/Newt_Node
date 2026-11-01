// Remove only Newt's former stock preamble; retain the actual visual description.
export function lookStyleText(value = "") {
  return String(value).trim().replace(/^Preserve\s+(?:the\s+)?(?:user['’]s\s+)?requested subject and composition(?:\s+while applying(?:\s+this visual treatment)?)?\s*[.:]?\s*/i, "").trim();
}
