import React from "react";
import { Plus, X, Sparkles, ImagePlus } from "lucide-react";
import { nodeApi, styleLibraryApi } from "../api/newtApi.js";
import { displayMediaUrl } from "../mediaAssets.js";
import { lookCategories, lookTags } from "../lookCategories.js";
import { lookStyleSections, lookStyleBlocks, lookStylePriorities, compileLookStyle } from "../createLookStyle.js";
import LookbookSelect from "./LookbookSelect.jsx";
import LookDescription from "./LookDescription.jsx";

export default function CreateLookDialog({ open, categories, onClose, onSaved }) {
  const dialog = React.useRef(null), input = React.useRef(null), busyRef = React.useRef(false);
  const [name, setName] = React.useState(""), [examples, setExamples] = React.useState([]);
  const [analysis, setAnalysis] = React.useState(null), [description, setDescription] = React.useState("");
  const [blocks,setBlocks]=React.useState(()=>lookStyleBlocks()), [palette,setPalette]=React.useState([]);
  const [tags, setTags] = React.useState([]), [tag, setTag] = React.useState("");
  const [busy, setBusy] = React.useState(""), [error, setError] = React.useState("");
  const [identity, setIdentity] = React.useState(() => `look-${crypto.randomUUID()}`);
  React.useEffect(() => { setIdentity(`look-${crypto.randomUUID()}`); }, [name, examples, description, tags, tag, blocks, palette]);
  const stylePrompt=compileLookStyle(blocks,palette);
  const options = lookCategories(categories);
  React.useEffect(() => { if (open && !dialog.current.open) dialog.current.showModal(); else if (!open) dialog.current.close(); }, [open]);
  async function run(status, action) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(status); setError("");
    try { await action(); } catch (error) { setError(error.message); }
    finally { busyRef.current = false; setBusy(""); }
  }
  function changeImages(images) { setExamples(images); setAnalysis(null); setDescription(""); setTags([]);setBlocks(lookStyleBlocks());setPalette([]); }
  function changeBlock(id,patch){setBlocks(current=>current.map(block=>block.id===id?{...block,...patch}:block));}
  function addTag() { if (tag.trim()) { setTags(current => lookTags([...current, ...tag.split(",")])); setTag(""); } }
  async function upload(files) {
    const additions = Array.from(files || []);
    if (!additions.length) return;
    await run("Importing images…", async () => {
      if (additions.length + examples.length > 6) throw new Error("You can add up to six images. Remove an image to make room.");
      if (additions.some(file => !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 16 * 1024 * 1024)) throw new Error("Use PNG, JPEG, WebP or AVIF images up to 16 MB each.");
      const images = [...examples];
      for (const file of additions) {
        const form = new FormData(); form.append("nodeType", "transfer"); form.append("asset", file);
        const { response, data } = await nodeApi.uploadAsset(form);
        if (!response.ok || !data.asset?.localUrl) throw new Error(data.error || "Could not import this image. Previously imported images are preserved.");
        images.push({ ...data.asset, id: crypto.randomUUID() }); changeImages([...images]);
      }
    });
  }
  async function analyze() {
    await run("Astra is extracting the visual style, palette and tags…", async () => {
      const result = await styleLibraryApi.analyzeCreated({ name: name.trim() || "New look", examples }, options);
      setAnalysis(result); setDescription(result.stylePrompt); setTags(result.tags);setBlocks(lookStyleBlocks(result.styleBlocks));setPalette(result.palette||[]);
      if (result.warning) setError(result.warning);
    });
  }
  async function save() {
    await run("Saving look…", async () => {
      const savedTags = lookTags([...tags, ...tag.split(",")]);
      const style = await styleLibraryApi.create({ id: identity, name: name.trim(), examples, prompt: stylePrompt, notes:description.trim(), tags: savedTags, styleBlocks:blocks, colours:palette.map(colour=>({...colour,percent:null})),sourceProvider:"Newt",
        category: savedTags.find(value => options.includes(value)) || "Various", styleAnalysis: { ...analysis, stylePrompt } });
      onSaved(style); onClose();
      setName(""); setExamples([]); setAnalysis(null); setDescription(""); setTags([]); setTag("");setBlocks(lookStyleBlocks());setPalette([]);setIdentity(`look-${crypto.randomUUID()}`);
    });
  }
  return <dialog ref={dialog} className="library-style-detail create-look-dialog" aria-label="Create look" onCancel={event => { event.preventDefault(); if (!busyRef.current) onClose(); }}>
    <button className="stylebuilder-detail-close" aria-label="Close create look" disabled={Boolean(busy)} onClick={onClose}><X size={20}/></button>
    <span className="stylebuilder-eyebrow">YOUR CATALOG</span><h2>Create Look</h2>
    <p className="library-muted">Build a visual style from up to six reference images. Extract with Newt, refine the style board, and save your look for reuse.</p>
    <label>Look name<input maxLength={120} value={name} disabled={Boolean(busy)} onChange={event => setName(event.target.value)}/></label>
    <div className={`create-look-drop${busy ? " busy" : ""}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busyRef.current) upload(event.dataTransfer.files); }}>
      <div className="create-look-images">{examples.map((image, index) => <figure key={image.id}><img src={displayMediaUrl(image.localUrl)} alt={`Look input ${index + 1}`}/><button type="button" aria-label={`Remove image ${index + 1}`} disabled={Boolean(busy)} onClick={() => changeImages(examples.filter(item => item.id !== image.id))}><X size={15}/></button></figure>)}</div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple hidden aria-label="Add look images" disabled={Boolean(busy) || examples.length >= 6} onChange={event => { upload(event.target.files); event.target.value = ""; }}/>
      <button type="button" disabled={Boolean(busy) || examples.length >= 6} onClick={() => input.current.click()}><ImagePlus size={17}/>Add images</button><span className="library-muted">{examples.length}/6 images · or drop images here</span>
    </div>
    <div className="create-look-analyze"><button type="button" disabled={Boolean(busy) || !examples.length} onClick={analyze}><Sparkles size={16}/>{analysis ? "Extract again" : "Extract style"}</button><span className="library-muted">Uses your configured Astra provider. Paid extraction; edits and reuse are free.</span></div>
    {busy && <p role="status" className="stylebuilder-notice">{busy}</p>}{error && <p role="alert" className="library-error">{error}</p>}
    <label>Short description<textarea aria-label="Look style description" value={description} maxLength={2000} disabled={Boolean(busy) || !analysis} onChange={event => setDescription(event.target.value)} placeholder="Extract the style to describe its look and feel."/></label>
    <section aria-label="Visual style board"><div className="create-look-board-heading"><h3>Style board</h3><span className="library-muted">Choose the sections and priorities used in your prompt.</span></div><div className="create-look-board">{blocks.map(block=>{const section=lookStyleSections.find(item=>item.id===block.id);return <article key={block.id} className={`create-look-style-card${block.enabled?"":" excluded"}`}><header><h4>{section.label}</h4><label><input type="checkbox" aria-label={`Include ${section.label}`} checked={block.enabled} disabled={Boolean(busy)||!analysis} onChange={event=>changeBlock(block.id,{enabled:event.target.checked})}/>Include</label></header><fieldset disabled={Boolean(busy)||!analysis}><LookbookSelect label={`${section.label} priority`} value={block.weight} onChange={weight=>changeBlock(block.id,{weight})} options={lookStylePriorities}/></fieldset><textarea aria-label={section.label} placeholder={section.placeholder} maxLength={600} disabled={Boolean(busy)||!analysis} value={block.text} onChange={event=>changeBlock(block.id,{text:event.target.value})}/>{block.id==="palette"&&palette.length>0&&<div className="create-look-palette">{palette.map((colour,index)=><label key={index} title={colour.name}><input type="color" style={{width:32,height:28,padding:0,border:0}} aria-label={`Suggested colour ${index+1}`} disabled={Boolean(busy)} value={colour.hex} onChange={event=>{const hex=event.target.value;setPalette(current=>current.map((item,number)=>number===index?{...item,hex}:item));}}/><span>{colour.hex}</span></label>)}</div>}</article>;})}</div></section>
    <fieldset><legend>Tags</legend><div className="create-look-tags">{tags.map(value => <button type="button" key={value} disabled={Boolean(busy)} aria-label={`Remove tag ${value}`} onClick={() => setTags(tags.filter(item => item !== value))}>{value}<X size={13}/></button>)}</div></fieldset>
    <div className="library-inline"><input aria-label="New look tag" placeholder="Choose a category or add a tag" list="create-look-tag-options" maxLength={80} value={tag} disabled={Boolean(busy)} onChange={event => setTag(event.target.value)} onKeyDown={event => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(); } }}/><datalist id="create-look-tag-options">{options.map(value => <option key={value} value={value}/>)}</datalist><button type="button" disabled={Boolean(busy) || !tag.trim()} onClick={addTag}><Plus size={15}/>Add tag</button></div>
    {analysis&&<details className="create-look-prompt"><summary>Style prompt</summary><LookDescription text={stylePrompt||"Include a style section to build your prompt."}/></details>}
    <footer className="create-look-footer"><button type="button" disabled={Boolean(busy)} onClick={onClose}>Close</button><button type="button" className="library-primary" disabled={Boolean(busy) || !name.trim() || !analysis || stylePrompt.length < 80 || !examples.length} onClick={save}>Save Look</button></footer>
  </dialog>;
}
