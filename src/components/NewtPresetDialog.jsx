import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { newtPresetInputRoles } from "../newtPresets.js";

export function NewtPresetDialog({ controller }) {
  const [name, setName] = useState("");
  const [slots, setSlots] = useState([]);
  const form = useRef(null);
  const { busy, error, save, cancel } = controller;
  const reusableNodes = (controller.draft?.nodes || []).filter((node) => newtPresetInputRoles[node.type]);

  useEffect(() => {
    const previous = document.activeElement;
    form.current?.querySelector("input")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  function keyDown(event) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(form.current.querySelectorAll("input:not(:disabled), select:not(:disabled), button:not(:disabled), summary"))
      .filter((element) => element.getClientRects().length);
    if (!controls.length) {
      event.preventDefault();
      return;
    }
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="workflow-prompt-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) cancel();
    }}>
      <form
        ref={form}
        className="workflow-prompt newt-preset-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="newt-preset-title"
        onKeyDown={keyDown}
        onPointerDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !busy) save(name, slots);
        }}
      >
        <h2 id="newt-preset-title">Newt Preset</h2>
        <label>
          Preset name
          <input aria-label="Preset name" value={name} maxLength={80} disabled={busy} onChange={(event) => setName(event.target.value)} />
        </label>
        {!!reusableNodes.length && (
          <details className="newt-preset-advanced">
            <summary>Reusable inputs</summary>
            <fieldset className="newt-preset-slots" disabled={busy}>
              {reusableNodes.map((node) => {
                const slot = slots.find((item) => item.nodeId === node.id);
                const roles = newtPresetInputRoles[node.type];
                return (
                  <div key={node.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!slot}
                        onChange={(event) => setSlots((current) => event.target.checked
                          ? [...current, { nodeId: node.id, role: roles[0], label: node.data.title || roles[0] }]
                          : current.filter((item) => item.nodeId !== node.id))}
                      />
                      {node.data.title || roles[0]}
                    </label>
                    {slot && (
                      <select
                        aria-label={`Role for ${slot.label}`}
                        value={slot.role}
                        onChange={(event) => setSlots((current) => current.map((item) => item.nodeId === node.id
                          ? { ...item, role: event.target.value }
                          : item))}
                      >
                        {roles.map((role) => <option key={role}>{role}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </fieldset>
          </details>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="workflow-prompt-actions">
          <button type="button" onClick={cancel} disabled={busy}>Cancel</button>
          <button className="primary" type="submit" disabled={busy || !name.trim()}>{busy ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

export function NewtPresetLibrary({ controller }) {
  const selected = controller.items.find((item) => item.id === controller.selectedId);
  return (
    <section className="newt-preset-library" aria-label="Newt Presets">
      <div className="newt-preset-library-heading">
        <span>Presets</span>
        <button type="button" className="icon-button" onClick={controller.refresh} disabled={controller.busy} title="Refresh presets" aria-label="Refresh presets">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="newt-preset-library-controls">
        <select value={controller.selectedId} onChange={(event) => controller.select(event.target.value)} disabled={controller.busy} aria-label="Newt Preset">
          <option value="">{controller.items.length ? "Select preset" : "No presets saved"}</option>
          {controller.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.nodeCount})</option>)}
        </select>
        <button type="button" className="icon-button" onClick={controller.insert} disabled={controller.busy || !selected} title="Insert preset" aria-label="Insert preset">
          <Plus size={16} />
        </button>
        <button type="button" className="icon-button" onClick={controller.remove} disabled={controller.busy || !selected} title="Delete preset" aria-label="Delete preset">
          <Trash2 size={15} />
        </button>
      </div>
      {!!selected?.slots?.length && (
        <div className="newt-preset-bindings">
          {selected.slots.map((slot) => (
            <label key={slot.nodeId}>
              <span>{slot.label || slot.role}</span>
              <select value={controller.bindings[slot.nodeId] || ""} onChange={(event) => controller.bind(slot.nodeId, event.target.value)} disabled={controller.busy}>
                <option value="">Preset default</option>
                {controller.candidates.filter((node) => node.type === slot.type).map((node) => (
                  <option key={node.id} value={node.id}>{node.data?.title || slot.role}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {controller.error && <small role="alert">{controller.error}</small>}
    </section>
  );
}
