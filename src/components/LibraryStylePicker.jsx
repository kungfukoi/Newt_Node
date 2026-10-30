import React from "react";
import { styleLibraryApi } from "../api/newtApi.js";
import { libraryStyleSnapshot } from "../styleLibrary.js";
import { lookSelectionPatch, releaseLookGrade } from "../lookGrade.js";
import "../LibraryWorkspace.css";

export default function LibraryStylePicker({ data, onChange }) {
  const [collections, setCollections] = React.useState([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  async function choose(value) {
    if (!value) { onChange({ ...releaseLookGrade(data), libraryStyle: null }); return; }
    if (value === "workflow-style") return;
    setAnalyzing(true); setError("");
    try {
      const [collectionId, id] = value.split(":");
      const library = await styleLibraryApi.read();
      let style = library.collections.find(item => item.id === collectionId)?.styles.find(item => item.id === id);
      if (!style) throw new Error("This look is no longer in your collection.");
      if (!style.styleAnalysis?.stylePrompt) {
        const styleAnalysis = await styleLibraryApi.analyze(style);
        style = { ...style, styleAnalysis };
        await styleLibraryApi.save({ ...library, collections: library.collections.map(item => item.id === collectionId ? { ...item, styles: item.styles.map(saved => saved.id === id ? style : saved) } : item) });
        if (styleAnalysis.warning) setError(styleAnalysis.warning);
      }
      onChange(lookSelectionPatch(style, data));
    } catch (error) { setError(error.message); }
    finally { setAnalyzing(false); }
  }
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
    <div className="style-preset-row"><span>Look</span>
      <select aria-label="Look" value={value} disabled={analyzing} onFocus={load} onChange={event => choose(event.target.value)}>
        <option value="">{loading && !collections.length ? "Loading…" : "None"}</option>
        {current && !selectedCollection && <optgroup label="Saved with workflow"><option value="workflow-style">{current.name || "Custom style"}</option></optgroup>}
        {collections.map(collection => <optgroup key={collection.id} label={collection.name}>{collection.styles.map(style => <option key={style.id} value={`${collection.id}:${style.id}`} title={!style.styleAnalysis?.stylePrompt ? "First use: paid Astra image analysis, saved for reuse" : "Saved Astra style description"} disabled={!style.styleAnalysis?.stylePrompt && !style.examples?.length}>{style.name}</option>)}</optgroup>)}
      </select>
    </div>
    {error && <small role="alert">{error}</small>}
    {analyzing && <small role="status">Astra is analyzing this look. Paid analysis runs once; the description is saved for reuse.</small>}
  </section>;
}
