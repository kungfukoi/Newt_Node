import React from "react";
import { GripHorizontal } from "lucide-react";
import { collectionMaxRows, collectionRows, collectionRowsFromDrag } from "../collectionFrame.js";

export default function CollectionResizeHandle({ rows, onChange }) {
  const drag = React.useRef(null), element = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  const finish = React.useCallback(() => {
    const current = drag.current; drag.current = null; setDragging(false);
    if (current && element.current?.hasPointerCapture(current.pointerId)) element.current.releasePointerCapture(current.pointerId);
  }, []);
  React.useEffect(() => {
    window.addEventListener("blur", finish);
    return () => { window.removeEventListener("blur", finish); drag.current = null; };
  }, [finish]);
  function move(event) {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) { finish(); return; }
    event.preventDefault(); onChange(collectionRowsFromDrag(drag.current.rows, event.clientY - drag.current.y));
  }
  return <div className="collection-resize-rail"><div ref={element} className={`collection-resize-tab ${dragging ? "dragging" : ""}`} role="separator" aria-label="Resize My collection rows" aria-orientation="horizontal" aria-valuemin={1} aria-valuemax={collectionMaxRows} aria-valuenow={rows} aria-valuetext={`${rows} ${rows === 1 ? "row" : "rows"}`} tabIndex={0}
    title="Drag down for more rows, up for fewer. Arrow keys resize. Double-click for one row."
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); drag.current = { pointerId: event.pointerId, y: event.clientY, rows }; event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
    onPointerMove={move} onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) { onChange(collectionRowsFromDrag(drag.current.rows, event.clientY - drag.current.y)); finish(); } }} onPointerCancel={finish} onLostPointerCapture={finish}
    onDoubleClick={() => { finish(); onChange(1); }}
    onKeyDown={event => {
      if (event.key === "Escape") { finish(); return; }
      const next = event.key === "ArrowDown" ? rows + 1 : event.key === "ArrowUp" ? rows - 1 : event.key === "Home" ? 1 : event.key === "End" ? collectionMaxRows : null;
      if (next !== null) { event.preventDefault(); finish(); onChange(collectionRows(next)); }
    }}><GripHorizontal size={20} aria-hidden="true"/><span>{rows} {rows === 1 ? "row" : "rows"}</span></div></div>;
}
