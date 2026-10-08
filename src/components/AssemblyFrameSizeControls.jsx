import React from "react";

export function AssemblyFrameSizeControls({ width, height, onChange }) {
  return <div className="assembly-frame-size" role="group" aria-label="Preview and render size" title="Canvas dimensions in pixels, used by both the live preview and rendered video">
    <FrameDimension label="Preview width" value={width} onCommit={value => onChange({ outputWidth: value })} />
    <FrameDimension label="Preview height" value={height} onCommit={value => onChange({ outputHeight: value })} />
  </div>;
}

function FrameDimension({ label, value, onCommit }) {
  const [draft, setDraft] = React.useState(String(value));
  const focused = React.useRef(false);
  const cancelled = React.useRef(false);
  React.useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  const commit = () => {
    focused.current = false;
    const number = Number(draft);
    if (cancelled.current || !draft.trim() || !Number.isFinite(number) || number < 16) {
      cancelled.current = false;
      setDraft(String(value));
      return;
    }
    const normalized = Math.max(16, Math.round(number / 2) * 2);
    setDraft(String(normalized));
    if (normalized !== value) onCommit(normalized);
  };
  return <label><span>{label}</span><input aria-label={label} type="number" min="16" step="2" value={draft}
    onFocus={() => { focused.current = true; cancelled.current = false; }}
    onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => {
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        cancelled.current = event.key === "Escape";
        event.currentTarget.blur();
      }
    }} /><small>px</small></label>;
}
