import React from "react";
import { collectionMaxRows, collectionRows, collectionFrameHeight, collectionHeightFromDrag, collectionRowsFromHeight } from "../collectionFrame.js";

export default function CollectionResizeHandle({ rows, onChange, frameRef, label = "My collection" }) {
  const drag = React.useRef(null), element = React.useRef(null), animation = React.useRef(null);
  const [dragging, setDragging] = React.useState(false), [previewRows, setPreviewRows] = React.useState(rows);
  function paint(height) {
    const frame = frameRef.current, count = collectionRowsFromHeight(height);
    if (!frame) return;
    frame.dataset.resizing = "true";
    frame.style.setProperty("--collection-frame-height", `${height}px`);
    frame.style.setProperty("--collection-rows", count);
    setPreviewRows(current => current === count ? current : count);
  }
  const finish = React.useCallback((cancel = false) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (animation.current !== null) { cancelAnimationFrame(animation.current); animation.current = null; }
    const nextRows = cancel ? current.rows : collectionRowsFromHeight(current.height);
    const frame = frameRef.current;
    if (frame) {
      // Freeze the last pointer position before easing to a whole row.
      frame.style.setProperty("--collection-frame-height", `${current.height}px`);
      frame.getBoundingClientRect();
      frame.style.setProperty("--collection-rows", nextRows);
      delete frame.dataset.resizing;
      frame.style.removeProperty("--collection-frame-height");
    }
    onChange(nextRows); setDragging(false);
    if (element.current?.hasPointerCapture(current.pointerId)) element.current.releasePointerCapture(current.pointerId);
  }, [frameRef, onChange]);
  React.useEffect(() => {
    const blur = () => finish();
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("blur", blur); drag.current = null;
      if (animation.current !== null) cancelAnimationFrame(animation.current);
      const frame = frameRef.current;
      if (frame) {
        delete frame.dataset.resizing;
        frame.style.removeProperty("--collection-frame-height");
        frame.style.setProperty("--collection-rows", frame.dataset.rowCount || rows);
      }
    };
  }, [finish, frameRef]);
  function move(event) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) { finish(); return; }
    event.preventDefault();
    current.height = collectionHeightFromDrag(current.rows, event.clientY - current.y, current.startHeight);
    if (animation.current === null) animation.current = requestAnimationFrame(() => { animation.current = null; if (drag.current) paint(drag.current.height); });
  }
  const shownRows = dragging ? previewRows : rows;
  return <div className="collection-resize-rail"><div ref={element} className={`collection-resize-tab ${dragging ? "dragging" : ""}`} role="separator" aria-label={`Resize ${label} rows`} aria-orientation="horizontal" aria-valuemin={1} aria-valuemax={collectionMaxRows} aria-valuenow={shownRows} aria-valuetext={`${shownRows} ${shownRows === 1 ? "row" : "rows"}`} tabIndex={0}
    title="Drag to resize. Arrow keys adjust rows. Double-click to reset."
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus();
      const height = Number.parseFloat(getComputedStyle(frameRef.current).height) || collectionFrameHeight(rows);
      drag.current = { pointerId: event.pointerId, y: event.clientY, rows, height, startHeight: height };
      event.currentTarget.setPointerCapture(event.pointerId); setPreviewRows(rows); setDragging(true); paint(height);
    }}
    onPointerMove={move} onPointerUp={event => {
      if (drag.current?.pointerId === event.pointerId) { drag.current.height = collectionHeightFromDrag(drag.current.rows, event.clientY - drag.current.y, drag.current.startHeight); finish(); }
    }} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}
    onDoubleClick={() => { finish(true); onChange(1); }}
    onKeyDown={event => {
      if (event.key === "Escape") { finish(true); return; }
      const next = event.key === "ArrowDown" ? rows + 1 : event.key === "ArrowUp" ? rows - 1 : event.key === "Home" ? 1 : event.key === "End" ? collectionMaxRows : null;
      if (next !== null) { event.preventDefault(); finish(true); onChange(collectionRows(next)); }
    }}><span className="collection-resize-grip" aria-hidden="true"/></div></div>;
}
