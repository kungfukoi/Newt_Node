import { nodeTypeDefinitions } from "./nodeRegistry.js";

// Different units deliberately have different denominators.
export function usageRows(events, catalog, { range = "30", now = new Date() } = {}) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (range !== "all") start.setDate(start.getDate() - (Number(range) - 1));
  const groups = new Map(catalog.map(({ id, name }) => [id, { id, name, count: 0, lifetime: 0, lastUsed: "" }]));
  for (const event of events) {
    const date = new Date(event.at);
    if (!event.id || !Number.isFinite(date.getTime()) || date > now) continue;
    const row = groups.get(event.id) || { id: event.id, name: event.name || event.id, count: 0, lifetime: 0, lastUsed: "" };
    const count = Number(event.count) || 1;
    row.lifetime += count;
    if (range === "all" || date >= start) row.count += count;
    if (!row.lastUsed || date > new Date(row.lastUsed)) row.lastUsed = date.toISOString();
    groups.set(event.id, row);
  }
  const total = [...groups.values()].reduce((sum, row) => sum + row.count, 0);
  return [...groups.values()].map(row => ({ ...row, share: total ? row.count / total : 0,
    signal: !row.lifetime ? "No recorded use" : !row.count ? "Inactive in period" : row.count / total < 0.05 ? "Niche" : "Active"
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export const usageNodeCatalog = nodeTypeDefinitions.map(node => ({ id: node.type, name: `${node.label}${node.catalog === false ? " (hidden / legacy)" : ""}` }));

export function nodeUsageEvents(days = [], action = "run") {
  return days.filter(row => row.action === action).map(row => ({ id: row.type, at: row.lastUsed, count: row.count }));
}

export function modelUsageEvents(history = []) {
  return history.map(row => ({ id: row.modelName || "Unknown model", at: row.createdAt }));
}
