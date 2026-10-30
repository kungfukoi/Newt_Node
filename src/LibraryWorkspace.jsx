import React from "react";
import { Search, SlidersHorizontal, ArrowUpRight, ArrowRight, Check, X, RefreshCw, Palette, Layers, Star } from "lucide-react";
import { styleLibraryApi, nodeApi } from "./api/newtApi.js";
import { normalizeLibraryStyle, libraryStylesMatching, libraryStyleSnapshot, collectionExamples } from "./styleLibrary.js";
import { displayMediaUrl } from "./mediaAssets.js";
import "./LibraryWorkspace.css";

const keyOf = style => `${style.catalog ? "catalog" : "saved"}:${style.id}`;
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
  const [selected,setSelected]=React.useState([]), [activeStyle,setActiveStyle]=React.useState(null), [detailLoading,setDetailLoading]=React.useState(false);
  const [settingsOpen,setSettingsOpen]=React.useState(false), [collectionName,setCollectionName]=React.useState("");
  const [busy,setBusy]=React.useState(false), [error,setError]=React.useState(""), [notice,setNotice]=React.useState("");
  const dialog=React.useRef(null), request=React.useRef(0), detailRequest=React.useRef(0), imported=React.useRef(new Map());
  const collection=library?.collections.find(item=>item.id===collectionId);
  const sourceStyles=scope==="library" ? (catalog?.styles||[]).map(style=>({...style,catalog:true})) : scope==="selected" ? selected : (collection?.styles||[]);
  const visibleStyles=scope==="library" ? sourceStyles : libraryStylesMatching(sourceStyles,query);
  const isSaved = style => Boolean(library?.collections.some(item => item.styles.some(saved => saved.id === style.id || (style.sourceUrl && saved.sourceUrl === style.sourceUrl && saved.name === style.name))));

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
  async function act(action) { setBusy(true);setError("");setNotice("");try{await action();}catch(e){setError(e.message);}finally{setBusy(false);} }
  async function save(collections) { const value=await styleLibraryApi.save({...library,collections});setLibrary(value);return value; }
  async function createCollection(event) {
    event.preventDefault(); await act(async()=>{const id=crypto.randomUUID();await save([...library.collections,{id,name:collectionName.trim(),styles:[]}]);setCollectionId(id);setCollectionName("");});
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
  async function createStyleNode(style) {
    await act(async () => {
      if (!library) throw new Error("Wait for your library to load before creating a Style node.");
      const source = style.catalog ? (await styleLibraryApi.detail(style.id)).style : style;
      const local = await materialize(source);
      const snapshot = libraryStyleSnapshot(local);
      if (!snapshot.prompt) throw new Error("This catalog style’s visual description has not downloaded yet. Refresh the catalog and try again.");
      const existingCollection = library.collections.find(item => item.styles.some(saved => saved.id === local.id || (local.sourceUrl && saved.sourceUrl === local.sourceUrl && saved.name === local.name && libraryStyleSnapshot(saved).prompt === snapshot.prompt)));
      const existing = existingCollection?.styles.find(saved => saved.id === local.id || (local.sourceUrl && saved.sourceUrl === local.sourceUrl && saved.name === local.name && libraryStyleSnapshot(saved).prompt === snapshot.prompt));
      let target = existingCollection || collection, collections = library.collections;
      if (!target) { target = { id: crypto.randomUUID(), name: "My styles", styles: [] }; collections = [...collections, target]; }
      const savedStyle = { ...local, id: existing?.id || (style.catalog ? crypto.randomUUID() : local.id) };
      const styles = existing ? target.styles.map(item => item.id === existing.id ? savedStyle : item) : [...target.styles, savedStyle];
      await save(collections.map(item => item.id === target.id ? { ...item, styles } : item));
      setCollectionId(target.id);
      closeDetails();
      onCreateStyle(libraryStyleSnapshot(savedStyle));
    });
  }
  async function addToBoard(styles) {
    await act(async()=>{
      const local=await Promise.all(styles.map(materialize));
      const examples=collectionExamples(local).slice(0,6);
      if(!examples.length)throw new Error("These styles have no downloaded examples yet. Refresh the catalog when they are ready.");
      const prompt=styles.map(style=>libraryStyleSnapshot(style).prompt||style.notes).filter(Boolean).join("\n\n");
      closeDetails();
      onCreateMoodBoard({name:styles.length===1?`${styles[0].name} mood board`:"Style mood board",examples,prompt});
    });
  }
  return <div className="library-workspace stylebuilder-workspace">
    <header className="stylebuilder-hero"><h1>Looks</h1><p>Explore the catalog. Save your favorites. Bring a look into your next creation.</p><button type="button" className={`stylebuilder-icon stylebuilder-settings-toggle ${settingsOpen?"active":""}`} aria-label="Looks settings" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(!settingsOpen)}><SlidersHorizontal size={23}/></button></header>
    {error&&<div className="library-error" role="alert">{error}<button disabled={busy} onClick={loadLibrary}>Retry</button></div>}{notice&&<p className="stylebuilder-notice" role="status">{notice}</p>}
    {settingsOpen&&<section className="library-panel stylebuilder-settings"><div className="stylebuilder-section-title"><h2>Collections</h2><button onClick={()=>{loadLibrary();loadCatalog({refresh:true});}} disabled={busy||catalogLoading}><RefreshCw size={15}/> Refresh library</button></div>{library&&<><form className="library-inline" onSubmit={createCollection}><input aria-label="New collection name" placeholder="New collection name" required maxLength={120} value={collectionName} onChange={event=>setCollectionName(event.target.value)}/><button disabled={busy||!collectionName.trim()}>Create collection</button></form><label>Save to collection<select aria-label="Collection" value={collectionId} onChange={event=>setCollectionId(event.target.value)}><option value="" disabled>Choose a collection</option>{library.collections.map(item=><option key={item.id} value={item.id}>{item.name} ({item.styles.length})</option>)}</select></label></>}<p className="library-muted">Star catalog looks to save them here. Choose a saved look in the Style node’s Looks dropdown.</p></section>}
    <section className="stylebuilder-browse" aria-label="Looks catalog"><div className="stylebuilder-browse-toolbar"><p>Explore the catalog. <span>Choose a look</span></p><div className="stylebuilder-browse-controls"><select aria-label="Looks source" value={scope} onChange={event=>setScope(event.target.value)}><option value="library">Catalog</option><option value="collection">My collection</option><option value="selected">Selected ({selected.length})</option></select><label className="stylebuilder-search"><Search size={18}/><input aria-label="Search looks" placeholder="Search looks" value={query} onChange={event=>setQuery(event.target.value)}/></label><button className="stylebuilder-icon" aria-label="Refresh catalog" title="Pick up newly downloaded styles" disabled={catalogLoading} onClick={()=>loadCatalog({refresh:true})}><RefreshCw size={17} className={catalogLoading?"spin":""}/></button></div></div>
      {scope==="library"&&catalog?.categories?.length>0&&<div className="stylebuilder-catalog-meta"><span>{catalog.indexed.toLocaleString()} local styles{catalog.populating?" · catalog still populating":""}</span><select aria-label="Look category" value={category} onChange={event=>setCategory(event.target.value)}><option value="">All categories</option>{catalog.categories.map(item=><option key={item}>{item}</option>)}</select></div>}
      {catalogError&&scope==="library"&&<p className="library-error" role="alert">{catalogError}</p>}
      <div className="stylebuilder-style-strip" aria-label="Style previews" tabIndex={0}>
        {visibleStyles.map(style=><article className={`stylebuilder-tile ${selected.some(item=>keyOf(item)===keyOf(style))?"selected":""}`} key={keyOf(style)}><button className="stylebuilder-tile-open" onClick={()=>openDetails(style)} aria-label={`View ${style.name}`}><StyleMosaic style={style}/><span className="stylebuilder-tile-name">{style.sref?.replace(/^--sref\s+/,"")||style.name}</span></button><button className={`stylebuilder-tile-star ${isSaved(style)?"saved":""}`} aria-label={`${isSaved(style)?"Saved to collection":"Save to collection"}: ${style.name}`} aria-pressed={isSaved(style)} title={isSaved(style)?"Saved to your collection":"Save to your collection"} disabled={busy||!library||isSaved(style)} onClick={()=>saveReference(style)}><Star size={16} fill={isSaved(style)?"currentColor":"none"}/></button><label className="stylebuilder-tile-select" title={`Select ${style.name}`}><input type="checkbox" aria-label={style.name} checked={selected.some(item=>keyOf(item)===keyOf(style))} disabled={busy} onChange={()=>toggleStyle(style)}/><Check size={14}/></label></article>)}
        {!visibleStyles.length&&<div className="stylebuilder-empty"><Layers size={27}/><p>{catalogLoading?"Reading your local style library…":scope==="library"&&!catalog?.ready?"Your local ideas library will appear here as it becomes available.":scope==="selected"?"Choose catalog looks to save or send to a node.":"No styles match this view."}</p>{scope==="collection"&&<button onClick={()=>setScope("library")}>Browse catalog <ArrowRight size={15}/></button>}</div>}
      </div>
      {scope==="library"&&catalog&&catalog.styles.length<catalog.total&&<button className="stylebuilder-load-more" disabled={catalogLoading} onClick={()=>loadCatalog({offset:catalog.styles.length})}>{catalogLoading?"Loading…":"More styles"} <ArrowRight size={15}/></button>}
      <div className="stylebuilder-selection"><span>{selected.length?`${selected.length} style${selected.length===1?"":"s"} selected`:"Select a style to begin"}</span><div className="library-inline"><button disabled={busy||!library||!selected.length||selected.every(isSaved)} onClick={()=>saveReferences(selected)}><Star size={15}/> Save selected</button><button disabled={!selected.some(style=>style.examples?.length)||busy} onClick={()=>addToBoard(selected)}>Create Mood Board node</button><button disabled={selected.length!==1||!libraryStyleSnapshot(selected[0]||{}).prompt||busy} title={selected.length>1?"Select one catalog look to use in Style":"Use the selected catalog look"} onClick={()=>createStyleNode(selected[0])}>Use selected in Style <ArrowUpRight size={15}/></button>{selected.length>0&&<button className="stylebuilder-icon" aria-label="Clear selected styles" onClick={()=>setSelected([])}><X size={16}/></button>}</div></div>
    </section>
    <dialog ref={dialog} className="library-style-detail" aria-label="Style details" onCancel={event=>{event.preventDefault();closeDetails();}}><button className="stylebuilder-detail-close" aria-label="Close style details" onClick={closeDetails}><X size={20}/></button>{detailLoading&&<p role="status">Loading style details…</p>}{error&&<p className="library-error" role="alert">{error}</p>}{activeStyle&&<><span className="stylebuilder-eyebrow">{activeStyle.category||"SAVED LOOK"}</span><h2>{activeStyle.name}</h2><div className="library-detail-examples">{(activeStyle.examples||[]).map((image,index)=><img key={`${image.id}-${index}`} src={imageUrl(image)} alt={`${activeStyle.name} example ${index+1}`}/>)}</div>{!activeStyle.examples?.length&&<p className="library-muted">Examples for this style are still downloading. Refresh the catalog when they are ready.</p>}<p className="library-detail-description">{activeStyle.prompt||"The visual description for this catalog look has not downloaded yet. Refresh the catalog when it is ready."}</p>{activeStyle.sref&&<code>{activeStyle.sref}</code>}<p className="library-muted">{activeStyle.tags?.join(" · ")}</p><div className="library-inline"><button className="library-primary" disabled={busy} onClick={()=>toggleStyle(activeStyle)}>{selected.some(item=>keyOf(item)===keyOf(activeStyle))?"Deselect style":"Select style"}</button><button aria-label={isSaved(activeStyle)?"Saved to my collection":"Save to my collection"} aria-pressed={isSaved(activeStyle)} disabled={busy||!library||isSaved(activeStyle)} onClick={()=>saveReference(activeStyle)}><Star size={16} fill={isSaved(activeStyle)?"currentColor":"none"}/>{isSaved(activeStyle)?"Saved to collection":"Save to collection"}</button><button disabled={busy||!activeStyle.examples?.length} onClick={()=>addToBoard([activeStyle])}>Create Mood Board node</button><button disabled={busy||!libraryStyleSnapshot(activeStyle).prompt} onClick={()=>createStyleNode(activeStyle)}>Use in Style <ArrowUpRight size={15}/></button>{!activeStyle.catalog&&<><button disabled={busy} onClick={()=>act(async()=>{await save(library.collections.map(item=>({...item,styles:item.styles.filter(style=>style.id!==activeStyle.id)})));setSelected(current=>current.filter(style=>keyOf(style)!==keyOf(activeStyle)));closeDetails();})}>Remove style</button></>}</div></>}</dialog>
  </div>;
}
