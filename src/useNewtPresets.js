import { useEffect, useRef, useState } from "react";
import { newtPresetsApi } from "./api/newtApi.js";

function normalizedPresetItems(value) {
  return Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
}

export function useNewtPresets(adapter) {
  const live = useRef(adapter);
  live.current = adapter;
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [bindings, setBindings] = useState({});
  const operation = useRef(false);

  useEffect(() => {
    let cancelled = false;
    newtPresetsApi.list()
      .then((result) => {
        if (!cancelled) setItems(normalizedPresetItems(result));
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDraft(null);
    setBindings({});
  }, [adapter.projectId]);

  async function perform(action) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  const refresh = () => perform(async () => setItems(normalizedPresetItems(await newtPresetsApi.list())));

  function beginSave() {
    if (operation.current) return;
    try {
      setError("");
      setDraft(live.current.capture());
    } catch (captureError) {
      live.current.onStatus(captureError.message);
    }
  }

  const save = (name, slots = []) => perform(async () => {
    const preset = await newtPresetsApi.save({ name, graph: { ...draft, slots } });
    setItems((current) => [
      ...current,
      {
        id: preset.id,
        name: preset.name,
        nodeCount: preset.graph.nodes.length,
        slots: preset.graph.slots || []
      }
    ].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedId(preset.id);
    setDraft(null);
    live.current.onStatus(`Newt Preset saved: ${preset.name}`);
  });

  const insert = () => perform(async () => {
    if (!selectedId) return;
    const projectId = live.current.projectId;
    const preset = await newtPresetsApi.get(selectedId);
    if (projectId !== live.current.projectId) {
      throw new Error("Project changed. Select the preset again in this project.");
    }
    await live.current.insert(preset.graph, bindings);
    live.current.onStatus(`Inserted Newt Preset: ${preset.name}`);
  });

  const remove = () => {
    const selected = items.find((item) => item.id === selectedId);
    if (!selected || !window.confirm(`Delete Newt Preset "${selected.name}"? Nodes already placed in projects will be kept.`)) return;
    return perform(async () => {
      await newtPresetsApi.remove(selected.id);
      setItems((current) => current.filter((item) => item.id !== selected.id));
      setSelectedId("");
      setBindings({});
    });
  };

  return {
    items,
    selectedId,
    select: (id) => {
      setSelectedId(id);
      setBindings({});
    },
    busy,
    error,
    draft,
    beginSave,
    save,
    insert,
    remove,
    refresh,
    bindings,
    bind: (id, value) => setBindings((current) => ({ ...current, [id]: value })),
    candidates: adapter.getNodes?.() || [],
    cancel: () => {
      if (!operation.current) {
        setDraft(null);
        setError("");
      }
    }
  };
}
