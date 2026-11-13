import React from "react";
import { X } from "lucide-react";
import { styleLibraryApi } from "../api/newtApi.js";
import { lookSelectionPatch, releaseLookGrade } from "../lookGrade.js";
import { allSavedCatalogLooks, sameLook } from "../lookCatalogs.js";
import "../LibraryWorkspace.css";

export default function LibraryStylePicker({ data, onChange, onEditStart, onEditPrompt }) {
  const [collections, setCollections] = React.useState([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const latestData = React.useRef(data);
  React.useLayoutEffect(() => { latestData.current = data; }, [data]);
  async function choose(value) {
    if (!value) { onChange({ ...releaseLookGrade(data), libraryStyle: null, lookCatalogId:["none","all"].includes(catalogValue)?catalogValue:catalogValue.slice(11) }); return; }
    if (value === "workflow-style") return;
    setAnalyzing(true); setError("");
    try {
      const [collectionId, id] = value.split(":");
      const library = await styleLibraryApi.read();
      let style = library.collections.find(item => item.id === collectionId)?.styles.find(item => item.id === id);
      if (!style) throw new Error("This look is no longer in your collection.");
      if (!style.styleAnalysis?.stylePrompt) {
        const existing = allSavedCatalogLooks(library.collections).find(saved => sameLook(saved, style) && saved.styleAnalysis?.stylePrompt);
        const styleAnalysis = existing?.styleAnalysis || await styleLibraryApi.analyze(style);
        style = { ...style, styleAnalysis };
        await styleLibraryApi.save({ ...library, collections: library.collections.map(item => item.id === collectionId ? { ...item, styles: item.styles.map(saved => saved.id === id ? style : saved) } : item) });
        if (styleAnalysis.warning) setError(styleAnalysis.warning);
      }
      onChange({...lookSelectionPatch(style, latestData.current),lookCatalogId:catalogValue==="all"?"all":collectionId});
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
  const selectedCollection = current && collections.find(collection => collection.styles.some(style => style.id === current.id));
  const catalogs=[{value:"none",label:"None"},{value:"all",label:"All"},...collections.map(item=>({value:`collection:${item.id}`,label:item.name}))];
  const requested=["none","all"].includes(data.lookCatalogId)?data.lookCatalogId:data.lookCatalogId==="starred"?"all":data.lookCatalogId?`collection:${data.lookCatalogId}`:"";
  const inferred=selectedCollection?`collection:${selectedCollection.id}`:current?"all":"none";
  const catalogValue=catalogs.some(option=>option.value===requested)?requested:catalogs.some(option=>option.value===inferred)?inferred:"none";
  const visibleStyles=catalogValue==="all"?allSavedCatalogLooks(collections):collections.find(item=>`collection:${item.id}`===catalogValue)?.styles||[];
  const rows=visibleStyles.map(style=>({style,owner:collections.find(item=>item.styles.includes(style))}));
  const selected=rows.find(({style})=>current&&style.id===current.id);
  const value = selected ? `${selected.owner.id}:${current.id}` : current ? "workflow-style" : "";
  return <section className="library-style-picker nodrag nowheel" onPointerDown={event => event.stopPropagation()}>
    <div className="style-preset-row"><span>Collection</span><select aria-label="Look collection" title="Choose all saved looks or a collection" value={catalogValue} disabled={analyzing} onFocus={load} onChange={event=>{setError("");onChange({...releaseLookGrade(data),libraryStyle:null,lookCatalogId:["none","all"].includes(event.target.value)?event.target.value:event.target.value.slice(11)});}}>{catalogs.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
    <div className="style-preset-row"><span>Look</span>
      <select aria-label="Look" title={catalogValue==="none"?"Choose a collection first":"Choose a look from this collection"} value={value} disabled={analyzing||catalogValue==="none"||(!rows.length&&!current)} onFocus={load} onChange={event => choose(event.target.value)}>
        <option value="">None</option>
        {current && !selected && <optgroup label="Saved with workflow"><option value="workflow-style">{current.name || "Custom style"}</option></optgroup>}
        {rows.map(({style,owner})=><option key={`${owner.id}:${style.id}`} value={`${owner.id}:${style.id}`} title={!style.styleAnalysis?.stylePrompt ? "First use: paid Astra image analysis, saved for reuse" : "Saved Astra style description"} disabled={!style.styleAnalysis?.stylePrompt && !style.examples?.length}>{style.name}</option>)}
      </select>
    </div>
    {!error&&!analyzing&&<small className="library-muted">{catalogValue==="none"?"Choose a collection, then a look.":loading&&!collections.length?"Loading saved looks…":!rows.length&&!current?"No looks saved here yet.":""}</small>}
    {error && <small role="alert">{error}</small>}
    {analyzing && <small role="status">Astra is analyzing this look. Paid analysis runs once; the description is saved for reuse.</small>}
    {current && (
      <div className="library-look-preview">
        <div className="library-look-heading">
          <strong>{current.name || "Saved Look"}</strong>
          <button type="button" aria-label="Remove Look" title="Remove Look" disabled={analyzing} onClick={() => choose("")}><X size={15} /></button>
        </div>
        <textarea aria-label="Look style description" value={current.prompt || ""} maxLength={12000}
          onFocus={onEditStart} onChange={event => onEditPrompt({ ...current, prompt: event.target.value })} />
      </div>
    )}
  </section>;
}
