import React from "react";
import { FolderOpen,Save } from "lucide-react";
import { styleLibraryApi,systemApi } from "../api/newtApi.js";
import "./LookbookStorageSettings.css";

export default function LookbookStorageSettings(){
  const [state,setState]=React.useState(null),[directory,setDirectory]=React.useState(""),[copyLocal,setCopyLocal]=React.useState(true);
  const [looksDirectory,setLooksDirectory]=React.useState("");
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(""),[notice,setNotice]=React.useState("");
  const operation=React.useRef(false);
  function apply(value){setState(value);setDirectory(value.directory);setLooksDirectory(value.looksDirectory??value.directory);}
  React.useEffect(()=>{let active=true;styleLibraryApi.storage().then(value=>{
    if(!active)return;
    apply(value);
    if(typeof value.looksDirectory!=="string")setError("Restart NewtNode to configure Shared User Looks.");
  }).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[]);
  const disabled=busy||typeof state?.looksDirectory!=="string";
  async function run(action){if(operation.current)return;operation.current=true;setBusy(true);setError("");setNotice("");try{await action();}catch(error){setError(error.message);}finally{operation.current=false;setBusy(false);}}
  async function browse(title,defaultPath,setPath){await run(async()=>{const {response,data}=await systemApi.selectFolder({title,defaultPath});if(data?.canceled)return;if(!response.ok)throw Error(data.error||"Could not choose a folder.");if(data.path)setPath(data.path);});}
  async function save(){await run(async()=>{
    const value=await styleLibraryApi.saveStorage({directory,looksDirectory,copyLocal});
    apply(value);
    const destination=value.mode==="shared"?"New Looks and their images will be saved to Shared User Looks.":"New Looks will be saved on this computer.";
    const catalog=value.format==="compact"?" Browse the compact catalog in StyleFinder.":"";
    setNotice(`Lookbook folders saved. ${destination}${catalog}`);
  });}
  return <section className="lookbook-storage-preference" aria-label="Lookbook storage">
    <label><strong>Shared Looks Catalog</strong><input placeholder="Enter a local or network folder path" value={directory} disabled={disabled} onChange={event=>setDirectory(event.target.value)}/></label>
    <p>Choose the compact catalog folder containing catalog.json and images.</p>
    <div className="lookbook-storage-actions"><button type="button" aria-label="Browse Shared Looks Catalog" disabled={disabled} onClick={()=>browse("Choose Shared Looks Catalog folder",directory,setDirectory)}><FolderOpen size={14}/>Browse</button></div>
    <label><strong>Shared User Looks</strong><input placeholder="Enter a writable local or network folder path" value={looksDirectory} disabled={disabled} onChange={event=>setLooksDirectory(event.target.value)}/></label>
    <p>New user-created Looks and their images are saved here. Choose User Looks from the Looks source menu to browse this folder. Leave this field empty to save on this computer.</p>
    <div className="lookbook-storage-actions"><button type="button" aria-label="Browse Shared User Looks" disabled={disabled} onClick={()=>browse("Choose Shared User Looks folder",looksDirectory,setLooksDirectory)}><FolderOpen size={14}/>Browse</button></div>
    {state?.localCount>0&&looksDirectory.trim()&&<label className="lookbook-storage-copy"><input type="checkbox" disabled={disabled} checked={copyLocal} onChange={event=>setCopyLocal(event.target.checked)}/>Copy this computer’s {state.localCount} existing local Looks to Shared User Looks.</label>}
    <div className="lookbook-storage-actions"><button type="button" disabled={disabled} onClick={save}><Save size={14}/>{busy?"Working…":"Save folders"}</button></div>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>;
}
