import React from "react";
import { Search, ArrowUpRight, ArrowRight, X, RefreshCw, Palette, Layers, Star } from "lucide-react";
import { styleLibraryApi, nodeApi } from "./api/newtApi.js";
import { normalizeLibraryStyle, libraryStylesMatching, libraryStyleSnapshot, collectionExamples } from "./styleLibrary.js";
import { displayMediaUrl } from "./mediaAssets.js";
import "./LibraryWorkspace.css";
import CatalogEditorial from "./components/CatalogEditorial.jsx";
import CollectionResizeHandle from "./components/CollectionResizeHandle.jsx";
import LookbookSelect from "./components/LookbookSelect.jsx";
import { collectionRows, collectionRowHeight, collectionRowGap } from "./collectionFrame.js";
import { uiGet, uiSet } from "./uiState.js";

const keyOf = style => `${style.catalog ? "catalog" : "saved"}:${style.id}`;
const sameLook = (first, second) => first.id === second.id || Boolean(first.sourceUrl && first.sourceUrl === second.sourceUrl && first.name === second.name);
const imageUrl = image => image.localUrl ? displayMediaUrl(image.localUrl) : styleLibraryApi.catalogAssetUrl(image.url);
function StyleMosaic({ style }) {
  const examples = (style.examples || []).slice(0, 4);
  return <span className={`stylebuilder-mosaic mosaic-${examples.length}`}>
    {examples.length ? examples.map((image,index) => <img key={`${image.id}-${index}`} src={imageUrl(image)} alt={`${style.name} example ${index+1}`} loading="lazy" decoding="async" onError={event => { event.currentTarget.style.visibility="hidden"; }} />) : <span className="stylebuilder-no-preview"><Palette size={27}/><span>Examples arriving</span></span>}
  </span>;
}

export default function LibraryWorkspace({ onCreateMoodBoard, onCreateStyle }) {
  const [library,setLibrary]=React.useState(null), [collectionId,setCollectionId]=React.useState("");
  const [catalog,setCatalog]=React.useState(null), [catalogLoading,setCatalogLoading]=React.useState(false), [catalogError,setCatalogError]=React.useState("");
  const [query,setQuery]=React.useState(""), [category,setCategory]=React.useState(""), [scope,setScope]=React.useState("library");
  const [savedCollectionRows, setCollectionRows] = React.useState(() => collectionRows(uiGet("lookbookCollectionRows", 1)));
  React.useEffect(() => { uiSet("lookbookCollectionRows", savedCollectionRows); }, [savedCollectionRows]);
  const [selected,setSelected]=React.useState([]), [activeStyle,setActiveStyle]=React.useState(null), [detailLoading,setDetailLoading]=React.useState(false);
  const [busy,setBusy]=React.useState(false), [error,setError]=React.useState(""), [notice,setNotice]=React.useState("");
  const [previewIndex, setPreviewIndex] = React.useState(null);
  const previewDialog = React.useRef(null);
  const searchInput = React.useRef(null);
  const dialog=React.useRef(null), request=React.useRef(0), detailRequest=React.useRef(0), imported=React.useRef(new Map());
  const collection=library?.collections.find(item=>item.id===collectionId);
  const sourceStyles=scope==="library" ? (catalog?.styles||[]).map(style=>({...style,catalog:true})) : scope==="selected" ? selected : (collection?.styles||[]);
  const visibleStyles=scope==="library" ? sourceStyles : libraryStylesMatching(sourceStyles,query);
  const isSaved = style => Boolean(library?.collections.some(item => item.styles.some(saved => sameLook(saved, style))));

  async function loadLibrary() {
    setBusy(true); setError("");
    try { const value=await styleLibraryApi.read(); setLibrary(value); setCollectionId(current=>value.collections.some(item=>item.id===current)?current:value.collections[0]?.id||""); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  async function loadCatalog({offset=0,refresh=false}={}) {
    const version=++request.current; setCatalogLoading(true); setCatalogError("");
    try { const value=await styleLibraryApi.catalog({query,category,offset,refresh}); if(version===request.current)setCatalog(current=>offset?{...value,styles:[...(current?.styles||[]),...value.styles]}:value); }
    catch(e) { if(version===request.current)setCatalogError(e.message); } finally { if(version===request.current)setCatalogLoading(false); }
  }
  React.useEffect(()=>{loadLibrary();},[]);
  React.useEffect(()=>{const timer=setTimeout(()=>loadCatalog(),250);return()=>clearTimeout(timer);},[query,category]);
  React.useEffect(()=>{if(activeStyle||detailLoading){if(!dialog.current?.open)dialog.current?.showModal();}},[activeStyle,detailLoading]);
  React.useEffect(() => { if (previewIndex !== null && !previewDialog.current?.open) previewDialog.current?.showModal(); }, [previewIndex]);
  function closePreview() { previewDialog.current?.close(); setPreviewIndex(null); }
  async function act(action) { setBusy(true);setError("");setNotice("");try{await action();}catch(e){setNotice("");setError(e.message);}finally{setBusy(false);} }
  async function save(collections) { const value=await styleLibraryApi.save({...library,collections});setLibrary(value);return value; }
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
    try{const value=style.catalog?(await styleLibraryApi.detail(style.id)).style:style;if(version===detailRequest.current)setActiveStyle({...value,catalog:style.catalog});}
    catch(e){setError(e.message);dialog.current?.close();}finally{if(version===detailRequest.current)setDetailLoading(false);}
  }
  function closeDetails(){detailRequest.current++;dialog.current?.close();setActiveStyle(null);setDetailLoading(false);}
  async function toggleStyle(style) {
    if(selected.some(item=>keyOf(item)===keyOf(style))){setSelected(current=>current.filter(item=>keyOf(item)!==keyOf(style)));return;}
    await act(async()=>{const value=style.catalog&&!style.detailAvailable?{...(await styleLibraryApi.detail(style.id)).style,catalog:true}:style;setSelected(current=>current.some(item=>keyOf(item)===keyOf(value))?current:[...current,value]);});
  }
  async function saveReferences(styles) {
    await act(async()=>{
      if(!library)throw new Error("Wait for your collection to load before saving styles.");
      const additions=[];
      for(const style of styles.filter(item=>!isSaved(item))) {
        const source=style.catalog?(await styleLibraryApi.detail(style.id)).style:style;
        additions.push({...await materialize(source),id:crypto.randomUUID()});
      }
      if(!additions.length){setNotice("These styles are already in your collection.");return;}
      let target=collection,collections=library.collections;
      if(!target){target={id:crypto.randomUUID(),name:"My styles",styles:[]};collections=[...collections,target];}
      await save(collections.map(item=>item.id===target.id?{...item,styles:[...item.styles,...additions]}:item));
      setCollectionId(target.id);setNotice(`Saved ${additions.length===1?additions[0].name:`${additions.length} styles`} to ${target.name}.`);
    });
  }
  const saveReference = style => saveReferences([style]);
  async function removeReference(style) {
    await act(async () => {
      if (!library) throw new Error("Wait for your collection to load before removing a look.");
      await save(library.collections.map(item => ({ ...item, styles: item.styles.filter(saved => !sameLook(saved, style)) })));
      setSelected(current => current.filter(item => !sameLook(item, style)));
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
      if (!target) { target = { id: crypto.randomUUID(), name: "My styles", styles: [] }; collections = [...collections, target]; }
      const savedStyle = { ...local, id: existing?.id || (style.catalog ? crypto.randomUUID() : local.id) };
      const styles = existing ? target.styles.map(item => item.id === existing.id ? savedStyle : item) : [...target.styles, savedStyle];
      await save(collections.map(item => item.id === target.id ? { ...item, styles } : item));
      setCollectionId(target.id);
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
    <section className="stylebuilder-browse" aria-label="Looks catalog"><div className="stylebuilder-browse-toolbar"><p>Explore the catalog. <span>Choose a look</span></p><div className="stylebuilder-browse-controls"><LookbookSelect label="Looks source" value={scope} onChange={setScope} options={[{value:"library",label:"Catalog"},{value:"collection",label:"My collection"},{value:"selected",label:`Selected (${selected.length})`}]}/><label className="stylebuilder-search"><Search size={18}/><input ref={searchInput} aria-label="Search looks" placeholder="Search looks" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" className="stylebuilder-search-clear" aria-label="Clear look search" onClick={()=>{setQuery("");searchInput.current?.focus();}}><X size={15}/></button>}</label><button className="stylebuilder-icon" aria-label="Refresh catalog" title="Pick up newly downloaded styles" disabled={catalogLoading} onClick={()=>loadCatalog({refresh:true})}><RefreshCw size={17} className={catalogLoading?"spin":""}/></button></div></div>
      {scope==="library"&&catalog?.categories?.length>0&&<div className="stylebuilder-catalog-meta"><span>{catalog.indexed.toLocaleString()} local styles{catalog.populating?" · catalog still populating":""}</span><LookbookSelect label="Look category" value={category} onChange={setCategory} options={[{value:"",label:"All categories"},...catalog.categories.map(item=>({value:item,label:item}))]}/></div>}
      {catalogError&&scope==="library"&&<p className="library-error" role="alert">{catalogError}</p>}
      <div className={`stylebuilder-style-strip ${scope==="collection" ? `collection-grid ${!visibleStyles.length ? "collection-grid-empty" : ""}` : ""}`} style={scope==="collection" ? {"--collection-rows":savedCollectionRows,"--collection-row-height":`${collectionRowHeight}px`,"--collection-row-gap":`${collectionRowGap}px`} : undefined} aria-label="Style previews" tabIndex={0}>
        {visibleStyles.map(style=><article className={`stylebuilder-tile ${selected.some(item=>keyOf(item)===keyOf(style))?"selected":""}`} key={keyOf(style)}><button className="stylebuilder-tile-open" onClick={()=>openDetails(style)} aria-label={`View ${style.name}`}><StyleMosaic style={style}/><span className="stylebuilder-tile-name">{style.sref?.replace(/^--sref\s+/,"")||style.name}</span></button><button className={`stylebuilder-tile-star ${isSaved(style)?"saved":""}`} aria-label={`${isSaved(style)?"Remove from collection":"Save to collection"}: ${style.name}`} aria-pressed={isSaved(style)} title={isSaved(style)?"Unstar and remove from your collection":"Save to your collection"} disabled={busy||!library} onClick={()=>toggleSavedLook(style)}><Star size={16} fill={isSaved(style)?"currentColor":"none"}/></button></article>)}
        {!visibleStyles.length&&<div className="stylebuilder-empty"><Layers size={27}/><p>{catalogLoading?"Reading your local style library…":scope==="library"&&!catalog?.ready?"Your local ideas library will appear here as it becomes available.":scope==="selected"?"Choose catalog looks to save or send to a node.":"No styles match this view."}</p>{scope==="collection"&&<button onClick={()=>setScope("library")}>Browse catalog <ArrowRight size={15}/></button>}</div>}
      </div>
      {scope==="collection"&&<CollectionResizeHandle rows={savedCollectionRows} onChange={setCollectionRows}/>}
      {scope==="library"&&catalog&&catalog.styles.length<catalog.total&&<button className="stylebuilder-load-more" disabled={catalogLoading} onClick={()=>loadCatalog({offset:catalog.styles.length})}>{catalogLoading?"Loading…":"More Styles"} <ArrowRight size={15}/></button>}
      <div className="stylebuilder-selection"><span>{selected.length?`${selected.length} style${selected.length===1?"":"s"} selected`:"Select a style to begin"}</span><div className="library-inline"><button disabled={busy||!library||!selected.length||selected.every(isSaved)} onClick={()=>saveReferences(selected)}><Star size={15}/> Save selected</button><button disabled={!selected.some(style=>style.examples?.length)||busy} onClick={()=>addToBoard(selected)}>Create Mood Board node</button><button disabled={selected.length!==1||(!selected[0]?.styleAnalysis?.stylePrompt&&!selected[0]?.examples?.length)||busy} title={selected.length>1?"Select one catalog look to use in Style":"Use the selected catalog look"} onClick={()=>createStyleNode(selected[0])}>Use selected in Style <ArrowUpRight size={15}/></button>{selected.length>0&&<button className="stylebuilder-icon" aria-label="Clear selected styles" onClick={()=>setSelected([])}><X size={16}/></button>}</div></div>
    </section>
    <CatalogEditorial onOpenLook={openDetails}/>
    <dialog ref={dialog} className="library-style-detail" aria-label="Style details" onCancel={event=>{event.preventDefault();closeDetails();}}><button className="stylebuilder-detail-close" aria-label="Close style details" onClick={closeDetails}><X size={20}/></button>{detailLoading&&<p role="status">Loading style details…</p>}{error&&<p className="library-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{activeStyle&&<><span className="stylebuilder-eyebrow">{activeStyle.category||"SAVED LOOK"}</span><h2>{activeStyle.name}</h2><div className="library-detail-examples">{(activeStyle.examples||[]).map((image,index)=><button key={`${image.id}-${index}`} className="library-example-open" aria-label={`Enlarge ${activeStyle.name} example ${index+1}`} onClick={()=>setPreviewIndex(index)}><img src={imageUrl(image)} alt={`${activeStyle.name} example ${index+1}`}/></button>)}</div>{!activeStyle.examples?.length&&<p className="library-muted">Examples for this style are still downloading. Refresh the catalog when they are ready.</p>}<p className="library-muted">Use in Style analyzes the examples and observations with Astra once (paid), then saves the description for future use.</p><p className="library-detail-description">{activeStyle.styleAnalysis?.stylePrompt||activeStyle.prompt||"The visual description for this catalog look has not downloaded yet. Refresh the catalog when it is ready."}</p>{activeStyle.sref&&<code>{activeStyle.sref}</code>}<p className="library-muted">{activeStyle.tags?.join(" · ")}</p><div className="library-inline"><button className="library-primary" disabled={busy} onClick={()=>toggleStyle(activeStyle)}>{selected.some(item=>keyOf(item)===keyOf(activeStyle))?"Deselect style":"Select style"}</button><button aria-label={isSaved(activeStyle)?"Remove from my collection":"Save to my collection"} aria-pressed={isSaved(activeStyle)} disabled={busy||!library} onClick={()=>toggleSavedLook(activeStyle)}><Star size={16} fill={isSaved(activeStyle)?"currentColor":"none"}/>{isSaved(activeStyle)?"Remove from collection":"Save to collection"}</button><button disabled={busy||!activeStyle.examples?.length} onClick={()=>addToBoard([activeStyle])}>Create Mood Board node</button><button disabled={busy||(!activeStyle.styleAnalysis?.stylePrompt&&!activeStyle.examples?.length)} onClick={()=>createStyleNode(activeStyle)}>Use in Style <ArrowUpRight size={15}/></button>{!activeStyle.catalog&&<><button disabled={busy} onClick={()=>act(async()=>{await save(library.collections.map(item=>({...item,styles:item.styles.filter(style=>style.id!==activeStyle.id)})));setSelected(current=>current.filter(style=>keyOf(style)!==keyOf(activeStyle)));closeDetails();})}>Remove style</button></>}</div></>}</dialog>
    <dialog ref={previewDialog} className="library-image-preview" aria-label="Look example preview" onCancel={event=>{event.preventDefault();closePreview();}} onClick={event=>{if(event.target===event.currentTarget)closePreview();}} onKeyDown={event=>{if(event.key==="ArrowRight"&&activeStyle?.examples?.length){event.preventDefault();setPreviewIndex(index=>(index+1)%activeStyle.examples.length);}if(event.key==="ArrowLeft"&&activeStyle?.examples?.length){event.preventDefault();setPreviewIndex(index=>(index-1+activeStyle.examples.length)%activeStyle.examples.length);}}}>
      <button className="library-preview-close" aria-label="Close example preview" onClick={closePreview}><X size={22}/></button>
      {previewIndex!==null&&activeStyle?.examples?.[previewIndex]&&<><img src={imageUrl(activeStyle.examples[previewIndex])} alt={`${activeStyle.name} example ${previewIndex+1}, enlarged`}/><div className="library-preview-controls"><button aria-label="Previous example" disabled={activeStyle.examples.length<2} onClick={()=>setPreviewIndex(index=>(index-1+activeStyle.examples.length)%activeStyle.examples.length)}>Previous</button><span>{previewIndex+1} / {activeStyle.examples.length}</span><button aria-label="Next example" disabled={activeStyle.examples.length<2} onClick={()=>setPreviewIndex(index=>(index+1)%activeStyle.examples.length)}>Next</button></div></>}
    </dialog>
  </div>;
}
