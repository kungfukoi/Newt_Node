import React from "react";
import { Search, ArrowUpRight, ArrowRight, X, RefreshCw, Palette, Layers, Star, FolderPlus } from "lucide-react";
import { styleLibraryApi, nodeApi } from "./api/newtApi.js";
import { normalizeLibraryStyle, libraryStylesMatching, libraryStyleSnapshot, lookStyleDescription, portableStylePrompt, collectionExamples } from "./styleLibrary.js";
import { displayMediaUrl } from "./mediaAssets.js";
import "./LibraryWorkspace.css";
import CollectionResizeHandle from "./components/CollectionResizeHandle.jsx";
import LookbookShuttle from "./components/LookbookShuttle.jsx";
import LookbookSelect from "./components/LookbookSelect.jsx";
import CreateLookDialog from "./components/CreateLookDialog.jsx";
import LookDetailExtras from "./components/LookDetailExtras.jsx";
import LookDescription from "./components/LookDescription.jsx";
import { lookSourceOptions, lookLibraryOptions, namedLookCollections, findStarredCatalog, shuffleCatalogLooks, uniqueCatalogLooks, allSavedCatalogLooks, sameLook } from "./lookCatalogs.js";
import { collectionRows, collectionRowHeight, collectionRowGap, collectionFrameChrome } from "./collectionFrame.js";
import { uiGet, uiSet } from "./uiState.js";

const keyOf = style => `${style.catalog ? "catalog" : "saved"}:${style.id}`;
const collectionHasLook = (collection, style) => collection.styles.some(saved => sameLook(saved, style));
const imageUrl = image => image.localUrl ? displayMediaUrl(image.localUrl) : styleLibraryApi.catalogAssetUrl(image.url);
function StyleMosaic({ style }) {
  const examples = (style.examples || []).slice(0, 4);
  return <span className={`stylebuilder-mosaic mosaic-${examples.length}`}>
    {examples.length ? <><img className="stylebuilder-cover" src={imageUrl(examples[0])} alt={`${style.name} first example`} loading="lazy" decoding="async"/><span className="stylebuilder-mosaic-grid" aria-hidden="true">{examples.map((image,index)=><img key={`${image.id}-${index}`} src={imageUrl(image)} alt="" loading="lazy" decoding="async" onError={event=>{event.currentTarget.style.visibility="hidden";}}/>)}</span></> : <span className="stylebuilder-no-preview"><Palette size={27}/><span>No preview available</span></span>}
  </span>;
}

export default function LibraryWorkspace({ active = true, onCreateMoodBoard, onCreateStyle }) {
  const [creatingLook, setCreatingLook] = React.useState(false);
  const [deleteLookRequest,setDeleteLookRequest]=React.useState(null);
  const [mosaicDetails,setMosaicDetails]=React.useState(()=>new Map()),mosaicPending=React.useRef(new Set());
  const [deletingCatalog,setDeletingCatalog]=React.useState("");
  const [library,setLibrary]=React.useState(null);
  const [collectionAction,setCollectionAction]=React.useState(null);
  const [collectionName,setCollectionName]=React.useState("");
  const [savedDestination,setSavedDestination]=React.useState(null);
  const collectionDialog=React.useRef(null);
  const [browseCollectionId,setBrowseCollectionId]=React.useState("");
  const [selectedLooks,setSelectedLooks]=React.useState(()=>new Map());
  const [sharedCatalogRevision,setSharedCatalogRevision]=React.useState(0);
  const [showLocalLooks,setShowLocalLooks]=React.useState(false);
  const [removeError,setRemoveError]=React.useState("");
  const [catalog,setCatalog]=React.useState(null), [catalogLoading,setCatalogLoading]=React.useState(false), [catalogFailure,setCatalogFailure]=React.useState(null);
  const [query,setQuery]=React.useState(""), [category,setCategory]=React.useState(""), [scope,setScope]=React.useState("stylefinder");
  const [lastSource,setLastSource]=React.useState("stylefinder");
  const [lastLibraryView,setLastLibraryView]=React.useState("saved");
  const [savedCollectionRows, setCollectionRows] = React.useState(() => collectionRows(uiGet("lookbookCollectionRows", 1)));
  React.useEffect(() => { uiSet("lookbookCollectionRows", savedCollectionRows); }, [savedCollectionRows]);
  const [savedCatalogRows, setCatalogRows] = React.useState(() => collectionRows(uiGet("lookbookCatalogRows", 1)));
  const [styleFinderRows,setStyleFinderRows]=React.useState(()=>collectionRows(uiGet("lookbookStyleFinderRows",1)));
  React.useEffect(()=>{uiSet("lookbookStyleFinderRows",styleFinderRows);},[styleFinderRows]);
  const [sharedLookRows,setSharedLookRows]=React.useState(()=>collectionRows(uiGet("lookbookSharedUserRows",1)));
  React.useEffect(()=>{uiSet("lookbookSharedUserRows",sharedLookRows);},[sharedLookRows]);
  React.useEffect(() => { uiSet("lookbookCatalogRows", savedCatalogRows); }, [savedCatalogRows]);
  const [namedCatalogRows,setNamedCatalogRows]=React.useState(()=>uiGet("lookbookNamedCatalogRows", {}) || {});
  React.useEffect(()=>{uiSet("lookbookNamedCatalogRows",namedCatalogRows);},[namedCatalogRows]);
  const changeFrameRows=React.useCallback(value=>{
    const rows=collectionRows(value);
    if(scope==="library")setCatalogRows(rows);
    else if(scope==="stylefinder")setStyleFinderRows(rows);
    else if(scope==="shared-user-looks")setSharedLookRows(rows);
    else if(scope==="starred")setCollectionRows(rows);
    else setNamedCatalogRows(current=>({...current,[scope==="collection"?browseCollectionId:scope]:rows}));
  },[scope,browseCollectionId]);
  const frameRef = React.useRef(null);
  const resizable = true;
  const frameRows = scope === "library" ? savedCatalogRows : scope === "stylefinder" ? styleFinderRows : scope === "shared-user-looks" ? sharedLookRows : scope === "starred" ? savedCollectionRows : collectionRows(namedCatalogRows[scope==="collection"?browseCollectionId:scope] ?? 1);
  const [activeStyle,setActiveStyle]=React.useState(null), [detailLoading,setDetailLoading]=React.useState(false);
  const [busy,setBusy]=React.useState(false), [error,setError]=React.useState(""), [notice,setNotice]=React.useState("");
  const [previewIndex, setPreviewIndex] = React.useState(null);
  const previewDialog = React.useRef(null);
  const searchInput = React.useRef(null);
  const dialog=React.useRef(null), request=React.useRef(0), detailRequest=React.useRef(0), imported=React.useRef(new Map());
  const starredCollection=findStarredCatalog(library?.collections);
  const starredTarget=starredCollection || {id:"system-starred",name:"Starred",styles:[]};
  const namedCollections = namedLookCollections(library?.collections);
  const activeMemberships = activeStyle ? namedCollections.filter(collection => collectionHasLook(collection, activeStyle)) : [];
  const browseCollection=library?.collections.find(item=>item.id===browseCollectionId);
  const canManageCollection=scope==="collection"&&browseCollection&&browseCollection.id!=="system-starred"&&browseCollection!==starredCollection;
  const canCreateCollection=Boolean(library && library.collections.length<100);
  React.useEffect(()=>setDeletingCatalog(""),[scope,browseCollectionId]);
  const sharedUserLooks=scope==="shared-user-looks";
  const [showFilmStills,setShowFilmStills]=React.useState(false);
  const allLooks=scope==="all";
  const includeLocalInAll=allLooks&&showLocalLooks;
  const includeFilmStillsInAll=allLooks&&showFilmStills;
  const catalogRefresh=sharedCatalogRevision;
  const isSourceCatalog=scope==="library"||scope==="stylefinder"||sharedUserLooks||allLooks||scope==="local-looks"||scope==="film-stills";
  const catalogViewKey=JSON.stringify([scope,query,category]);
  const currentCatalog=catalog?.viewKey===catalogViewKey?catalog:null;
  const catalogError=catalogFailure?.viewKey===catalogViewKey?catalogFailure.message:"";
  const waitingForCatalog=isSourceCatalog&&(catalogLoading||(!currentCatalog&&!catalogError));
  const sharedTotal=currentCatalog?.total??0;
  const matchesCategory=style=>!category||style.category===category||style.tags?.includes(category);
  const sourceStyles=isSourceCatalog
    ? (currentCatalog?.previewStyles||[]).map(style=>({...style,catalog:true}))
    : scope==="saved" ? allSavedCatalogLooks(library?.collections)
    : scope==="starred" ? (starredCollection?.styles||[]) : (browseCollection?.styles||[]);
  const browserValue=scope==="collection" ? `collection:${browseCollectionId}` : scope;
  const sourceOptions=lookSourceOptions(showLocalLooks,showFilmStills);
  const libraryOptions=lookLibraryOptions(library?.collections);
  const browserOptions=isSourceCatalog?sourceOptions:libraryOptions;
  const browserName=browserOptions.find(option=>option.value===browserValue)?.label || "Catalog";
  function chooseCatalog(value) {
    if(value===browserValue)return;
    request.current++;setCatalog(null);setCatalogLoading(false);setCatalogFailure(null);setCategory("");
    setSavedDestination(null);setNotice("");
    if(value==="saved"||value==="starred"||value.startsWith("collection:"))setLastLibraryView(value);
    else setLastSource(value);
    if(value.startsWith("collection:")){setBrowseCollectionId(value.slice(11));setScope("collection");}else setScope(value);
  }
  const filterCategories=isSourceCatalog?(catalog?.categories||[]):[...new Set(sourceStyles.map(style=>style.category).filter(Boolean))].sort();
  const visibleStyles=isSourceCatalog ? sourceStyles : libraryStylesMatching(sourceStyles,query).filter(matchesCategory);
  React.useEffect(()=>{if(category&&(!isSourceCatalog||currentCatalog)&&!filterCategories.includes(category))setCategory("");},[category,isSourceCatalog,currentCatalog,filterCategories.join("\n")]);
  const isStarred = style => Boolean(starredCollection?.styles.some(saved => sameLook(saved, style)));

  async function loadLibrary() {
    setBusy(true); setError("");
    try { setLibrary(await styleLibraryApi.read()); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  const loadCatalog = React.useCallback(async ({offset=0,offsets,refresh=false,search=query,filter=category,source=scope,directory}={}) => {
    const append=Boolean(offset||offsets);
    const version=++request.current;
    const viewKey=JSON.stringify([source,search,filter]);
    setCatalogLoading(true);setCatalogFailure(null);
    if(!offset&&source==="shared-user-looks")setCatalog(current=>current&&{...current,viewKey:null,warning:""});
    try {
      const value=source==="all"
        ? await styleLibraryApi.allCatalogs({query:search,category:filter,refresh,offsets,includeLocal:includeLocalInAll,includeFilmStills:includeFilmStillsInAll})
        : await styleLibraryApi.catalog({query:search,category:filter,offset,refresh,source});
      if(version!==request.current)return;
      if(offset&&source==="shared-user-looks"&&value.looksDirectory!==directory){
        setSelectedLooks(new Map());
        setSharedCatalogRevision(current=>current+1);
        return;
      }
      if(offset && offset<value.total && !value.styles.length)throw new Error("Could not load more looks. Refresh the catalog to try again.");
      if(!append && frameRef.current)frameRef.current.scrollLeft=0;
      const shuffledPage = shuffleCatalogLooks(value.styles);
      setCatalog(current=>{
        const styles = append ? [...current.styles, ...value.styles] : value.styles;
        const previousPreviews = append ? current.previewStyles : [];
        // Resolve duplicate identities in source order before applying the display order.
        const newLooks = source === "all" ? new Set(uniqueCatalogLooks(styles).slice(previousPreviews.length)) : null;
        const pagePreviews = newLooks ? shuffledPage.filter(style => newLooks.has(style)) : shuffledPage;
        return {
          ...value,
          viewKey,
          styles,
          previewStyles: [...previousPreviews, ...pagePreviews],
          ...(offsets&&{categories:[...new Set([...current.categories,...value.categories])].sort(),
            warning:[...new Set([current.warning,value.warning].filter(Boolean))].join(" "),
            truncated:current.truncated||value.truncated}),
        };
      });
    }
    catch(e) { if(version===request.current)setCatalogFailure({viewKey,message:e.message}); } finally { if(version===request.current)setCatalogLoading(false); }
  },[query,category,scope,includeLocalInAll,includeFilmStillsInAll]);
  React.useEffect(()=>{loadLibrary();},[]);
  React.useEffect(()=>{
    const update=()=>styleLibraryApi.storage().then(value=>{
      setShowLocalLooks(value.mode==="local");
      setShowFilmStills(Boolean(value.filmStillsDirectory));
      if(!value.filmStillsDirectory)setScope(current=>current==="film-stills"?"stylefinder":current);
    }).catch(()=>{});
    update();
    window.addEventListener("newtnode:lookbook-storage-updated",update);
    return()=>window.removeEventListener("newtnode:lookbook-storage-updated",update);
  },[]);
  React.useEffect(()=>{setSelectedLooks(new Map());setRemoveError("");},[scope,query,category,browseCollectionId,catalog?.looksDirectory]);
  React.useEffect(()=>{if(!active||!isSourceCatalog)return;const timer=setTimeout(()=>loadCatalog(),250);return()=>{clearTimeout(timer);request.current++;};},[active,isSourceCatalog,loadCatalog,catalogRefresh]);
  React.useEffect(()=>{
    if(!isSourceCatalog || catalogLoading || catalogError || catalog?.viewKey!==catalogViewKey) return;
    const offset=catalog.styles.length;
    if(allLooks?!Object.keys(catalog.nextOffsets||{}).length:!offset||offset>=catalog.total) return;
    const strip=frameRef.current;
    const lastTile=strip?.lastElementChild;
    if(!lastTile) return;

    const version=request.current;
    const observer=new IntersectionObserver(([entry])=>{
      if(entry.intersectionRatio>=0.99 && version===request.current){
        if(allLooks)loadCatalog({offsets:catalog.nextOffsets});
        else loadCatalog({offset,directory:catalog.looksDirectory});
      }
    },{root:strip,threshold:0.99});
    observer.observe(lastTile);
    return ()=>observer.disconnect();
  },[allLooks,isSourceCatalog,catalog,catalogLoading,catalogError,catalogViewKey,loadCatalog]);
  React.useEffect(()=>{
    const storageChanged=()=>{
      if(!isSourceCatalog)return;
      setSelectedLooks(new Map());closePreview();closeDetails();loadCatalog();
    };
    window.addEventListener("newtnode:lookbook-storage-updated",storageChanged);
    return()=>window.removeEventListener("newtnode:lookbook-storage-updated",storageChanged);
  },[scope,query,category]);
  React.useEffect(()=>{if(activeStyle||detailLoading){if(!dialog.current?.open)dialog.current?.showModal();}},[activeStyle,detailLoading]);
  React.useEffect(()=>{
    if(collectionAction&&!collectionDialog.current?.open)collectionDialog.current?.showModal();
    if(collectionAction&&(collectionAction.mode==="create"||collectionAction.mode==="rename"))collectionDialog.current?.querySelector("input")?.focus();
  },[collectionAction?.mode]);
  React.useEffect(() => { if (previewIndex !== null && !previewDialog.current?.open) previewDialog.current?.showModal(); }, [previewIndex]);
  function closePreview() { previewDialog.current?.close(); setPreviewIndex(null); }
  async function act(action, {refreshConflict=false} = {}) {
    setBusy(true);setError("");setNotice("");setSavedDestination(null);
    try {
      await action();
      return true;
    } catch (error) {
      setNotice("");
      if(refreshConflict&&error.status===409){
        try {
          setLibrary(await styleLibraryApi.read());
          setError(`${error.message} The library has been refreshed. Review your changes and try again.`);
          return false;
        } catch { /* Keep the original error if the refresh fails. */ }
      }
      setError(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(collections) { const value=await styleLibraryApi.save({...library,collections});setLibrary(value);return value; }

  function openCollectionAction(mode, looks = [], target, fromSelection = false) {
    setError("");setNotice("");setSavedDestination(null);
    setCollectionName(target?.name || "");
    setCollectionAction({mode,looks,targetId:target?.id || "",fromSelection,membershipChanges:new Map()});
  }
  function openCollectionPicker(looks, fromSelection = false) {
    const mode = namedCollections.length ? (fromSelection ? "add" : "memberships") : "create";
    openCollectionAction(mode,looks,undefined,fromSelection);
  }
  function closeCollectionAction() {
    collectionDialog.current?.close();
    setCollectionAction(null);
    setError("");
  }
  function validateCollectionName(name, ownId) {
    const trimmed=name.trim();
    if(!trimmed||trimmed.length>120)throw new Error("Name your collection using 1–120 characters.");
    const lower=trimmed.toLowerCase();
    if(["starred","all saved","my styles","all","catalog","commercial","stylefinder","looks catalog","user looks","local looks","film stills"].includes(lower)||library.collections.some(item=>item.id!==ownId&&item.name.toLowerCase()===lower)){
      throw new Error("That collection name is already in use.");
    }
    return trimmed;
  }
  async function submitCollectionAction(event) {
    event.preventDefault();
    const {mode,looks,targetId,fromSelection,membershipChanges}=collectionAction;
    const succeeded=await act(async()=>{
      if(mode==="rename"){
        const target=library.collections.find(item=>item.id===targetId);
        if(!target)throw new Error("This collection is no longer available.");
        const name=validateCollectionName(collectionName,targetId);
        await save(library.collections.map(item=>item.id===targetId?{...item,name}:item));
        setNotice(`Renamed collection to ${name}.`);
      }else if(mode==="create"){
        if(!canCreateCollection)throw new Error("Your library has reached the collection limit.");
        const target={id:crypto.randomUUID(),name:validateCollectionName(collectionName),styles:[]};
        if(membershipChanges.size)await saveLookMemberships(looks[0],membershipChanges,target);
        else if(looks.length)await addCollectionLooks(looks,target);
        else {
          await save([...library.collections,target]);
          chooseCatalog(`collection:${target.id}`);
          setNotice(`Created ${target.name}.`);
        }
      }else if(mode==="memberships"){
        await saveLookMemberships(looks[0],membershipChanges);
      }else {
        const target=namedCollections.find(item=>item.id===targetId);
        if(!target)throw new Error("Choose a collection to save these looks.");
        await addCollectionLooks(looks,target);
      }
    }, {refreshConflict:true});
    if(succeeded){
      if(fromSelection)setSelectedLooks(new Map());
      closeCollectionAction();
    }
  }
  function changeLookMembership(collection, checked) {
    setCollectionAction(current => {
      const membershipChanges = new Map(current.membershipChanges);
      if (checked === collectionHasLook(collection, current.looks[0])) membershipChanges.delete(collection.id);
      else membershipChanges.set(collection.id, checked);
      return { ...current, membershipChanges };
    });
  }
  async function saveLookMemberships(style, changes, newCollection) {
    const additions = namedCollections.filter(collection => changes.get(collection.id) === true && !collectionHasLook(collection, style));
    const removals = namedCollections.filter(collection => changes.get(collection.id) === false && collectionHasLook(collection, style));
    if (newCollection) additions.push(newCollection);
    if (!additions.length && !removals.length) return;
    const full = additions.find(collection => collection.styles.length >= 500);
    if (full) throw new Error(`${full.name} already contains 500 looks.`);

    const snapshot = additions.length ? await prepareCollectionLook(style, allSavedCatalogLooks(library.collections)) : null;
    const collections = newCollection ? [...library.collections, newCollection] : library.collections;
    await save(collections.map(collection => {
      if (additions.includes(collection)) {
        return { ...collection, styles: [...collection.styles, { ...snapshot, id: crypto.randomUUID() }] };
      }
      if (removals.includes(collection)) {
        return { ...collection, styles: collection.styles.filter(saved => !sameLook(saved, style)) };
      }
      return collection;
    }));
    if (removals.includes(browseCollection) && scope === "collection") {
      setSelectedLooks(current => new Map([...current].filter(([,saved]) => !sameLook(saved,style))));
    }
    setNotice(`Updated collections for ${style.name}.`);
  }
  async function toggleCollectionMembership(style, target) {
    if (!target.styles.some(saved=>sameLook(saved,style))) {
      await act(()=>addCollectionLooks([style],target,{showDestination:false}),{refreshConflict:true});
      return;
    }
    await act(async()=>{
      await save(library.collections.map(item=>item.id===target.id ? {...item,styles:item.styles.filter(saved=>!sameLook(saved,style))} : item));
      if ((scope === "collection" && target.id === browseCollectionId) || (scope === "starred" && target.id === starredTarget.id)) {
        setSelectedLooks(current=>new Map([...current].filter(([,saved])=>!sameLook(saved,style))));
      }
      setNotice(`Removed ${style.name} from ${target.name}.`);
    }, {refreshConflict:true});
  }
  async function deleteCatalog() {
    if (!canManageCollection || deletingCatalog !== browseCollection.id) return;
    const target=browseCollection;
    await act(async()=>{
      const remaining=library.collections.filter(item=>item.id!==target.id);
      await save(remaining);
      setBrowseCollectionId("");chooseCatalog("saved");setDeletingCatalog("");setSelectedLooks(new Map());
      setNamedCatalogRows(current=>{const next={...current};delete next[target.id];return next;});
      setNotice(`Deleted collection ${target.name}.`);
    }, {refreshConflict:true});
  }
  async function removeFromCollection(styles) {
    const target=browseCollection;
    const remaining=target.styles.filter(saved=>!styles.some(style=>sameLook(saved,style)));
    await act(async()=>{
      await save(library.collections.map(item=>item.id===target.id?{...item,styles:remaining}:item));
      setSelectedLooks(new Map());
      setNotice(`Removed ${target.styles.length-remaining.length} from ${target.name}.`);
    }, {refreshConflict:true});
  }
  async function materialize(style, savedExamples = []) {
    const examples=[];
    const savedByUrl=new Map(savedExamples.filter(image=>image.catalogUrl).map(image=>[image.catalogUrl,image]));
    for(const image of (style.examples||[]).slice(0,8)) {
      if(image.localUrl){examples.push(image);continue;}
      const cached=savedByUrl.get(image.url)||imported.current.get(image.url);
      if(cached){examples.push(cached);continue;}
      const response=await fetch(styleLibraryApi.catalogAssetUrl(image.url));
      if(!response.ok)throw new Error("Could not import this example image. Refresh the catalog and try again.");
      const file=new File([await response.blob()],image.fileName||"style-example.jpg",{type:response.headers.get("content-type")||"image/jpeg"});
      const form=new FormData();form.append("nodeType","transfer");form.append("asset",file);
      const {response:upload,data}=await nodeApi.uploadAsset(form);
      if(!upload.ok||!data.asset?.localUrl)throw new Error(data.error||"Could not import this example.");
      const asset={...data.asset,id:crypto.randomUUID(),catalogUrl:image.url,filmStillPalette:image.filmStillPalette};examples.push(asset);imported.current.set(image.url,asset);
    }
    return normalizeLibraryStyle({...style,examples});
  }
  async function openDetails(style) {
    const version=++detailRequest.current;setActiveStyle(null);setDetailLoading(true);setError("");
    try{
      const value=style.catalog?(await styleLibraryApi.detail(style.id)).style:style;
      if(version===detailRequest.current)setActiveStyle({...value,catalog:style.catalog});
    }
    catch(e){setError(e.message);dialog.current?.close();}finally{if(version===detailRequest.current)setDetailLoading(false);}
  }
  function closeDetails(){detailRequest.current++;dialog.current?.close();setActiveStyle(null);setDetailLoading(false);setDeleteLookRequest(null);}
  async function preloadMosaic(style){
    if(!style.catalog||style.sourceProvider!=="StyleRef"||style.examples?.length>=4||mosaicDetails.has(style.id)||mosaicPending.current.has(style.id))return;
    mosaicPending.current.add(style.id);
    try{const result=await styleLibraryApi.detail(style.id);setMosaicDetails(current=>new Map(current).set(style.id,result.style.examples||style.examples));}
    catch{setMosaicDetails(current=>new Map(current).set(style.id,style.examples));}
    finally{mosaicPending.current.delete(style.id);}
  }
  const customLookId=style=>/^look-[a-f0-9-]{36}$/.test(style?.catalogId||style?.id||"")?(style.catalogId||style.id):"";
  const canRemoveSelected=sharedUserLooks&&selectedLooks.size>0;
  async function removeSelectedLooks(){
    if(busy||!canRemoveSelected)return;
    const directory=catalog?.looksDirectory;
    const selected=[...selectedLooks.values()];
    await act(async()=>{
      setRemoveError("");
      if(!directory||catalog.viewKey!==catalogViewKey)throw new Error("Refresh User Looks before removing a Look. Restart NewtNode if the shared folder is still unavailable.");
      const removed=new Set();
      let failure="";
      for(const style of selected){
        try{
          await styleLibraryApi.purgeSharedLook(style.id,directory);
          removed.add(style.id);
        }catch(error){failure||=`${style.name}. ${error.message}`;}
      }
      if(removed.size){
        setSelectedLooks(current=>new Map([...current].filter(([,style])=>!removed.has(style.id))));
        setCatalog(current=>current?.looksDirectory===directory?{...current,viewKey:null}:current);
        setSharedCatalogRevision(current=>current+1);
        setNotice(`Removed ${removed.size} ${removed.size===1?"look":"looks"} from User Looks.`);
      }
      const failed=selected.length-removed.size;
      if(failed)setRemoveError(`Could not remove ${failed} ${failed===1?"look":"looks"}. ${failure}`);
    });
  }
  async function beginDeleteLook(){await act(async()=>{const storage=await styleLibraryApi.storage();setDeleteLookRequest({style:activeStyle,id:customLookId(activeStyle),directory:storage.looksDirectory??storage.directory,shared:storage.mode==="shared"});});}
  async function deleteLook(){
    if(!deleteLookRequest)return;
    const target=deleteLookRequest;
    await act(async()=>{
      await styleLibraryApi.removeCreated(target.id,target.directory);
      let warning="";
      if(library?.collections.some(item=>item.styles.some(style=>sameLook(style,target.style)))){
        try{await save(library.collections.map(item=>({...item,styles:item.styles.filter(style=>!sameLook(style,target.style))})));}
        catch{warning=" Your saved collection copies could not be removed; reload and unstar those copies.";await loadLibrary();}
      }
      setSelectedLooks(current=>new Map([...current].filter(([,style])=>!sameLook(style,target.style))));
      closeDetails();await loadCatalog({refresh:true});setNotice(`Deleted ${target.style.name} from the catalog.${warning}`);
    });
  }
  async function prepareCollectionLook(style, savedLooks) {
    const existing = savedLooks.find(saved => sameLook(saved, style));
    const source = existing || (style.catalog && style !== activeStyle ? (await styleLibraryApi.detail(style.id)).style : style);
    const local = await materialize(source);
    return { ...local, catalogId: local.catalogId || style.catalogId || style.id };
  }
  async function addCollectionLooks(styles, target, {showDestination=true} = {}) {
    const savedLooks=allSavedCatalogLooks(library.collections);
    const pending=[];
    for(const style of styles){
      if(!target.styles.some(saved=>sameLook(saved,style))&&!pending.some(saved=>sameLook(saved,style)))pending.push(style);
    }
    if(target.styles.length+pending.length>500)throw new Error("A collection can contain up to 500 looks.");
    const additions=[];
    for(const style of pending) {
      const snapshot = await prepareCollectionLook(style, savedLooks);
      additions.push({ ...snapshot, id: crypto.randomUUID() });
    }
    if(!additions.length){setNotice(`These looks are already in ${target.name}.`);return;}
    const collections=library.collections.some(item=>item.id===target.id)?library.collections:[...library.collections,target];
    await save(collections.map(item=>item.id===target.id?{...item,styles:[...item.styles,...additions]}:item));
    setNotice(`Added ${additions.length} ${additions.length===1?"look":"looks"} to ${target.name}.`);
    if(showDestination&&(scope!=="collection"||target.id!==browseCollectionId))setSavedDestination(target.id);
  }
  const toggleStar = style => toggleCollectionMembership(style, starredTarget);
  async function createStyleNode(style) {
    await act(async () => {
      if (!library) throw new Error("Wait for your library to load before creating a Style node.");
      // The open details supply the exact examples the user sees. A saved
      // copy can supply its analysis and matching assets, but not their order.
      const matches = saved => sameLook(saved, style);
      const existingCollection = library.collections.find(item => item.styles.some(saved => saved.id === style.id))
        || library.collections.find(item => item.styles.some(matches));
      const existing = existingCollection?.styles.find(saved => saved.id === style.id) || existingCollection?.styles.find(matches);
      const reusable = allSavedCatalogLooks(library.collections).find(saved => matches(saved) && saved.styleAnalysis?.stylePrompt);
      const local = await materialize(style, existing?.examples);
      if (!local.styleAnalysis?.stylePrompt) local.styleAnalysis = existing?.styleAnalysis?.stylePrompt ? existing.styleAnalysis : reusable?.styleAnalysis;
      if (!local.styleAnalysis?.stylePrompt) {
        setNotice("This is the first time this Look has been used as a Style, Analyzing the examples and observations.  The Style will be saved for reuse.");
        local.styleAnalysis = await styleLibraryApi.analyze(local);
      }
      let target = existingCollection || library.collections.find(item => item.name === "My Looks");
      let collections = library.collections;
      if (!target) { target = { id: crypto.randomUUID(), name: "My Looks", styles: [] }; collections = [...collections, target]; }
      const savedStyle = { ...local, id: existing?.id || (style.catalog ? crypto.randomUUID() : local.id), catalogId: local.catalogId || (style.catalog ? style.id : "") };
      const styles = existing ? target.styles.map(item => item.id === existing.id ? savedStyle : item) : [...target.styles, savedStyle];
      await save(collections.map(item => item.id === target.id ? { ...item, styles } : item));
      setActiveStyle(current => current && sameLook(current, style) ? { ...current, styleAnalysis: savedStyle.styleAnalysis } : current);
      setNotice(local.styleAnalysis.warning || `Created ${savedStyle.name} Style node. Its description is saved for reuse.`);
      onCreateStyle(libraryStyleSnapshot(savedStyle));
    });
  }
  async function addToBoard(styles) {
    await act(async()=>{
      const local=await Promise.all(styles.map(style=>materialize(style)));
      const examples=collectionExamples(local).slice(0,6);
      if(!examples.length)throw new Error("This look has no reference images to use in a mood board.");
      const prompt=styles.map(style=>portableStylePrompt(style.styleAnalysis?.stylePrompt||style.prompt)||style.notes).filter(Boolean).join("\n\n");
      onCreateMoodBoard({name:styles.length===1?`${styles[0].name} mood board`:"Style mood board",examples,prompt});
      setNotice("Created Mood Board node. You can continue exploring this look.");
    });
  }
  return <div className="library-workspace stylebuilder-workspace">
    <header className="stats-hero lookbook-hero">
      <div><span className="stats-kicker">Creative library</span><h1>Lookbook</h1></div>
      <button type="button" className="library-primary" disabled={busy} onClick={()=>setCreatingLook(true)}>Create Look</button>
    </header>
    {error&&!collectionAction&&!activeStyle&&<div className="library-error" role="alert">{error}<button disabled={busy} onClick={loadLibrary}>Refresh library</button></div>}
    {sharedUserLooks&&removeError&&<div className="library-error" role="alert">{removeError}<button type="button" disabled={busy||!canRemoveSelected||catalog?.viewKey!==catalogViewKey} onClick={removeSelectedLooks}>Retry</button></div>}
    {notice&&<div className="stylebuilder-notice library-inline" role="status">
      {notice}{savedDestination&&<button type="button" onClick={()=>chooseCatalog("collection:"+savedDestination)}>View collection</button>}
    </div>}
    <section className="stylebuilder-browse" aria-label="Browse looks">
      <div className="stylebuilder-browse-toolbar">
        <nav className="lookbook-views" aria-label="Lookbook views">
          <button type="button" aria-pressed={isSourceCatalog} onClick={()=>chooseCatalog(sourceOptions.some(item=>item.value===lastSource)?lastSource:"stylefinder")}>Sources</button>
          <button type="button" aria-pressed={!isSourceCatalog} onClick={()=>chooseCatalog(libraryOptions.some(item=>item.value===lastLibraryView)?lastLibraryView:"saved")}>My Library</button>
        </nav>
        <div className="stylebuilder-browse-controls">
          <LookbookSelect key={isSourceCatalog?"sources":"library"} label={isSourceCatalog?"Looks source":"Collection"} value={browserValue} onChange={chooseCatalog} options={browserOptions}/>
          {!isSourceCatalog&&<button type="button" className="lookbook-compact-action" disabled={busy||!canCreateCollection} onClick={()=>openCollectionAction("create")}><FolderPlus size={16}/>New collection</button>}
          <label className="stylebuilder-search"><Search size={18}/><input ref={searchInput} aria-label="Search looks" placeholder="Search looks" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" className="stylebuilder-search-clear" aria-label="Clear look search" onClick={()=>{setQuery("");searchInput.current?.focus();}}><X size={15}/></button>}</label>
          <button className="stylebuilder-icon" aria-label={isSourceCatalog?"Refresh catalog":"Refresh library"} disabled={isSourceCatalog?catalogLoading:busy} onClick={()=>isSourceCatalog?loadCatalog({refresh:true}):loadLibrary()}><RefreshCw size={17} className={catalogLoading?"spin":""}/></button>
        </div>
      </div>
      <div className="stylebuilder-catalog-meta"><span>{sharedUserLooks?`${sharedTotal} shared ${sharedTotal===1?"look":"looks"}`:scope==="library"?`${currentCatalog?.total??0} commercial looks${currentCatalog?.localCount?` · ${currentCatalog.localCount} custom`:""}`:scope==="stylefinder"||scope==="film-stills"?`${currentCatalog?.total??0} ${browserName} looks`:`${visibleStyles.length} ${visibleStyles.length===1?"look":"looks"}`}</span><div className="stylebuilder-category-filter"><span>Filter:</span><LookbookSelect label="Look category" value={category} onChange={setCategory} options={[{value:"",label:"All categories"},...filterCategories.map(item=>({value:item,label:item}))]}/></div></div>
      {(scope==="library"||allLooks)&&currentCatalog?.truncated&&<p className="library-muted">The commercial catalog has reached its browsing limit. Refine your search to explore more looks.</p>}
      {catalogError&&isSourceCatalog&&<p className="library-error" role="alert">{catalogError}</p>}
      {currentCatalog?.warning&&isSourceCatalog&&<p className="stylebuilder-notice" role="status">{currentCatalog.warning}</p>}
      {canManageCollection&&<div className="library-inline lookbook-collection-tools">
        {deletingCatalog===browseCollection.id?<><span>Delete “{browseCollection.name}” and its saved memberships? Original looks, other collections and workflow nodes are kept.</span><button className="lookbook-compact-action" disabled={busy} onClick={deleteCatalog}>Confirm delete</button><button className="lookbook-compact-action" disabled={busy} onClick={()=>setDeletingCatalog("")}>Cancel</button></>:<>
          <button type="button" className="lookbook-compact-action" disabled={busy} onClick={()=>openCollectionAction("rename",[],browseCollection)}>Rename collection</button>
          <button type="button" className="lookbook-compact-action" disabled={busy} onClick={()=>setDeletingCatalog(browseCollection.id)}>Delete collection</button>
        </>}
      </div>}
      {selectedLooks.size>0&&<div className="lookbook-selection-actions" aria-label="Selected looks">
        <span className="library-muted">{selectedLooks.size} selected</span>
        <div className="library-inline">
          <button type="button" disabled={busy||!library} onClick={()=>openCollectionPicker([...selectedLooks.values()],true)}>Add to collection…</button>
          {canManageCollection&&<button type="button" disabled={busy} onClick={()=>removeFromCollection([...selectedLooks.values()])}>Remove from collection</button>}
          {sharedUserLooks&&<button type="button" disabled={busy||!canRemoveSelected} onClick={removeSelectedLooks}>Remove Look</button>}
          <button type="button" disabled={busy} onClick={()=>{setSelectedLooks(new Map());setRemoveError("");}}>Clear selection</button>
        </div>
      </div>}
      <div key={`strip:${browserValue}`} ref={frameRef} data-row-count={frameRows} className={`stylebuilder-style-strip ${resizable ? `collection-grid ${!visibleStyles.length ? "collection-grid-empty" : ""}` : ""}`} style={resizable ? {"--collection-rows":frameRows,"--collection-row-height":`${collectionRowHeight}px`,"--collection-row-gap":`${collectionRowGap}px`,"--collection-frame-chrome":`${collectionFrameChrome}px`} : undefined} aria-label="Style previews" tabIndex={0}>
        {visibleStyles.map(style=><article className="stylebuilder-tile" key={keyOf(style)} onPointerEnter={()=>preloadMosaic(style)} onFocusCapture={()=>preloadMosaic(style)}><label className="stylebuilder-tile-selection"><input type="checkbox" aria-label={`Select ${style.name}`} checked={selectedLooks.has(keyOf(style))} disabled={busy} onChange={event=>{const checked=event.target.checked;setRemoveError("");setSelectedLooks(current=>{const next=new Map(current);if(checked)next.set(keyOf(style),style);else next.delete(keyOf(style));return next;});}}/></label><button className="stylebuilder-tile-open" onClick={()=>openDetails(style)} aria-label={`View ${style.name}`}><StyleMosaic style={mosaicDetails.has(style.id)?{...style,examples:mosaicDetails.get(style.id)}:style}/><span className="stylebuilder-tile-name">{style.sref?.replace(/^--sref\s+/,"")||style.name}</span></button><button className={`stylebuilder-tile-star ${isStarred(style)?"saved":""}`} aria-label={`${isStarred(style)?"Unstar look":"Star look"}: ${style.name}`} aria-pressed={isStarred(style)} title={isStarred(style)?"Remove from Starred":"Add to Starred"} disabled={busy||!library} onClick={()=>toggleStar(style)}><Star size={16} fill={isStarred(style)?"currentColor":"none"}/></button></article>)}
        {!visibleStyles.length&&<div className="stylebuilder-empty"><Layers size={27}/><p>{waitingForCatalog?"Loading looks…":isSourceCatalog&&!currentCatalog?.ready?"The catalog is not available yet. Refresh to retry.":!isSourceCatalog&&!query&&!category?(scope==="starred"?"Star looks to find them here.":"No looks saved here yet."):"No styles match this view."}</p>{!isSourceCatalog&&<button onClick={()=>chooseCatalog(sourceOptions.some(item=>item.value===lastSource)?lastSource:"stylefinder")}>Browse sources <ArrowRight size={15}/></button>}</div>}
      </div>
      <LookbookShuttle key={`shuttle:${browserValue}`} frameRef={frameRef} previewCount={visibleStyles.length} rows={frameRows}/>
      {resizable&&<CollectionResizeHandle key={`resize:${browserValue}`} rows={frameRows} frameRef={frameRef} label={browserName} onChange={changeFrameRows}/>}
      {isSourceCatalog&&catalogLoading&&visibleStyles.length>0&&<p className="library-muted" role="status">Loading looks…</p>}
    </section>
    <CreateLookDialog open={creatingLook} categories={catalog?.categories} onClose={()=>setCreatingLook(false)} onSaved={style=>{const shared=style.examples?.some(image=>image.localUrl?.startsWith("/uploads/shared-looks/"));if(!shared)setShowLocalLooks(true);chooseCatalog(shared?"shared-user-looks":"local-looks");setQuery("");setCategory("");setSharedCatalogRevision(current=>current+1);setNotice(`Saved ${style.name} to the catalog.`);}}/>
    <dialog ref={dialog} className="library-style-detail" aria-label="Style details" onCancel={event=>{event.preventDefault();closeDetails();}}><button className="stylebuilder-detail-close" aria-label="Close style details" onClick={closeDetails}><X size={20}/></button>{detailLoading&&<p role="status">Loading style details…</p>}{error&&<p className="library-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{activeStyle&&<><span className="stylebuilder-eyebrow">{activeStyle.category||"SAVED LOOK"}</span><div className="look-detail-title"><h2>{activeStyle.name}</h2><button type="button" className={`look-detail-star ${isStarred(activeStyle)?"saved":""}`} aria-label={isStarred(activeStyle)?"Unstar look":"Star look"} aria-pressed={isStarred(activeStyle)} title={isStarred(activeStyle)?"Remove from Starred":"Add to Starred"} disabled={busy||!library} onClick={()=>toggleStar(activeStyle)}><Star size={22} fill={isStarred(activeStyle)?"currentColor":"none"}/></button></div><div className="library-detail-examples">{(activeStyle.examples||[]).map((image,index)=><button key={`${image.id}-${index}`} className="library-example-open" aria-label={`Enlarge ${activeStyle.name} example ${index+1}`} onClick={()=>setPreviewIndex(index)}><img src={imageUrl(image)} alt={`${activeStyle.name} example ${index+1}`}/></button>)}</div>{!activeStyle.examples?.length&&<p className="library-muted">This look has no reference images available.</p>}<div className="look-detail-actions"><div className="library-inline"><button type="button" disabled={busy||!library} onClick={()=>openCollectionPicker([activeStyle])}><FolderPlus size={16}/>{namedCollections.length ? "Manage collections…" : "Add to collection…"}</button>{savedDestination&&<button type="button" onClick={()=>{closeDetails();chooseCatalog("collection:"+savedDestination);}}>View collection</button>}<button disabled={busy||!activeStyle.examples?.length} onClick={()=>addToBoard([activeStyle])}>Create Mood Board node</button><button disabled={busy||(!activeStyle.styleAnalysis?.stylePrompt&&!activeStyle.examples?.length)} onClick={()=>createStyleNode(activeStyle)}>Use in Style <ArrowUpRight size={15}/></button>{customLookId(activeStyle)&&!deleteLookRequest&&<button type="button" disabled={busy} onClick={beginDeleteLook}>Delete Look</button>}</div>
      {library&&<div className="look-detail-memberships">
        <span>Collections</span>
        {activeMemberships.length ? <ul aria-label="Look collections">
          {activeMemberships.map(collection=><li key={collection.id}>{collection.name}</li>)}
        </ul> : <span className="library-muted">No named collections</span>}
      </div>}
      {customLookId(activeStyle)&&deleteLookRequest&&<div className="look-delete-controls"><section className="look-delete-confirm" aria-label="Delete custom Look"><p>Delete “{deleteLookRequest.style.name}” from {deleteLookRequest.shared?"the shared catalog for everyone":"your custom catalog"}? Your saved collection copies will also be removed. Existing workflow nodes and their images are kept.</p><button type="button" disabled={busy} onClick={deleteLook}>Confirm delete Look</button><button type="button" disabled={busy} onClick={()=>setDeleteLookRequest(null)}>Cancel delete</button></section></div>}</div><LookDetailExtras style={activeStyle}/><p className="library-muted">{activeStyle.styleAnalysis?.stylePrompt?"This look’s style description is saved and ready to reuse.":"Use in Style analyzes the examples and observations with Astra once (paid), then saves the description for future use."}</p><LookDescription text={lookStyleDescription(activeStyle.styleAnalysis)||activeStyle.prompt||"No visual description is available for this look."} title={activeStyle.sourceProvider==="StyleRef"&&!activeStyle.styleAnalysis?.stylePrompt?"Catalog prompt":"Style description"} summary={activeStyle.notes}/>{activeStyle.sourceProvider==="StyleRef"&&activeStyle.styleAnalysis?.stylePrompt&&activeStyle.prompt&&<LookDescription title="Catalog prompt" text={activeStyle.prompt}/>}{activeStyle.sref&&<code>{activeStyle.sref}</code>}<p className="library-muted">{activeStyle.tags?.join(" · ")}</p></>}</dialog>
    <dialog ref={collectionDialog} className="library-style-detail lookbook-collection-dialog" aria-labelledby="lookbook-collection-title"
      onCancel={event=>{event.preventDefault();if(!busy)closeCollectionAction();}}>
      {collectionAction&&<form onSubmit={submitCollectionAction}>
        <h2 id="lookbook-collection-title">{collectionAction.mode==="memberships"?"Manage collections":collectionAction.mode==="add"?"Add to collection":collectionAction.mode==="rename"?"Rename collection":"New collection"}</h2>
        {collectionAction.mode!=="memberships"&&collectionAction.looks.length>0&&<p className="library-muted">{collectionAction.looks.length} {collectionAction.looks.length===1?"look":"looks"} to add</p>}
        {error&&<p className="library-error" role="alert">{error}</p>}
        {collectionAction.mode==="memberships"?<div className="lookbook-collection-choices" role="group" aria-label="Look collections">
          {namedCollections.map(collection=><label key={collection.id}>
            <input type="checkbox" disabled={busy}
              checked={collectionAction.membershipChanges.get(collection.id) ?? collectionHasLook(collection, collectionAction.looks[0])}
              onChange={event=>changeLookMembership(collection,event.target.checked)}/>
            <span>{collection.name}</span>
          </label>)}
        </div>:collectionAction.mode==="add"?<div className="lookbook-collection-choices" role="group" aria-label="Destination collection">
          {namedCollections.map(item=>{
            const existing=collectionAction.looks.filter(style=>item.styles.some(saved=>sameLook(saved,style))).length;
            return <label key={item.id}>
              <input type="radio" name="lookbook-destination" checked={item.id===collectionAction.targetId} disabled={busy} onChange={()=>setCollectionAction(current=>({...current,targetId:item.id}))}/>
              <span>{item.name}</span>
              {existing>0&&<small>{existing} already saved</small>}
            </label>;
          })}
        </div>:<label className="lookbook-collection-name">Collection name
          <input autoFocus maxLength={120} disabled={busy} value={collectionName} onChange={event=>setCollectionName(event.target.value)}/>
        </label>}
        <div className="library-inline lookbook-collection-dialog-actions">
          {(collectionAction.mode==="add"||collectionAction.mode==="memberships")&&canCreateCollection&&<button type="button" disabled={busy} onClick={()=>{setError("");setCollectionAction(current=>({...current,mode:"create"}));}}>New collection…</button>}
          {collectionAction.mode==="create"&&collectionAction.looks.length>0&&namedCollections.length>0&&
            <button type="button" disabled={busy} onClick={()=>{setError("");setCollectionAction(current=>({...current,mode:current.fromSelection?"add":"memberships"}));}}>Choose existing</button>}
          <button type="button" disabled={busy} onClick={closeCollectionAction}>Cancel</button>
          <button type="submit" className="library-primary" disabled={busy||(collectionAction.mode==="memberships"?!collectionAction.membershipChanges.size:collectionAction.mode==="add"?!collectionAction.targetId:!collectionName.trim())}>
            {busy?"Saving…":collectionAction.mode==="memberships"?"Save collections":collectionAction.mode==="add"?"Add looks":collectionAction.mode==="rename"?"Save name":collectionAction.looks.length?"Create and add":"Create collection"}
          </button>
        </div>
      </form>}
    </dialog>
    <dialog ref={previewDialog} className="library-image-preview" aria-label="Look example preview" onCancel={event=>{event.preventDefault();closePreview();}} onClick={event=>{if(event.target===event.currentTarget)closePreview();}} onKeyDown={event=>{if(event.key==="ArrowRight"&&activeStyle?.examples?.length){event.preventDefault();setPreviewIndex(index=>(index+1)%activeStyle.examples.length);}if(event.key==="ArrowLeft"&&activeStyle?.examples?.length){event.preventDefault();setPreviewIndex(index=>(index-1+activeStyle.examples.length)%activeStyle.examples.length);}}}>
      <button className="library-preview-close" aria-label="Close example preview" onClick={closePreview}><X size={22}/></button>
      {previewIndex!==null&&activeStyle?.examples?.[previewIndex]&&<><img src={imageUrl(activeStyle.examples[previewIndex])} alt={`${activeStyle.name} example ${previewIndex+1}, enlarged`}/><div className="library-preview-controls"><button aria-label="Previous example" disabled={activeStyle.examples.length<2} onClick={()=>setPreviewIndex(index=>(index-1+activeStyle.examples.length)%activeStyle.examples.length)}>Previous</button><span>{previewIndex+1} / {activeStyle.examples.length}</span><button aria-label="Next example" disabled={activeStyle.examples.length<2} onClick={()=>setPreviewIndex(index=>(index+1)%activeStyle.examples.length)}>Next</button></div></>}
    </dialog>
  </div>;
}
