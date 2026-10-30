import React from "react";
import { ResultPane } from "./MediaViews.jsx";
import { NodeRow } from "./NodePorts.jsx";
import { normalizedResultItems } from "../mediaResults.js";
import { outpaintOutputItem, outpaintPlatePreview } from "../outpaintPreview.js";

export function OutpaintResultPane({ node, onUpdate, ...props }) {
  const items = normalizedResultItems(props.resultItems, props.resultUrl, props.type);
  const index = Math.min(Math.max(Number(props.selectedIndex) || 0, 0), Math.max(0, items.length - 1));
  const selected = items[index];
  const plate = outpaintPlatePreview(selected);
  const composite = node.data.outpaintShowComposite !== false;
  const preview = plate ? composite ? { url: selected.url, rate: 1, offset: 0, label: "Outpaint composite preview" } : plate : undefined;
  const outputItems = items.map(item => outpaintOutputItem(item, composite));
  return <>
    <ResultPane {...props} resultItems={outputItems} onSelectResult={(index) => props.onSelectResult?.(index, items[index])} videoPreview={preview} />
    {plate && <div className="nodrag nowheel" onPointerDown={event => event.stopPropagation()}>
      <NodeRow label="Video output"><label><input type="checkbox" aria-label="Show composited source" title="Use the finished composite when checked, or the generated plate when unchecked. Preview, Output, download and drag use the version shown." checked={composite} onChange={event => onUpdate(node.id, { outpaintShowComposite: event.target.checked })} /> Show composited source</label></NodeRow>
      {!composite && <p className="utility-mini-note" role="status">{plate.label === "Raw generated plate preview" ? "Raw generated plate" : "Generated plate"}</p>}
    </div>}
  </>;
}
