import { uiStateApi } from "./api/newtApi.js";

const draftKey = "seedance-node-editor-draft-v1";
const cacheKey = "newt.workspace-recovery";
let state = {}, sessionId = "", revision = 0, saveTimer = null, pending = Promise.resolve(), changedAt = 0;
let status = "";
const listeners = new Set();
export const uiSaveStatus = () => status;
export function subscribeUiSave(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function report(message) { status = message; for (const listener of listeners) listener(); }
function session() {
  if (sessionId) return sessionId;
  // Duplicating a tab can copy sessionStorage. A document-local ID prevents two
  // simultaneously open windows from writing the same server slot. Reload still
  // restores its own sessionStorage draft and preferences before saving a new slot.
  sessionId = globalThis.crypto.randomUUID();
  return sessionId;
}
function cache() {
  const raw = JSON.stringify({ state, revision, updatedAt: changedAt });
  try {
    window.sessionStorage.setItem(cacheKey, raw);
    window.localStorage.setItem(cacheKey, raw);
  } catch { report("Workspace browser backup is full or unavailable. Keep this window open until server recovery saves."); }
}
export function uiGet(key, fallback) { return state[key] ?? fallback; }
export function uiSet(key, value) {
  if (JSON.stringify(state[key]) === JSON.stringify(value)) return;
  state = { ...state, [key]: value };
  scheduleSave();
}
export function uiMirrorDraft(raw) {
  try { state = { ...state, draft: JSON.parse(raw) }; } catch { return; }
  scheduleSave();
}
function scheduleSave() {
  changedAt = Date.now();
  cache();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(), 1500);
}
export function saveNow({ closing = false } = {}) {
  clearTimeout(saveTimer); saveTimer = null;
  const payload = { sessionId: session(), revision: ++revision, state: structuredClone(state) };
  cache();
  const send = async () => {
    try { await uiStateApi.save(payload, { closing }); report(""); }
    catch { report("Workspace recovery could not be saved to the server. Save your project or retry before closing."); }
  };
  // Closing requests may overtake an in-flight save; server revisions prevent rollback.
  if (closing) return send();
  pending = pending.then(send, send);
  return pending;
}
export async function loadUiState() {
  let cached;
  try { cached = JSON.parse(window.sessionStorage.getItem(cacheKey) || "null"); } catch { /* unavailable */ }
  try {
    const loaded = await uiStateApi.load(session());
    state = loaded.state || {};
    revision = loaded.revision || 0;
    // A fresh window may have a newer browser backup when its final large-graph request was interrupted.
    if (!cached) {
      try {
        const last = JSON.parse(window.localStorage.getItem(cacheKey) || "null");
        if (last?.updatedAt > (loaded.updatedAt || 0)) cached = last;
      } catch { /* unavailable */ }
    }
  } catch {
    try { cached ||= JSON.parse(window.localStorage.getItem(cacheKey) || "null"); } catch { /* unavailable */ }
    report("Workspace recovery server is unavailable. Browser recovery is being used; restart the backend if needed.");
  }
  if (cached?.state) { state = cached.state; revision = Math.max(revision, cached.revision || 0); changedAt = cached.updatedAt || 0; }
  try {
    const existing = window.sessionStorage.getItem(draftKey) || window.localStorage.getItem(draftKey);
    if (existing) state = { ...state, draft: JSON.parse(existing) };
    else if (state.draft) window.sessionStorage.setItem(draftKey, JSON.stringify(state.draft));
  } catch { /* normal draft loader handles invalid/unavailable storage */ }
  return state;
}
export function installUiStateFlush() {
  const flush = () => { if (saveTimer) void saveNow({ closing: true }); };
  const hidden = () => { if (document.visibilityState === "hidden") flush(); };
  document.addEventListener("visibilitychange", hidden);
  // Run after draft persistence has mirrored its final pagehide snapshot.
  const pagehide = () => queueMicrotask(flush);
  window.addEventListener("pagehide", pagehide);
  return () => { document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", pagehide); };
}
