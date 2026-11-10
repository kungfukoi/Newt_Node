import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const arrowDirections = { ArrowLeft: -1, ArrowRight: 1 };

export default function LookbookShuttle({ frameRef, previewCount, rows }) {
  const handleRef = React.useRef(null);
  const gesture = React.useRef(null);
  const [canScroll, setCanScroll] = React.useState(false);
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const stop = React.useCallback(() => {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    cancelAnimationFrame(current.animation);
    if (current.pointerId != null && handleRef.current?.hasPointerCapture(current.pointerId)) {
      handleRef.current.releasePointerCapture(current.pointerId);
    }
    setOffset(0);
    setDragging(false);
  }, []);

  React.useLayoutEffect(() => {
    const frame = frameRef.current;
    function measure() {
      const overflow = frame.scrollWidth > frame.clientWidth;
      setCanScroll(overflow);
      if (!overflow) stop();
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef, previewCount, rows, stop]);

  React.useEffect(() => {
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("blur", stop);
      if (gesture.current) cancelAnimationFrame(gesture.current.animation);
      gesture.current = null;
    };
  }, [stop]);

  function tick(time) {
    const current = gesture.current;
    if (!current) return;
    const elapsed = Math.max(0, Math.min(time - current.lastTime, 34));
    current.lastTime = time;
    // Keep fractional movement so small pulls still scroll on fast displays.
    const distance = current.remainder + current.speed * elapsed / 1000;
    const pixels = Math.trunc(distance);
    current.remainder = distance - pixels;
    if (pixels) frameRef.current.scrollLeft += pixels;
    current.animation = requestAnimationFrame(tick);
  }

  function start(input) {
    gesture.current = { ...input, speed: 0, remainder: 0, lastTime: performance.now(), animation: requestAnimationFrame(tick) };
  }

  function deflect(travel) {
    const current = gesture.current;
    const magnitude = Math.max(0, (Math.abs(travel) - 0.04) / 0.96);
    const speed = Math.sign(travel) * 4200 * magnitude ** 1.6;
    if (Math.sign(speed) !== Math.sign(current.speed)) current.remainder = 0;
    current.speed = speed;
    setOffset(travel * current.maxOffset);
  }

  function maxOffset(handle) {
    return Math.max(1, (handle.parentElement.clientWidth - handle.offsetWidth) / 2 - 4);
  }

  function onPointerDown(event) {
    if (event.button !== 0 || !event.isPrimary || gesture.current) return;
    const handle = event.currentTarget;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    start({ pointerId: event.pointerId, startX: event.clientX, maxOffset: maxOffset(handle) });
    setDragging(true);
  }

  function onPointerMove(event) {
    const current = gesture.current;
    if (current?.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && !event.buttons) {
      stop();
      return;
    }
    const travel = (event.clientX - current.startX) / current.maxOffset;
    deflect(Math.max(-1, Math.min(1, travel)));
  }

  function onPointerEnd(event) {
    if (gesture.current?.pointerId === event.pointerId) stop();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      stop();
      return;
    }
    const direction = arrowDirections[event.key];
    if (!direction) return;
    event.preventDefault();
    if (event.repeat || gesture.current?.pointerId != null) return;
    if (!gesture.current) start({ maxOffset: maxOffset(event.currentTarget) });
    gesture.current.key = event.key;
    frameRef.current.scrollLeft += direction * 36;
    deflect(direction * 0.5);
  }

  return <div className="lookbook-shuttle">
    <button ref={handleRef} type="button" className="lookbook-shuttle-handle" disabled={!canScroll}
      aria-label="Preview scroll shuttle" aria-keyshortcuts="ArrowLeft ArrowRight"
      aria-description="Drag left or right to scroll. Pull farther to go faster. Release to stop, or hold an arrow key to scroll."
      title="Drag left or right to scroll. Pull farther to go faster."
      data-dragging={dragging} style={{ transform: `translateX(${offset}px)` }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onLostPointerCapture={onPointerEnd}
      onBlur={stop} onKeyDown={onKeyDown} onKeyUp={event => { if (gesture.current?.key === event.key) stop(); }}>
      <ChevronLeft size={14} aria-hidden="true"/>
      <ChevronRight size={14} aria-hidden="true"/>
    </button>
  </div>;
}
