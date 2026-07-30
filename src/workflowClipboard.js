export const workflowClipboardStorageKey = "newtnode:workflow-node-clipboard:v1";
export const workflowClipboardType = "newtnode.workflow.nodes";

const workflowClipboardTextPrefix = "NEWTNODE_WORKFLOW_NODES:";

function safeJsonClone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

function normalizedClipboardNode(node) {
  const clone = safeJsonClone(node, null);
  if (!clone || typeof clone !== "object" || !clone.id || !clone.type) return null;
  return {
    ...clone,
    data: clone.data && typeof clone.data === "object" ? clone.data : {}
  };
}

function normalizedClipboardEdge(edge) {
  const clone = safeJsonClone(edge, null);
  if (!clone || typeof clone !== "object" || !clone.from?.nodeId || !clone.to?.nodeId) return null;
  return {
    ...clone,
    from: { ...clone.from },
    to: { ...clone.to }
  };
}

function normalizedClipboardGroup(group) {
  const clone = safeJsonClone(group, null);
  if (!clone || typeof clone !== "object" || !clone.id) return null;
  return {
    ...clone,
    nodeIds: Array.isArray(clone.nodeIds) ? clone.nodeIds : []
  };
}

export function normalizeWorkflowClipboardPayload(value) {
  if (typeof value === "string") return parseWorkflowClipboardText(value);
  if (!value || typeof value !== "object" || !Array.isArray(value.nodes)) return null;

  const nodes = value.nodes.map(normalizedClipboardNode).filter(Boolean);
  if (!nodes.length) return null;

  return {
    type: workflowClipboardType,
    version: 1,
    createdAt: value.createdAt || new Date().toISOString(),
    nodes,
    edges: Array.isArray(value.edges) ? value.edges.map(normalizedClipboardEdge).filter(Boolean) : [],
    groups: Array.isArray(value.groups) ? value.groups.map(normalizedClipboardGroup).filter(Boolean) : []
  };
}

export function createWorkflowClipboardPayload({ nodes = [], edges = [], groups = [] } = {}) {
  return normalizeWorkflowClipboardPayload({
    type: workflowClipboardType,
    version: 1,
    createdAt: new Date().toISOString(),
    nodes,
    edges,
    groups
  });
}

export function serializeWorkflowClipboardPayload(payload) {
  const normalized = normalizeWorkflowClipboardPayload(payload);
  if (!normalized) return "";
  return `${workflowClipboardTextPrefix}${JSON.stringify(normalized)}`;
}

export function parseWorkflowClipboardText(text) {
  const source = String(text || "").trim();
  if (!source) return null;

  const hasPrefix = source.startsWith(workflowClipboardTextPrefix);
  const json = hasPrefix ? source.slice(workflowClipboardTextPrefix.length) : source;
  let parsed = null;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!hasPrefix && parsed?.type !== workflowClipboardType) return null;
  return normalizeWorkflowClipboardPayload(parsed);
}

export function writeWorkflowClipboardToStorage(payload, storage = globalThis.localStorage) {
  const serialized = serializeWorkflowClipboardPayload(payload);
  if (!serialized || !storage?.setItem) return false;

  try {
    storage.setItem(workflowClipboardStorageKey, serialized);
    return true;
  } catch {
    return false;
  }
}

export function readWorkflowClipboardFromStorage(storage = globalThis.localStorage) {
  if (!storage?.getItem) return null;

  try {
    return parseWorkflowClipboardText(storage.getItem(workflowClipboardStorageKey));
  } catch {
    return null;
  }
}

export async function writeWorkflowClipboardToSystemClipboard(payload, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) return false;
  const serialized = serializeWorkflowClipboardPayload(payload);
  if (!serialized) return false;

  try {
    await clipboard.writeText(serialized);
    return true;
  } catch {
    return false;
  }
}

export async function readWorkflowClipboardFromSystemClipboard(clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.readText) return null;

  try {
    return parseWorkflowClipboardText(await clipboard.readText());
  } catch {
    return null;
  }
}
