import React from "react";
import { Search, ArrowUpRight, ArrowRight, X, RefreshCw, Palette, Layers, Star } from "lucide-react";
import { styleLibraryApi, nodeApi } from "./api/newtApi.js";
import { normalizeLibraryStyle, libraryStylesMatching, libraryStyleSnapshot, collectionExamples } from "./styleLibrary.js";
import { displayMediaUrl } from "./mediaAssets.js";
import "./LibraryWorkspace.css";
import CatalogEditorial from "./components/CatalogEditorial.jsx";
import CollectionResizeHandle from "./components/CollectionResizeHandle.jsx";
import LookbookSelect from "./components/LookbookSelect.jsx";
import CreateLookDialog from "./components/CreateLookDialog.jsx";
import LookDetailExtras from "./components/LookDetailExtras.jsx";
import { lookCatalogOptions, lookSaveOptions, starredCatalogLooks } from "./lookCatalogs.js";
import { collectionRows, collectionRowHeight, collectionRowGap, collectionFrameChrome } from "./collectionFrame.js";
import { uiGet, uiSet } from "./uiState.js";

const keyOf = style => `${style.catalog ? "catalog" : "saved"}:${style.id}`;
const sameLook = (first, second) => first.id === second.id || Boolean(first.catalogId && first.catalogId === second.catalogId) || Boolean(first.sourceUrl && first.sourceUrl === second.sourceUrl && first.name === second.name);
const imageUrl = image => image.localUrl ? displayMediaUrl(image.localUrl) : styleLibraryApi.catalogAssetUrl(image.url);
function StyleMosaic({ style }) {
  const examples = (style.examples || []).slice(0, 4);
  return <span className={`stylebuilder-mosaic mosaic-${examples.length}`}>
    {examples.length ? examples.map((image,index) => <img key={`${image.id}-${index}`} src={imageUrl(image)} alt={`${style.name} example ${index+1}`} loading="lazy" decoding="async" onError={event => { event.currentTarget.style.visibility="hidden"; }} />) : <span className="stylebuilder-no-preview"><Palette size={27}/><span>Examples arriving</span></span>}
  </span>;
}

export default function LibraryWorkspace({ onCreateMoodBoard, onCreateStyle }) {
  const [creatingLook, setCreatingLook] = React.useState(false);
  const [creatingCatalog,setCreatingCatalog]=React.useState(false), [newCatalogName,setNewCatalogName]=React.useState("");
  const [library,setLibrary]=React.useState(null), [collectionId,setCollectionId]=React.useState(()=>uiGet("lookbookCollectionId", ""));
  React.useEffect(()=>{uiSet("lookbookCollectionId",collectionId);},[collectionId]);
  const [browseCollectionId,setBrowseCollectionId]=React.useState(()=>uiGet("lookbookBrowseCollectionId", ""));
  React.useEffect(()=>{uiSet("lookbookBrowseCollectionId",browseCollectionId);},[browseCollectionId]);
  const [selectedLooks,setSelectedLooks]=React.useState(()=>new Map());
  const [catalog,setCatalog]=React.useState(null), [catalogLoading,setCatalogLoading]=React.useState(false), [catalogError,setCatalogError]=React.useState("");
  const [query,setQuery]=React.useState(""), [category,setCategory]=React.useState(""), [scope,setScope]=React.useState("library");
  const [savedCollectionRows, setCollectionRows] = React.useState(() => collectionRows(uiGet("lookbookCollectionRows", 1)));
  React.useEffect(() => { uiSet("lookbookCollectionRows", savedCollectionRows); }, [savedCollectionRows]);
  const [savedCatalogRows, setCatalogRows] = React.useState(() => collectionRows(uiGet("lookbookCatalogRows", 1)));
  React.useEffect(() => { uiSet("lookbookCatalogRows", savedCatalogRows); }, [savedCatalogRows]);
  const [namedCatalogRows,setNamedCatalogRows]=React.useState(()=>uiGet("lookbookNamedCatalogRows", {}) || {});
  React.useEffect(()=>{uiSet("lookbookNamedCatalogRows",namedCatalogRows);},[namedCatalogRows]);
  const changeFrameRows=React.useCallback(value=>{
    const rows=collectionRows(value);
    if(scope==="library")setCatalogRows(rows);
    else if(scope==="starred")setCollectionRows(rows);
    else setNamedCatalogRows(current=>({...current,[browseCollectionId]:rows}));
  },[scope,browseCollectionId]);
  const frameRef = React.useRef(null);
  const resizable = true;
  const frameRows = scope === "library" ? savedCatalogRows : scope === "starred" ? savedCollectionRows : collectionRows(namedCatalogRows[browseCollectionId] ?? 1);
  const [activeStyle,setActiveStyle]=React.useState(null), [detailLoading,setDetailLoading]=React.useState(false);
  const [busy,setBusy]=React.useState(false), [error,setError]=React.useState(""), [notice,setNotice]=React.useState("");
  const [previewIndex, setPreviewIndex] = React.useState(null);
  const previewDialog = React.useRef(null);
  const searchInput = React.useRef(null);
  const dialog=React.useRef(null), request=React.useRef(0), detailRequest=React.useRef(0), imported=React.useRef(new Map());
  const collection=library?.collections.find(item=>item.id===collectionId);
  const browseCollection=library?.collections.find(item=>item.id===browseCollectionId);
  const sourceStyles=scope==="library" ? (catalog?.styles||[]).map(style=>({...style,catalog:true})) : scope==="starred" ? starredCatalogLooks(library?.collections) : (browseCollection?.styles||[]);
  const browserValue=scope==="collection" ? `collection:${browseCollectionId}` : scope;
  const browserOptions=lookCatalogOptions(library?.collections);
  const saveOptions=lookSaveOptions(library?.collections);
  const browserName=scope==="library" ? "Catalog" : scope==="starred" ? "Starred" : browseCollection?.name || "Catalog";
  function chooseCatalog(value) { if(value.startsWith("collection:")){setBrowseCollectionId(value.slice(11));setScope("collection");}else setScope(value); }
  const visibleStyles=scope==="library" ? sourceStyles : libraryStylesMatching(sourceStyles,query);
  const isSaved = style => Boolean(library?.collections.some(item => item.styles.some(saved => sameLook(saved, style))));
  const isSavedToCollection = style => Boolean(collection?.styles.some(saved => sameLook(saved, style)));

  async function loadLibrary() {
    setBusy(true); setError("");
    try { const value=await styleLibraryApi.read(); setLibrary(value); setCollectionId(current=>value.collections.some(item=>item.id===current)?current:lookSaveOptions(value.collections)[0].value); setBrowseCollectionId(current=>value.collections.some(item=>item.id===current)?current:value.collections[0]?.id||""); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  async function loadCatalog({offset=0,refresh=false,search=query,filter=category}={}) {
    const version=++request.current; setCatalogLoading(true); setCatalogError("");
    try { const value=await styleLibraryApi.catalog({query:search,category:filter,offset,refresh}); if(version===request.current)setCatalog(current=>offset?{...value,styles:[...(current?.styles||[]),...value.styles]}:value); }
    catch(e) { if(version===request.current)setCatalogError(e.message); } finally { if(version===request.current)setCatalogLoading(false); }
  }
  React.useEffect(()=>{loadLibrary();},[]);
  React.useEffect(()=>{setSelectedLooks(new Map());},[scope,query,category,browseCollectionId]);
  React.useEffect(()=>{const timer=setTimeout(()=>loadCatalog(),250);return()=>clearTimeout(timer);},[query,category]);
  React.useEffect(()=>{if(activeStyle||detailLoading){if(!dialog.current?.open)dialog.current?.showModal();}},[activeStyle,detailLoading]);
  React.useEffect(() => { if (previewIndex !== null && !previewDialog.current?.open) previewDialog.current?.showModal(); }, [previewIndex]);
  function closePreview() { previewDialog.current?.close(); setPreviewIndex(null); }
  async function act(action) { setBusy(true);setError("");setNotice("");try{await action();}catch(e){setNotice("");setError(e.message);}finally{setBusy(false);} }
  async function save(collections) { const value=await styleLibraryApi.save({...library,collections});setLibrary(value);return value; }
  async function createCatalog(name) {
    let succeeded = false;
    await act(async()=>{
      if (!library) throw new Error("Wait for your catalogs to load.");
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 120) throw new Error("Name your catalog using 1–120 characters.");
      if (["catalog","starred"].includes(trimmed.toLowerCase()) || library.collections.some(item=>item.name.toLowerCase()===trimmed.toLowerCase())) throw new Error("That catalog name is already in use.");
      const target = crypto.randomUUID();
      await save([...library.collections,{id:target,name:trimmed,styles:[]}]);
      if(!collectionId)setCollectionId(target);setBrowseCollectionId(target);setScope("collection");
      setNotice(`Created catalog ${trimmed}.`); succeeded = true;
    });
    return succeeded;
  }
  async function toggleCollectionMembership(style) {
    if (!collection) return;
    if (!collection.styles.some(saved=>sameLook(saved,style))) { await saveReferences([style]); return; }
    await act(async()=>{
      await save(library.collections.map(item=>item.id===collection.id ? {...item,styles:item.styles.filter(saved=>!sameLook(saved,style))} : item));
      setSelectedLooks(current=>new Map([...current].filter(([,saved])=>!sameLook(saved,style))));
      setNotice(`Removed ${style.name} from ${collection.name}.`);
    });
  }
  async function materialize(style) {
    const examples=[];
    for(const image of (style.examples||[]).slice(0,8)) {
      if(image.localUrl){examples.push(image);continue;}
      if(imported.current.has(image.url)){examples.push(imported.current.get(image.url));continue;}
      const response=await fetch(styleLibraryApi.catalogAssetUrl(image.url));
      if(!response.ok)throw new Error("An example is still downloading. Refresh the catalog and try again.");
      const file=new File([await response.blob()],image.fileName||"style-example.jpg",{type:response.headers.get("content-type")||"image/jpeg"});
      const form=new FormData();form.append("nodeType","transfer");form.append("asset",file);
      const {response:upload,data}=await nodeApi.uploadAsset(form);
      if(!upload.ok||!data.asset?.localUrl)throw new Error(data.error||"Could not import this example.");
      const asset={...data.asset,id:crypto.randomUUID()};examples.push(asset);imported.current.set(image.url,asset);
    }
    return normalizeLibraryStyle({...style,examples});
  }
  async function openDetails(style) {
    const version=++detailRequest.current;setActiveStyle(null);setDetailLoading(true);setError("");
    try{
      let value=style.catalog?(await styleLibraryApi.detail(style.id)).style:style;
      if(!style.catalog&&style.sourceUrl){
        const sourceId=new URL(style.sourceUrl).pathname.split("/").filter(Boolean).pop();
        try{const original=(await styleLibraryApi.detail(sourceId)).style;value={...value,colours:original.colours||value.colours,similarStyles:original.similarStyles||[]};}catch{/* Keep saved examples and description available when the source is missing. */}
      }
      if(version===detailRequest.current)setActiveStyle({...value,catalog:style.catalog});
    }
    catch(e){setError(e.message);dialog.current?.close();}finally{if(version===detailRequest.current)setDetailLoading(false);}
  }
  function closeDetails(){detailRequest.current++;dialog.current?.close();setActiveStyle(null);setDetailLoading(false);}
  async function saveReferences(styles) {
    let succeeded = false;
    await act(async()=>{
      if(!library)throw new Error("Wait for your collection to load before saving styles.");
      const additions=[];
      for(const style of styles.filter(item=>!collection?.styles.some(saved=>sameLook(saved,item)))) {
        const existing=library.collections.flatMap(item=>item.styles).find(saved=>sameLook(saved,style));
        const source=existing || (style.catalog?(await styleLibraryApi.detail(style.id)).style:style);
        additions.push({...await materialize(source),id:crypto.randomUUID()});
      }
      if(!additions.length){setNotice("These styles are already in this collection.");succeeded=true;return;}
      let target=collection,collections=library.collections;
      if(!target){target={id:"system-starred",name:"Starred",styles:[]};collections=[...collections,target];}
      await save(collections.map(item=>item.id===target.id?{...item,styles:[...item.styles,...additions]}:item));
      setCollectionId(target.id);if(!browseCollectionId)setBrowseCollectionId(target.id);setNotice(`Saved ${additions.length===1?additions[0].name:`${additions.length} styles`} to ${target.name}.`);succeeded=true;
    });
    return succeeded;
  }
  const saveReference = style => saveReferences([style]);
  async function removeReference(style) {
    await act(async () => {
      if (!library) throw new Error("Wait for your collection to load before removing a look.");
      await save(library.collections.map(item => ({ ...item, styles: item.styles.filter(saved => !sameLook(saved, style)) })));
      setSelectedLooks(current=>new Map([...current].filter(([,saved])=>!sameLook(saved,style))));
      if (scope === "collection" && activeStyle && sameLook(activeStyle, style)) closeDetails();
      setNotice(`Removed ${style.name} from your collection.`);
    });
  }
  const toggleSavedLook = style => isSaved(style) ? removeReference(style) : saveReference(style);
  async function createStyleNode(style) {
    await act(async () => {
      if (!library) throw new Error("Wait for your library to load before creating a Style node.");
      const source = style.catalog ? (await styleLibraryApi.detail(style.id)).style : style;
      const existingCollection = library.collections.find(item => item.styles.some(saved => sameLook(saved, source)));
      const existing = existingCollection?.styles.find(saved => sameLook(saved, source));
      const local = await materialize(existing || source);
      if (!local.styleAnalysis?.stylePrompt) {
        setNotice("This is the first time this Look has been used as a Style, Analyzing the examples and observations.  The Style will be saved for reuse.");
        local.styleAnalysis = await styleLibraryApi.analyze(local);
      }
      let target = existingCollection || collection, collections = library.collections;
      if (!target) { target = { id: "system-starred", name: "Starred", styles: [] }; collections = [...collections, target]; }
      const savedStyle = { ...local, id: existing?.id || (style.catalog ? crypto.randomUUID() : local.id) };
      const styles = existing ? target.styles.map(item => item.id === existing.id ? savedStyle : item) : [...target.styles, savedStyle];
      await save(collections.map(item => item.id === target.id ? { ...item, styles } : item));
      if (!collectionId) setCollectionId(target.id);
      if (!browseCollectionId) setBrowseCollectionId(target.id);
      setActiveStyle(current => current && sameLook(current, source) ? { ...current, styleAnalysis: savedStyle.styleAnalysis } : current);
      setNotice(local.styleAnalysis.warning || `Created ${savedStyle.name} Style node. Its description is saved for reuse.`);
      onCreateStyle(libraryStyleSnapshot(savedStyle));
    });
  }
  async function addToBoard(styles) {
    await act(async()=>{
      const local=await Promise.all(styles.map(materialize));
      const examples=collectionExamples(local).slice(0,6);
      if(!examples.length)throw new Error("These styles have no downloaded examples yet. Refresh the catalog when they are ready.");
      const prompt=styles.map(style=>libraryStyleSnapshot(style).prompt||style.notes).filter(Boolean).join("\n\n");
      onCreateMoodBoard({name:styles.length===1?`${styles[0].name} mood board`:"Style mood board",examples,prompt});
      setNotice("Created Mood Board node. You can continue exploring this look.");
    });
  }
  return <div className="library-workspace stylebuilder-workspace">
    <header className="stats-hero lookbook-hero"><div><span className="stats-kicker">Creative library</span><h1>Lookbook</h1><p>Explore the catalog. Save your favorites. Bring a look into your next creation.</p></div></header>
    {error&&<div className="library-error" role="alert">{error}<button disabled={busy} onClick={loadLibrary}>Retry</button></div>}{notice&&<p className="stylebuilder-notice" role="status">{notice}</p>}
    <section className="stylebuilder-browse" aria-label="Looks catalog"><div className="stylebuilder-browse-toolbar"><p>Explore the catalog. <span>Choose a look</span></p><div className="stylebuilder-browse-controls"><button className="lookbook-compact-action" disabled={busy||!library||library.collections.length>=100} onClick={()=>setCreatingCatalog(value=>!value)}>New Catalog</button><LookbookSelect label="Looks source" value={browserValue} onChange={chooseCatalog} options={browserOptions}/><label className="stylebuilder-search"><Search size={18}/><input ref={searchInput} aria-label="Search looks" placeholder="Search looks" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" className="stylebuilder-search-clear" aria-label="Clear look search" onClick={()=>{setQuery("");searchInput.current?.focus();}}><X size={15}/></button>}</label><button className="stylebuilder-icon" aria-label="Refresh catalog" title="Pick up newly downloaded styles" disabled={catalogLoading} onClick={()=>loadCatalog({refresh:true})}><RefreshCw size={17} className={catalogLoading?"spin":""}/></button></div></div>
    {creatingCatalog&&<form className="library-inline look-collection-form" onSubmit={async event=>{event.preventDefault();if(await createCatalog(newCatalogName)){setCreatingCatalog(false);setNewCatalogName("");}}}><label>Catalog name<input autoFocus maxLength={120} disabled={busy} value={newCatalogName} onChange={event=>setNewCatalogName(event.target.value)} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();setCreatingCatalog(false);}}}/></label><button type="submit" className="library-primary" disabled={busy||!newCatalogName.trim()}>Create Catalog</button><button type="button" disabled={busy} onClick={()=>setCreatingCatalog(false)}>Cancel</button></form>}
      {scope==="library"&&catalog?.categories?.length>0&&<div className="stylebuilder-catalog-meta"><span>{catalog.indexed.toLocaleString()} local styles{catalog.populating?" · catalog still populating":""}</span><LookbookSelect label="Look category" value={category} onChange={setCategory} options={[{value:"",label:"All categories"},...catalog.categories.map(item=>({value:item,label:item}))]}/></div>}
      {catalogError&&scope==="library"&&<p className="library-error" role="alert">{catalogError}</p>}
      <div key={`strip:${browserValue}`} ref={frameRef} data-row-count={frameRows} className={`stylebuilder-style-strip ${resizable ? `collection-grid ${!visibleStyles.length ? "collection-grid-empty" : ""}` : ""}`} style={resizable ? {"--collection-rows":frameRows,"--collection-row-height":`${collectionRowHeight}px`,"--collection-row-gap":`${collectionRowGap}px`,"--collection-frame-chrome":`${collectionFrameChrome}px`} : undefined} aria-label="Style previews" tabIndex={0}>
        {visibleStyles.map(style=><article className="stylebuilder-tile" key={keyOf(style)}><label className="stylebuilder-tile-selection"><input type="checkbox" aria-label={`Select ${style.name}`} checked={selectedLooks.has(keyOf(style))} onChange={event=>{const checked=event.target.checked;setSelectedLooks(current=>{const next=new Map(current);if(checked)next.set(keyOf(style),style);else next.delete(keyOf(style));return next;});}}/></label><button className="stylebuilder-tile-open" onClick={()=>openDetails(style)} aria-label={`View ${style.name}`}><StyleMosaic style={style}/><span className="stylebuilder-tile-name">{style.sref?.replace(/^--sref\s+/,"")||style.name}</span></button><button className={`stylebuilder-tile-star ${isSaved(style)?"saved":""}`} aria-label={`${isSaved(style)?"Remove from collection":"Save to collection"}: ${style.name}`} aria-pressed={isSaved(style)} title={isSaved(style)?"Unstar and remove from your collection":"Save to your collection"} disabled={busy||!library} onClick={()=>toggleSavedLook(style)}><Star size={16} fill={isSaved(style)?"currentColor":"none"}/></button></article>)}
        {!visibleStyles.length&&<div className="stylebuilder-empty"><Layers size={27}/><p>{catalogLoading?"Reading your local style library…":scope==="library"&&!catalog?.ready?"Your local ideas library will appear here as it becomes available.":"No styles match this view."}</p>{scope!=="library"&&<button onClick={()=>setScope("library")}>Browse catalog <ArrowRight size={15}/></button>}</div>}
      </div>
      {resizable&&<CollectionResizeHandle key={`resize:${browserValue}`} rows={frameRows} frameRef={frameRef} label={browserName} onChange={changeFrameRows}/>}
      {scope==="library"&&catalog&&catalog.styles.length<catalog.total&&<button className="stylebuilder-load-more lookbook-compact-action" disabled={catalogLoading} onClick={()=>loadCatalog({offset:catalog.styles.length})}>{catalogLoading?"Loading…":"More Styles"} <ArrowRight size={15}/></button>}
    </section>
    <div className="lookbook-selection-actions"><span className="library-muted">{selectedLooks.size ? `${selectedLooks.size} selected` : ""}</span><div className="library-inline"><button disabled={busy||!library||!selectedLooks.size} onClick={async()=>{if(await saveReferences([...selectedLooks.values()]))setSelectedLooks(new Map());}}>Add to collection</button>{library&&<fieldset disabled={busy}><LookbookSelect label="Add to collection destination" value={collectionId} onChange={setCollectionId} options={saveOptions}/></fieldset>}<button className="library-primary lookbook-compact-action" onClick={()=>setCreatingLook(true)}>Create Look</button></div></div>
    <CatalogEditorial onOpenLook={openDetails}/>
    <CreateLookDialog open={creatingLook} categories={catalog?.categories} onClose={()=>setCreatingLook(false)} onSaved={style=>{setQuery("");setCategory("");setScope("library");setNotice(`Saved ${style.name} to the catalog.`);loadCatalog({refresh:true,search:"",filter:""});}}/>
    <dialog ref={dialog} className="library-style-detail" aria-label="Style details" onCancel={event=>{event.preventDefault();closeDetails();}}><button className="stylebuilder-detail-close" aria-label="Close style details" onClick={closeDetails}><X size={20}/></button>{detailLoading&&<p role="status">Loading style details…</p>}{error&&<p className="library-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{activeStyle&&<><span className="stylebuilder-eyebrow">{activeStyle.category||"SAVED LOOK"}</span><h2>{activeStyle.name}</h2><div className="library-detail-examples">{(activeStyle.examples||[]).map((image,index)=><button key={`${image.id}-${index}`} className="library-example-open" aria-label={`Enlarge ${activeStyle.name} example ${index+1}`} onClick={()=>setPreviewIndex(index)}><img src={imageUrl(image)} alt={`${activeStyle.name} example ${index+1}`}/></button>)}</div>{!activeStyle.examples?.length&&<p className="library-muted">Examples for this style are still downloading. Refresh the catalog when they are ready.</p>}<p className="library-muted">Use in Style analyzes the examples and observations with Astra once (paid), then saves the description for future use.</p><p className="library-detail-description">{activeStyle.styleAnalysis?.stylePrompt||activeStyle.prompt||"The visual description for this catalog look has not downloaded yet. Refresh the catalog when it is ready."}</p>{activeStyle.sref&&<code>{activeStyle.sref}</code>}<p className="library-muted">{activeStyle.tags?.join(" · ")}</p><div className="library-inline"><button aria-label={isSavedToCollection(activeStyle)?"Remove from my collection":"Save to my collection"} aria-pressed={isSavedToCollection(activeStyle)} disabled={busy||!library} onClick={()=>collection?toggleCollectionMembership(activeStyle):toggleSavedLook(activeStyle)}><Star size={16} fill={isSavedToCollection(activeStyle)?"currentColor":"none"}/>{isSavedToCollection(activeStyle)?"Remove from collection":"Save to collection"}</button>{library&&<fieldset disabled={busy}><LookbookSelect label="Save destination" value={collectionId} onChange={setCollectionId} options={saveOptions}/></fieldset>}<button disabled={busy||!activeStyle.examples?.length} onClick={()=>addToBoard([activeStyle])}>Create Mood Board node</button><button disabled={busy||(!activeStyle.styleAnalysis?.stylePrompt&&!activeStyle.examples?.length)} onClick={()=>createStyleNode(activeStyle)}>Use in Style <ArrowUpRight size={15}/></button></div><LookDetailExtras style={activeStyle} onOpenLook={openDetails}/></>}</dialog>
    <dialog ref={previewDialog} className="library-image-preview" aria-label="Look example preview" onCancel={event=>{event.preventDefault();closePreview();}} onClick={event=>{if(event.target===event.currentTarget)closePreview();}} onKeyDown={event=>{if(event.key==="ArrowRight"&&activeStyle?.examples?.length){event.preventDefault();setPreviewIndex(index=>(index+1)%activeStyle.examples.length);}if(event.key==="ArrowLeft"&&activeStyle?.examples?.length){event.preventDefault();setPreviewIndex(index=>(index-1+activeStyle.examples.length)%activeStyle.examples.length);}}}>
      <button className="library-preview-close" aria-label="Close example preview" onClick={closePreview}><X size={22}/></button>
      {previewIndex!==null&&activeStyle?.examples?.[previewIndex]&&<><img src={imageUrl(activeStyle.examples[previewIndex])} alt={`${activeStyle.name} example ${previewIndex+1}, enlarged`}/><div className="library-preview-controls"><button aria-label="Previous example" disabled={activeStyle.examples.length<2} onClick={()=>setPreviewIndex(index=>(index-1+activeStyle.examples.length)%activeStyle.examples.length)}>Previous</button><span>{previewIndex+1} / {activeStyle.examples.length}</span><button aria-label="Next example" disabled={activeStyle.examples.length<2} onClick={()=>setPreviewIndex(index=>(index+1)%activeStyle.examples.length)}>Next</button></div></>}
    </dialog>
  </div>;
}
