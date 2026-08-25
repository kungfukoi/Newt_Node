export const textAgentHistoryLimit = 80;
export const textAgentRequestMessageLimit = 40;

export function normalizeTextAgentMessages(messages = [], limit = textAgentHistoryLimit) {
  if (!Array.isArray(messages)) return [];
  const normalized = messages
    .map((message, index) => {
      const role = message?.role === "assistant" ? "assistant" : message?.role === "user" ? "user" : "";
      const text = String(message?.text ?? message?.content ?? "").trim();
      if (!role || !text) return null;
      return {
        id: String(message?.id || `agent-message-${index}`),
        role,
        text,
        createdAt: String(message?.createdAt || "")
      };
    })
    .filter(Boolean);
  return normalized.slice(-Math.max(1, Number(limit) || textAgentHistoryLimit));
}

export function createTextAgentMessage(role, text, options = {}) {
  const normalizedRole = role === "assistant" ? "assistant" : "user";
  const value = String(text || "").trim();
  if (!value) return null;
  return {
    id: String(options.id || createMessageId()),
    role: normalizedRole,
    text: value,
    createdAt: String(options.createdAt || new Date().toISOString())
  };
}

export function appendTextAgentMessage(messages, message) {
  if (!message) return normalizeTextAgentMessages(messages);
  return normalizeTextAgentMessages([...normalizeTextAgentMessages(messages), message]);
}

export function replaceLatestTextAgentAssistantMessage(messages, text) {
  const normalized = normalizeTextAgentMessages(messages);
  const value = String(text || "").trim();
  let assistantIndex = -1;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    if (normalized[index].role === "assistant") {
      assistantIndex = index;
      break;
    }
  }

  if (assistantIndex < 0) {
    return value ? appendTextAgentMessage(normalized, createTextAgentMessage("assistant", value)) : normalized;
  }
  if (!value) return normalized.filter((_message, index) => index !== assistantIndex);
  return normalized.map((message, index) => index === assistantIndex ? { ...message, text: value } : message);
}

export function textAgentRequestMessages(messages = []) {
  return normalizeTextAgentMessages(messages, textAgentRequestMessageLimit).map(({ role, text }) => ({ role, text }));
}

export function textAgentReferenceText(data = {}, pendingMessage = "") {
  return [
    ...normalizeTextAgentMessages(data.agentMessages).filter((message) => message.role === "user").map((message) => message.text),
    String(pendingMessage || data.agentDraft || "")
  ]
    .filter(Boolean)
    .join("\n");
}

function createMessageId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
