import React from "react";
import { nodeApi } from "./api/newtApi.js";
import { workflowContextPayload } from "./workflowContext.js";

const unnamed = box => /^Object(?: \d+)?$/i.test(box.label.trim()) && ["move", "remove", "keep"].includes(box.mode);
export function useImageEditBoxNames({ boxes, base, enabled, workflowContext, nodeId, nodeTitle, onNamed, onWarning }) {
  const latest = React.useRef(null), seen = React.useRef(new Set()), queue = React.useRef(Promise.resolve()), mounted = React.useRef(true);
  const [pending, setPending] = React.useState([]);
  latest.current = { boxes, base, enabled, onNamed, onWarning };
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => {
    if (!enabled) return;
    for (const box of boxes.filter(unnamed)) {
      const key = `${base.url}:${box.id}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key); setPending(current => [...current, box.id]);
      const sourceUrl = base.url, expectedLabel = box.label, region = { ...box.source };
      const stillCurrent = () => mounted.current && latest.current.enabled && latest.current.base.url === sourceUrl && latest.current.boxes.some(entry => entry.id === box.id && entry.label === expectedLabel && JSON.stringify(entry.source) === JSON.stringify(region) && unnamed(entry));
      queue.current = queue.current.catch(() => {}).then(async () => {
        try {
          if (!stillCurrent()) return;
          const data = await nodeApi.identifyImageBox({ ...workflowContextPayload(workflowContext), sourceUrl, requestId: crypto.randomUUID(), region, nodeId, nodeTitle });
          if (!stillCurrent()) return;
          if (data.label && data.label !== "Object") latest.current.onNamed({ id: box.id, label: data.label, expectedLabel, region });
          if (data.warning) latest.current.onWarning(data.warning);
        } catch (error) {
          if (stillCurrent()) latest.current.onWarning(`Automatic box naming: ${error.message} You can rename the box manually.`);
        } finally { if (mounted.current) setPending(current => current.filter(id => id !== box.id)); }
      });
    }
  }, [boxes, base.url, enabled, workflowContext, nodeId, nodeTitle]);
  return pending.filter(id => boxes.some(box => box.id === id && unnamed(box)));
}
