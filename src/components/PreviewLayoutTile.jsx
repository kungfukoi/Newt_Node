import React from "react";

export default function PreviewLayoutTile({ children, className, item, index, style, canDrop, onStart, onEnd, onOver, onDrop, onOpen }) {
  const [dropSide, setDropSide] = React.useState("");
  const sideFor = event => event.clientX >= event.currentTarget.getBoundingClientRect().left + event.currentTarget.getBoundingClientRect().width / 2 ? "after" : "before";
  return <figure className={className + " nodrag nopan" + (dropSide ? " drop-" + dropSide : "")} style={style} draggable
    onMouseDown={event => event.stopPropagation()}
    onDragStart={event => { event.stopPropagation(); onStart(event, item); }}
    onDragEnd={event => { setDropSide(""); onEnd(item, event); }}
    onDragOver={event => { if (!canDrop(event)) return; onOver(event); setDropSide(sideFor(event)); }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropSide(""); }}
    onDrop={event => { setDropSide(""); onDrop(event, item.id, sideFor(event) === "after"); }}
    onDoubleClick={event => onOpen(item, event)}
    title={(item.label || "Layout " + item.type + " " + (index + 1)) + "\nDrag left/right of a tile to reorder, or onto the canvas to copy. Double-click to preview; use Left/Right to browse."}>
    {children}
  </figure>;
}
