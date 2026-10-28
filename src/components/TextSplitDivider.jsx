import { useRef } from "react";

export default function TextSplitDivider({ value, onChange }) {
  const drag = useRef(null);
  const clamp = ratio => Math.min(.9, Math.max(.1, ratio));
  function finish(event) {
    event.stopPropagation();
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div className="text-split-divider nodrag nopan" role="separator" tabIndex={0}
    aria-label="Response and user prompt split" aria-orientation="horizontal" aria-valuemin={10} aria-valuemax={90} aria-valuenow={Math.round(value * 100)}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
      const before = event.currentTarget.previousElementSibling.getBoundingClientRect();
      const after = event.currentTarget.nextElementSibling.getBoundingClientRect();
      drag.current = { y: event.clientY, value, height: before.height + after.height };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (!drag.current) return;
      event.preventDefault(); event.stopPropagation();
      onChange(clamp(drag.current.value + (event.clientY - drag.current.y) / drag.current.height));
    }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={event => {
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      onChange(event.key === "Home" ? .1 : event.key === "End" ? .9 : clamp(value + (event.key === "ArrowUp" ? -.02 : .02)));
    }} />;
}
