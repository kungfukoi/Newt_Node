import path from "node:path";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { parse } from "parse5";

const attrs = node => Object.fromEntries((node.attrs || []).map(item => [item.name,item.value]));
const text = node => node?.nodeName === "#text" ? node.value : (node?.childNodes || []).map(text).join("");
const hasClass = (node,name) => (attrs(node).class || "").split(/\s+/).includes(name);
function findAll(node,predicate,result=[]) { if(predicate(node))result.push(node); for(const child of node.childNodes || [])findAll(child,predicate,result); return result; }
const first = (node,predicate) => findAll(node,predicate)[0];
const clean = value => String(value || "").replace(/\u00a0/g," ").trim();
const fail = (message,status=400) => {throw Object.assign(new Error(message),{status});};

// Parse inert HTML/JSON only. Never execute scripts from the mirrored website.
export function parseStyleFinderPage(html,relativeFile) {
  const document=parse(html), records=new Map();
  function walk(value) { if(!value || typeof value!=="object")return; if(typeof value.slug==="string" && typeof value.name==="string" && typeof value.prompt==="string")records.set(value.slug,value); for(const child of Object.values(value))if(child&&typeof child==="object")walk(child); }
  for(const script of findAll(document,node=>node.nodeName==="script")) {
    const match=text(script).match(/^self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?$/); if(!match)continue;
    try {const stream=JSON.parse(match[1])[1];if(typeof stream!=="string")continue;for(const line of stream.split("\n")){try{walk(JSON.parse(line.slice(line.indexOf(":")+1)));}catch{}}}catch{}
  }
  function image(node,index=0) {
    const src=attrs(node).src || ""; if(!src || /^(?:https?:|data:|\/\/)/i.test(src))return null;
    const local=path.posix.normalize(path.posix.join(path.posix.dirname(relativeFile),src.split("?")[0]));
    if(!local.startsWith("img/") || local.includes("..") || !/\.(jpe?g|png|webp)$/i.test(local))return null;
    return {id:`image-${index}`,url:`/api/style-library/catalog-image?file=${encodeURIComponent(local)}`,fileName:path.posix.basename(local),relativePath:local};
  }
  const heading=first(document,node=>hasClass(node,"sp-name"));
  if(heading) {
    const badges=first(heading,node=>hasClass(node,"sp-badges")); if(badges)badges.childNodes=[];
    const slug=path.posix.basename(relativeFile,".html"), rawPrompt=clean(text(first(document,node=>hasClass(node,"sp-prompt"))));
    const observations=first(document,node=>attrs(node).id==="sp-observations"), about=first(document,node=>attrs(node).id==="sp-about");
    const paragraphs=node=>findAll(node||{},item=>hasClass(item,"sp-prose")).map(item=>clean(text(item))).join("\n\n");
    return [{id:slug,name:clean(text(heading)),sourceUrl:`https://midlibrary.io/library/${slug}`,category:clean(text(first(document,node=>hasClass(node,"sp-kind")))),prompt:paragraphs(observations) || (rawPrompt.startsWith("--")?"":rawPrompt),midjourneyPrompt:rawPrompt,sref:rawPrompt.match(/--sref\s+\d+/)?.[0] || "",notes:paragraphs(about),tags:findAll(document,node=>hasClass(node,"sp-term")).map(node=>clean(text((node.childNodes||[]).find(child=>child.nodeName==="span")))),examples:findAll(document,node=>node.nodeName==="img"&&hasClass(node,"sp-render")).slice(0,4).map(image).filter(Boolean),detailAvailable:true}];
  }
  return findAll(document,node=>hasClass(node,"ml-style")&&attrs(node)["data-tile"]).map(card=>{
    const id=attrs(card)["data-tile"],record=records.get(id)||{};
    return {id,name:record.name || clean(text(first(card,node=>hasClass(node,"ml-style-name")))),sourceUrl:`https://midlibrary.io/library/${id}`,category:record.category || clean(text(first(card,node=>hasClass(node,"ml-style-category")))),prompt:record.prompt?.startsWith("--")?"":record.prompt || "",midjourneyPrompt:record.prompt || "",sref:record.prompt?.match(/--sref\s+\d+/)?.[0] || "",tags:[],notes:"",examples:[image(first(card,node=>node.nodeName==="img"&&hasClass(node,"ml-style-preview"))||{})].filter(Boolean)};
  }).filter(style=>style.name && /^[a-z0-9-]+$/.test(style.id));
}

export function createStyleFinderCatalog({root,cacheMs=30000}={}) {
  let snapshot=null,pending=null,expires=0;
  const pages=new Map();
  async function pageStyles(directory,file) {
    const absolute=path.join(directory,file), info=await stat(absolute);
    if(info.size>12*1024*1024)return [];
    const previous=pages.get(file);
    if(previous?.mtime===info.mtimeMs&&previous.size===info.size)return previous.styles;
    const styles=parseStyleFinderPage(await readFile(absolute,"utf8"),file);
    pages.set(file,{mtime:info.mtimeMs,size:info.size,styles});return styles;
  }
  async function siteRoot() { if(!root)fail("Choose the local StyleFinder folder in your server configuration.",503); const absolute=path.resolve(root); try {await stat(path.join(absolute,"library.html"));return absolute;}catch{const child=path.join(absolute,"midlibrary.io");await stat(path.join(child,"library.html"));return child;} }
  async function asset(file) {
    if(typeof file!=="string"||!file.startsWith("img/")||file.includes("..")||/[\\\x00]/.test(file)||!/\.(jpe?g|png|webp)$/i.test(file))fail("Invalid catalog image.");
    const directory=await realpath(await siteRoot()), target=await realpath(path.join(directory,file)), relative=path.relative(directory,target);
    if(relative.startsWith("..")||path.isAbsolute(relative))fail("Invalid catalog image.");
    if(!(await stat(target)).isFile())fail("This example has not downloaded yet.",404);return target;
  }
  async function available(style) {
    const examples=[];for(const example of style.examples||[]){try{await asset(example.relativePath);const {relativePath,...publicImage}=example;examples.push(publicImage);}catch{}}
    if(!examples.length)for(const example of style.fallbackExamples||[]){try{await asset(example.relativePath);const {relativePath,...publicImage}=example;examples.push(publicImage);}catch{}}
    const {fallbackExamples,...publicStyle}=style;
    return {...publicStyle,examples,previewUrl:examples[0]?.url || ""};
  }
  async function index(refresh=false) {
    if(!refresh&&snapshot&&Date.now()<expires)return snapshot;
    if(pending)return pending;
    pending=(async()=>{
      let directory;try{directory=await siteRoot();}catch{return {ready:false,styles:[],populating:false};}
      const files=(await readdir(directory)).filter(file=>/^library[a-f0-9]*\.html$/i.test(file)).sort((a,b)=>a==="library.html"?-1:b==="library.html"?1:a.localeCompare(b));
      const records=new Map();
      for(const file of files){try{for(const style of await pageStyles(directory,file))if(!records.has(style.id))records.set(style.id,style);}catch{/* Files can still be arriving. */}}
      let details=[];try{details=(await readdir(path.join(directory,"library"))).filter(file=>/^[a-z0-9-]+\.html$/.test(file));}catch{}
      const detailSet=new Set(details.map(file=>file.slice(0,-5)));
      for(const file of details){try{for(const style of await pageStyles(directory,`library/${file}`))records.set(style.id,{...style,fallbackExamples:records.get(style.id)?.examples||[]});}catch{}}
      let populating=false;try{await stat(path.join(directory,"..","hts-in_progress.lock"));populating=true;}catch{}
      snapshot={ready:true,styles:[...records.values()],populating,detailCount:detailSet.size};expires=Date.now()+cacheMs;return snapshot;
    })().finally(()=>{pending=null;});return pending;
  }
  async function search({q="",category="",offset=0,limit=48,refresh=false}={}) {
    const data=await index(refresh), words=String(q).slice(0,300).toLowerCase().split(/\s+/).filter(Boolean);
    const matched=data.styles.filter(style=>(!category||style.category===category)&&words.every(word=>[style.name,style.prompt,style.sref,style.category,...style.tags].join(" ").toLowerCase().includes(word)));
    const start=Math.max(0,Math.trunc(Number(offset)||0)),size=Math.min(96,Math.max(1,Math.trunc(Number(limit)||48)));
    return {ready:data.ready,populating:data.populating,total:matched.length,indexed:data.styles.length,offset:start,limit:size,categories:[...new Set(data.styles.map(style=>style.category).filter(Boolean))].sort(),styles:await Promise.all(matched.slice(start,start+size).map(available))};
  }
  async function detail(id) {
    if(!/^[a-z0-9-]{1,100}$/.test(id||""))fail("Choose a valid style.");
    const data=await index();let style=data.styles.find(item=>item.id===id);if(!style)fail("This style is not in the local catalog yet.",404);
    try{const directory=await siteRoot();const html=await readFile(path.join(directory,"library",`${id}.html`),"utf8");const detail=parseStyleFinderPage(html,`library/${id}.html`)[0];if(detail)style={...detail,fallbackExamples:style.fallbackExamples||style.examples};}catch{}
    return {style:await available(style)};
  }
  return {search,detail,asset};
}

export function registerStyleFinderRoutes(app,{root}={}) {
  const catalog=createStyleFinderCatalog({root});
  app.get("/api/style-library/catalog",async(req,res)=>{try{res.json(await catalog.search({...req.query,refresh:req.query.refresh==="1"}));}catch{res.status(500).json({error:"Could not read the local style catalog. Retry after its current download finishes."});}});
  app.get("/api/style-library/catalog/:id",async(req,res)=>{try{res.json(await catalog.detail(req.params.id));}catch(e){res.status(e.status||500).json({error:e.status?e.message:"Could not read this local style."});}});
  app.get("/api/style-library/catalog-image",async(req,res)=>{try{res.sendFile(await catalog.asset(req.query.file),{headers:{"Cache-Control":"private, max-age=60","X-Content-Type-Options":"nosniff"}});}catch(e){res.status(e.status||404).json({error:"This example is not available locally yet."});}});
}
