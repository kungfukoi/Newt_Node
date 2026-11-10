import React from "react";
import { lookGradeBinding, lookGradeStart, releaseLookGrade } from "./lookGrade.js";

// Local palette extraction only. Look analysis and provider calls live elsewhere.
export function useLookGrades(nodes, updateNode, extractPalette) {
  const latest = React.useRef(nodes), pending = React.useRef(new Map());
  const callbacks = React.useRef({ updateNode, extractPalette });
  React.useLayoutEffect(() => { latest.current = nodes; callbacks.current = { updateNode, extractPalette }; });
  React.useEffect(() => {
    const ids = new Set(nodes.map(node => node.id));
    for (const id of pending.current.keys()) if (!ids.has(id)) pending.current.delete(id);
    for (const node of nodes) {
      if (node.type !== "style") continue;
      const binding = lookGradeBinding(node.data.libraryStyle);
      if (!binding) {
        pending.current.delete(node.id);
        if (node.data.customPaletteLookKey) callbacks.current.updateNode(node.id, releaseLookGrade(node.data));
        continue;
      }
      if (node.data.customPaletteLookOverride) { pending.current.delete(node.id); continue; }
      if (node.data.customPaletteLookKey === binding.key) {
        // An interrupted local extraction can resume when a workflow is reopened.
        if (node.data.customPaletteColors?.length || node.data.customPaletteError) continue;
      }
      if (pending.current.get(node.id)?.key === binding.key) continue;
      const job = { key: binding.key };
      pending.current.set(node.id, job);
      callbacks.current.updateNode(node.id, lookGradeStart(binding));
      const isCurrent = () => pending.current.get(node.id) === job && latest.current.some(current => current.id === node.id && !current.data.customPaletteLookOverride && lookGradeBinding(current.data.libraryStyle)?.key === binding.key);
      Promise.resolve().then(() => callbacks.current.extractPalette(binding.reference.localUrl)).then(extracted => {
        if (!isCurrent()) return;
        if (!extracted.colors?.length) throw new Error("No usable colors found in the Look’s first example.");
        callbacks.current.updateNode(node.id, { customPaletteLookKey: binding.key, customPaletteStatus: "", customPaletteError: "", customPaletteColors: extracted.colors,
          customPalettePicker: extracted.colors[0].hex, customPalettePreviewUrl: binding.reference.localUrl });
      }).catch(error => {
        if (isCurrent()) callbacks.current.updateNode(node.id, { customPaletteStatus: "", customPaletteError: error.message || "Could not extract the Look’s grade." });
      }).finally(() => { if (pending.current.get(node.id) === job) pending.current.delete(node.id); });
    }
  }, [nodes]);
  React.useEffect(() => () => { pending.current.clear(); }, []);
}
