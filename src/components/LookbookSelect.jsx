import React from "react";
import { Check, ChevronDown } from "lucide-react";

export default function LookbookSelect({ label, value, options, onChange }) {
  const [open, setOpen] = React.useState(false), [active, setActive] = React.useState(0);
  const root = React.useRef(null), list = React.useRef(null), typeahead = React.useRef({ text: "", at: 0 });
  const id = React.useId(), selected = Math.max(0, options.findIndex(option => option.value === value));
  function show() { setActive(selected); setOpen(true); }
  function choose(index) { if (options[index]) onChange(options[index].value); setOpen(false); }
  React.useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  React.useEffect(() => { if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [active, open]);
  function keyboard(event) {
    const key = event.key;
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(key)) event.preventDefault();
    if (key === "Escape" || key === "Tab") { setOpen(false); return; }
    if (key === "Enter" || key === " ") { if (open) choose(active); else show(); return; }
    if (key === "ArrowDown" || key === "ArrowUp") {
      if (!open) show(); else setActive(index => (index + (key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
      return;
    }
    if (key === "Home" || key === "End") { setOpen(true); setActive(key === "Home" ? 0 : options.length - 1); return; }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now(), previous = typeahead.current;
      const text = (now - previous.at > 700 ? "" : previous.text) + key.toLowerCase();
      typeahead.current = { text, at: now };
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(text));
      if (index >= 0) { event.preventDefault(); setOpen(true); setActive(index); }
    }
  }
  return <div className="lookbook-select" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined} className={`lookbook-select-trigger ${open ? "open" : ""}`} onClick={() => open ? setOpen(false) : show()} onKeyDown={keyboard}><span>{options[selected]?.label}</span><ChevronDown size={16}/></button>
    {open && <div ref={list} id={id} role="listbox" aria-label={`${label} options`} className="lookbook-select-options">{options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={value === option.value} data-active={index === active} className="lookbook-select-option" onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}><span>{option.label}</span>{value === option.value && <Check size={14} aria-hidden="true"/>}</div>)}</div>}
  </div>;
}
