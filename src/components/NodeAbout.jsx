import React from "react";
import { createPortal } from "react-dom";

export function NodeAbout({ children }) {
  const id = React.useId();
  const trigger = React.useRef(null);
  const active = React.useRef(false);
  const [position, setPosition] = React.useState(null);
  const close = () => { active.current = false; setPosition(null); };
  const show = () => { active.current = true; open(); };
  function open() {
    if (!active.current) return;
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(360, window.innerWidth - 24);
    setPosition({ width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      ...(rect.top > window.innerHeight / 2
        ? { bottom: window.innerHeight - rect.top + 8, maxHeight: rect.top - 20 }
        : { top: rect.bottom + 8, maxHeight: window.innerHeight - rect.bottom - 20 }) });
  }
  React.useEffect(() => {
    if (!position) return;
    window.addEventListener("scroll", open, true);
    window.addEventListener("resize", open);
    return () => {
      window.removeEventListener("scroll", open, true);
      window.removeEventListener("resize", open);
    };
  }, [position]);
  return <div className="node-about nodrag nopan" onPointerDown={event => event.stopPropagation()}>
    <button ref={trigger} type="button" className="node-about-trigger" aria-describedby={position ? id : undefined}
      onMouseEnter={show} onMouseLeave={close} onFocus={show} onBlur={close}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      About this Node
    </button>
    {position && createPortal(<div id={id} role="tooltip" className="node-about-tooltip" style={position}>{children}</div>, document.body)}
  </div>;
}
