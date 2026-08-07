export const outputTokenOptions = Object.freeze(["$node", "$date", "$index", "$time"]);

export function outputSourceNodeTitle(source, fallback = "source") {
  const title = String(source?.data?.title || "").trim();
  if (title) return title;
  return String(fallback || source?.type || "source").trim() || "source";
}

export function insertOutputToken(value, token, selectionStart, selectionEnd = selectionStart) {
  const text = String(value || "");
  const cleanToken = outputTokenOptions.includes(token) ? token : "";
  const start = clampSelection(selectionStart, text.length);
  const end = Math.max(start, clampSelection(selectionEnd, text.length));
  if (!cleanToken) return { value: text, cursor: start };

  return {
    value: `${text.slice(0, start)}${cleanToken}${text.slice(end)}`,
    cursor: start + cleanToken.length
  };
}

function clampSelection(value, length) {
  const number = Number(value);
  if (!Number.isFinite(number)) return length;
  return Math.max(0, Math.min(length, Math.round(number)));
}