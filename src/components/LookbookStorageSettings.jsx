import React from "react";
import { FolderOpen,Save } from "lucide-react";
import { styleLibraryApi,systemApi } from "../api/newtApi.js";
import "./LookbookStorageSettings.css";

export default function LookbookStorageSettings(){
  const [state,setState]=React.useState(null),[directory,setDirectory]=React.useState(""),[copyLocal,setCopyLocal]=React.useState(true);
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(""),[notice,setNotice]=React.useState("");
  const operation=React.useRef(false);
  React.useEffect(()=>{let active=true;styleLibraryApi.storage().then(value=>{if(active){setState(value);setDirectory(value.directory);}}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[]);
  async function run(action){if(operation.current)return;operation.current=true;setBusy(true);setError("");setNotice("");try{await action();}catch(error){setError(error.message);}finally{operation.current=false;setBusy(false);}}
  async function browse(){await run(async()=>{const {response,data}=await systemApi.selectFolder({title:"Choose shared Lookbook folder",defaultPath:directory});if(data?.canceled)return;if(!response.ok)throw Error(data.error||"Could not choose a folder.");if(data.path)setDirectory(data.path);});}
  async function save(){await run(async()=>{const value=await styleLibraryApi.saveStorage({directory,copyLocal});setState(value);setDirectory(value.directory);setNotice(value.mode==="shared"?"Shared Lookbook folder saved. New looks and their images will be saved there.":"Local Lookbook storage selected. Shared files are unchanged.");});}
  return <section className="lookbook-storage-preference" aria-label="Lookbook storage">
    <div><strong>Shared Lookbook folder</strong><p>Read and save user-created looks in a shared folder, including their images and extracted styles. Each computer selects its own mounted path to the same folder.</p></div>
    <label>Folder path<input aria-label="Shared Lookbook folder" placeholder="Choose a mounted folder, or leave empty for local storage" value={directory} disabled={busy||!state} onChange={event=>setDirectory(event.target.value)}/></label>
    <div className="lookbook-storage-actions"><button type="button" disabled={busy||!state} onClick={browse}><FolderOpen size={14}/>Browse</button><button type="button" disabled={busy||!state} onClick={save}><Save size={14}/>{busy?"Working…":"Save folder"}</button></div>
    {state?.localCount>0&&<label className="lookbook-storage-copy"><input type="checkbox" disabled={busy} checked={copyLocal} onChange={event=>setCopyLocal(event.target.checked)}/>Copy this computer’s {state.localCount} existing local looks when saving a shared folder. Local originals are kept.</label>}
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>;
}
