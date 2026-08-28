const maxTextPromptHistory = 50;

export function normalizeTextPromptHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((prompt) => String(prompt ?? ""))
    .filter((prompt) => prompt.trim())
    .filter((prompt, index, prompts) => index === 0 || prompt !== prompts[index - 1])
    .slice(-maxTextPromptHistory);
}

export function appendTextPromptHistory(value, prompt) {
  const history = normalizeTextPromptHistory(value);
  const nextPrompt = String(prompt ?? "");
  if (!nextPrompt.trim() || history.at(-1) === nextPrompt) return history;
  return [...history, nextPrompt].slice(-maxTextPromptHistory);
}

export function recallTextPrompt({ history: value, index, direction, currentText = "", draft = "" }) {
  const history = normalizeTextPromptHistory(value);
  if (!history.length) return { text: currentText, index: null, draft };

  const activeIndex = Number.isInteger(index) && index >= 0 && index < history.length ? index : null;
  if (direction === "previous") {
    const nextIndex = activeIndex === null ? history.length - 1 : Math.max(0, activeIndex - 1);
    return {
      text: history[nextIndex],
      index: nextIndex,
      draft: activeIndex === null ? currentText : draft
    };
  }

  if (direction === "next" && activeIndex !== null) {
    const nextIndex = activeIndex + 1;
    if (nextIndex < history.length) return { text: history[nextIndex], index: nextIndex, draft };
    return { text: draft, index: null, draft: "" };
  }

  return { text: currentText, index: activeIndex, draft };
}
