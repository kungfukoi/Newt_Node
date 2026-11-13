import React from "react";
import { FolderOpen,Plus,Save } from "lucide-react";
import { styleLibraryApi,systemApi } from "../api/newtApi.js";
import { builtinLibrarySources } from "../lookCatalogs.js";
import "./LookbookStorageSettings.css";

export default function LookbookStorageSettings(){
  const [state,setState]=React.useState(null),[directory,setDirectory]=React.useState(""),[copyLocal,setCopyLocal]=React.useState(true);
  const [looksDirectory,setLooksDirectory]=React.useState("");
  const [filmStillsDirectory,setFilmStillsDirectory]=React.useState("");
  const [sources,setSources]=React.useState([]);
  const [sourceNames,setSourceNames]=React.useState({});
  const [removedSources,setRemovedSources]=React.useState([]);
  const [rename,setRename]=React.useState(null);
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(""),[notice,setNotice]=React.useState("");
  const operation=React.useRef(false);
  function apply(value){setState(value);setDirectory(value.directory);setLooksDirectory(value.looksDirectory??value.directory);setFilmStillsDirectory(value.filmStillsDirectory??"");setSources(value.sources??[]);setSourceNames(value.sourceNames??{});setRemovedSources(value.removedSources??[]);setRename(null);}
  React.useEffect(()=>{let active=true;styleLibraryApi.storage().then(value=>{
    if(!active)return;
    apply(value);
    if(typeof value.looksDirectory!=="string")setError("Restart NewtNode to configure Shared User Looks.");
  }).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[]);
  const disabled=busy||typeof state?.looksDirectory!=="string";
  async function run(action){if(operation.current)return;operation.current=true;setBusy(true);setError("");setNotice("");try{await action();}catch(error){setError(error.message);}finally{operation.current=false;setBusy(false);}}
  async function browse(title,defaultPath,setPath){await run(async()=>{const {response,data}=await systemApi.selectFolder({title,defaultPath});if(data?.canceled)return;if(!response.ok)throw Error(data.error||"Could not choose a folder.");if(data.path)setPath(data.path);});}
  async function save(){await run(async()=>{
    const names=rename&&!rename.custom?{...sourceNames,[rename.id]:rename.name}:sourceNames;
    const entries=rename?.custom?sources.map(source=>source.id===rename.id?{...source,name:rename.name}:source):sources;
    const value=await styleLibraryApi.saveStorage({directory,looksDirectory,filmStillsDirectory,copyLocal:copyLocal&&!removedSources.includes("shared-user-looks"),sources:entries,sourceNames:names,removedSources});
    if((Object.keys(names).length&&!value.sourceNames)||(removedSources.length&&!value.removedSources))throw Error("Restart NewtNode to save source names and removals.");
    apply(value);
    setNotice("Library sources saved.");
  });}
  function finishRename(){
    if(!rename)return;
    if(rename.custom)editSource(rename.id,{name:rename.name.trim()});
    else setSourceNames(current=>({...current,[rename.id]:rename.name.trim()}));
    setRename(null);
  }
  function nameControl(id,name,custom=false){
    if(rename?.id===id)return <input aria-label={`Rename ${name}`} autoFocus maxLength={80} value={rename.name}
      onFocus={event=>event.currentTarget.select()} onChange={event=>setRename({...rename,name:event.target.value})}
      onBlur={finishRename} onKeyDown={event=>{
        if(event.key==="Enter")finishRename();
        if(event.key==="Escape")setRename(null);
      }}/>;
    const start=()=>setRename({id,name,custom});
    return <button type="button" className="lookbook-source-name" title="Double-click to rename" disabled={disabled}
      onDoubleClick={start} onKeyDown={event=>{
        if(["Enter"," ","F2"].includes(event.key)){event.preventDefault();start();}
      }}>{name}</button>;
  }
  function editSource(id,changes){setSources(current=>current.map(source=>source.id===id?{...source,...changes}:source));}
  const supportsSources=Array.isArray(state?.sources);
  return <section className="lookbook-storage-preference" aria-label="Lookbook storage">
    <div className="lookbook-source-list">
      {[
        ["stylefinder",directory,setDirectory],
        ["film-stills",filmStillsDirectory,setFilmStillsDirectory],
        ["shared-user-looks",looksDirectory,setLooksDirectory],
        ["library","https://styleref.io"]
      ].filter(([id])=>!removedSources.includes(id)).map(([id,value,setPath])=>{
        const name=sourceNames[id]||builtinLibrarySources[id].settings;
        const pathDisabled=disabled||(id==="film-stills"&&typeof state?.filmStillsDirectory!=="string");
        return <div className="lookbook-source-row" key={id}>
          {nameControl(id,name)}
          {setPath ? <>
            <input aria-label={name} placeholder={id==="shared-user-looks"?"Local storage":"Folder path"} value={value} disabled={pathDisabled} onChange={event=>setPath(event.target.value)}/>
            <button type="button" className="lookbook-icon-button" title="Browse" aria-label={`Browse ${name}`} disabled={pathDisabled} onClick={()=>browse(`Choose ${name} folder`,value,setPath)}><FolderOpen size={14}/></button>
          </> : <a href={value} target="_blank" rel="noreferrer">styleref.io</a>}
          <button type="button" className="lookbook-icon-button" title="Remove" aria-label={`Remove ${name}`} disabled={disabled} onClick={()=>setRemovedSources(current=>[...current,id])}>×</button>
        </div>;
      })}
      {sources.map((source,index)=><div key={source.id} className="lookbook-source-row lookbook-custom-source">
        {source.name||rename?.id===source.id ? nameControl(source.id,source.name,true)
          : <input aria-label={`Source ${index+1} name`} placeholder="Source name" disabled={disabled} maxLength={80} defaultValue="" onBlur={event=>editSource(source.id,{name:event.target.value.trim()})} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur();}}/>}
        <input aria-label={`Source ${index+1} path or URL`} disabled={disabled} value={source.location} placeholder="Catalog folder or URL" onChange={event=>editSource(source.id,{location:event.target.value})}/>
        <button type="button" className="lookbook-icon-button" title="Browse" disabled={disabled} aria-label={`Browse for source ${index+1}`} onClick={()=>browse("Choose compact catalog folder",/^https?:\/\//i.test(source.location)?"":source.location,location=>editSource(source.id,{location}))}><FolderOpen size={14}/></button>
        <button type="button" className="lookbook-icon-button" title="Remove" disabled={disabled} aria-label={`Remove source ${index+1}`} onClick={()=>setSources(current=>current.filter(item=>item.id!==source.id))}>×</button>
      </div>)}
    </div>
    {!removedSources.includes("shared-user-looks")&&state?.localCount>0&&looksDirectory.trim()&&<label className="lookbook-storage-copy"><input type="checkbox" disabled={disabled} checked={copyLocal} onChange={event=>setCopyLocal(event.target.checked)}/>Copy {state.localCount} local {state.localCount===1?"Look":"Looks"} to {sourceNames["shared-user-looks"]||"Shared User Looks"}</label>}
    <div className="lookbook-storage-actions">
      <button type="button" disabled={disabled||!supportsSources} onClick={()=>setSources(current=>[...current,{id:crypto.randomUUID(),name:"",location:""}])}><Plus size={14}/>Create new source</button>
      {removedSources.length>0&&<select aria-label="Restore built-in source" disabled={disabled} value="" onChange={event=>setRemovedSources(current=>current.filter(id=>id!==event.target.value))}>
        <option value="" disabled>Restore built-in source</option>
        {removedSources.map(id=><option key={id} value={id}>{sourceNames[id]||builtinLibrarySources[id].settings}</option>)}
      </select>}
      <button type="button" disabled={disabled} onClick={save}><Save size={14}/>{busy?"Working…":"Save sources"}</button>
    </div>
    {state&&!supportsSources&&<p>Restart NewtNode to add custom library sources.</p>}
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>;
}
