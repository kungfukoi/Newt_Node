import React from "react";
import { styleLibraryApi } from "../api/newtApi.js";
import { libraryStyleSnapshot } from "../styleLibrary.js";
import "../LibraryWorkspace.css";

export default function LibraryStylePicker({ data, onChange }) {
  const [collections, setCollections] = React.useState([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  async function load() {
    setLoading(true); setError("");
    try { setCollections((await styleLibraryApi.read()).collections || []); }
    catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }
  React.useEffect(() => {
    load();
    window.addEventListener("newtnode:style-library-updated", load);
    return () => window.removeEventListener("newtnode:style-library-updated", load);
  }, []);
  const current = data.libraryStyle;
  const selectedCollection = current && collections.find(collection => collection.styles.some(style => style.id === current.id && libraryStyleSnapshot(style).prompt === current.prompt));
  const value = selectedCollection ? `${selectedCollection.id}:${current.id}` : current ? "workflow-style" : "";
  return <section className="library-style-picker nodrag nowheel" onPointerDown={event => event.stopPropagation()}>
    <div className="style-preset-row"><span>Looks</span>
      <select aria-label="Looks style" value={value} onFocus={load} onChange={event => {
        if (!event.target.value) { onChange({ libraryStyle: null }); return; }
        if (event.target.value === "workflow-style") return;
        const [collectionId, id] = event.target.value.split(":");
        const style = collections.find(item => item.id === collectionId)?.styles.find(item => item.id === id);
        if (style) onChange({ libraryStyle: libraryStyleSnapshot(style), stylePreset: "None" });
      }}>
        <option value="">{loading && !collections.length ? "Loading…" : "None"}</option>
        {current && !selectedCollection && <optgroup label="Saved with workflow"><option value="workflow-style">{current.name || "Custom style"}</option></optgroup>}
        {collections.map(collection => <optgroup key={collection.id} label={collection.name}>{collection.styles.map(style => <option key={style.id} value={`${collection.id}:${style.id}`} disabled={!libraryStyleSnapshot(style).prompt}>{style.name}{!libraryStyleSnapshot(style).prompt ? " (add a description in Library)" : ""}</option>)}</optgroup>)}
      </select>
    </div>
    {error && <small role="alert">{error}</small>}
  </section>;
}
