import path from "node:path";
import { open, readFile, readdir, realpath, stat } from "node:fs/promises";
import { parse } from "parse5";

const attrs = node => Object.fromEntries((node.attrs || []).map(item => [item.name,item.value]));
const text = node => node?.nodeName === "#text" ? node.value : (node?.childNodes || []).map(text).join("");
const hasClass = (node,name) => node.attrs?.find(item=>item.name==="class")?.value.split(/\s+/).includes(name);
function findAll(node,predicate,result=[]) { if(predicate(node))result.push(node); for(const child of node.childNodes || [])findAll(child,predicate,result); return result; }
function first(node,predicate) {
  if(predicate(node))return node;
  for(const child of node.childNodes||[]){
    const found=first(child,predicate);
    if(found)return found;
  }
}
const clean = value => String(value || "").replace(/\u00a0/g," ").trim();
const fail = (message,status=400) => {throw Object.assign(new Error(message),{status});};
const isImagePath = file => typeof file === "string" && file.startsWith("img/") &&
  !file.includes("..") && !/[\\:\x00]/.test(file) && /\.(?:jpe?g|png|webp|html)$/i.test(file);

const rasterFormats = [
  { signature: Buffer.from("ffd8ff","hex"), mimeType: "image/jpeg", extension: ".jpg" },
  { signature: Buffer.from("89504e470d0a1a0a","hex"), mimeType: "image/png", extension: ".png" },
  { signature: Buffer.from("WEBP"), offset: 8, mimeType: "image/webp", extension: ".webp" },
];

async function resolveImage(directory,file) {
  if (!isImagePath(file)) fail("Invalid catalog image.");
  const filename = await realpath(path.join(directory,file));
  const relative = path.relative(directory,filename);
  if (!relative.startsWith(`img${path.sep}`)) fail("Invalid catalog image.");
  if (!(await stat(filename)).isFile()) fail("This example has not downloaded yet.",404);

  const handle = await open(filename,"r");
  try {
    const header = Buffer.alloc(12);
    const {bytesRead} = await handle.read(header,0,header.length,0);
    const format = styleFinderRasterFormat(header.subarray(0,bytesRead));
    if (!format) fail("This example is not a downloaded raster image.",404);
    return {filename,mimeType:format.mimeType,extension:format.extension};
  } finally {
    await handle.close();
  }
}

export function styleFinderRasterFormat(bytes) {
  return rasterFormats.find(({signature,offset=0}) =>
    bytes.length >= offset+signature.length &&
    (!offset || bytes.toString("ascii",0,4)==="RIFF") &&
    bytes.subarray(offset,offset+signature.length).equals(signature));
}

export function selectStyleFinderPage(styles,{q="",category="",offset=0,limit=48}={}) {
  const words=String(q).slice(0,300).toLowerCase().split(/\s+/).filter(Boolean);
  const matched=styles.filter(style=>(!category||style.category===category||style.tags.includes(category))&&words.every(word=>[style.name,style.prompt,style.sref,style.category,...style.tags].join(" ").toLowerCase().includes(word)));
  const start=Math.max(0,Math.trunc(Number(offset)||0)),size=Math.min(96,Math.max(1,Math.trunc(Number(limit)||48)));
  return {total:matched.length,indexed:styles.length,offset:start,limit:size,styles:matched.slice(start,start+size)};
}

// Parse inert HTML/JSON only. Never execute scripts from the mirrored website.
export function parseStyleFinderPage(html,relativeFile) {
  return parseStyleFinderDocument(parse(html),relativeFile);
}

function parseStyleFinderDocument(document,relativeFile) {
  function image(node,index=0) {
    const {src,srcset=""}=attrs(node);
    // HTTrack keeps query strings with commas in its local responsive image URLs.
    const variants=Array.from(srcset.matchAll(/(?:^|,)\s*(\S+)\s+(?:\d+w|\d+(?:\.\d+)?x)(?=\s*(?:,|$))/g),match=>match[1]);
    const paths=new Set();
    for(const url of [src,...variants]){
      if(!url || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(url))continue;
      const pathname=url.split(/[?#]/,1)[0];
      const local=pathname.startsWith("/") ? pathname.slice(1) : path.posix.join(path.posix.dirname(relativeFile),pathname);
      if(isImagePath(local))paths.add(local);
    }
    const [relativePath,...alternates]=paths;
    return relativePath ? {id:`image-${index}`,relativePath,alternates} : null;
  }
  const heading=first(document,node=>hasClass(node,"sp-name"));
  if(heading) {
    const badges=first(heading,node=>hasClass(node,"sp-badges")); if(badges)badges.childNodes=[];
    const slug=path.posix.basename(relativeFile,".html"), rawPrompt=clean(text(first(document,node=>hasClass(node,"sp-prompt"))));
    const observations=first(document,node=>attrs(node).id==="sp-observations"), about=first(document,node=>attrs(node).id==="sp-about");
    const paragraphs=node=>findAll(node||{},item=>hasClass(item,"sp-prose")).map(item=>clean(text(item))).join("\n\n");
    const colours=findAll(document,node=>hasClass(node,"sp-colour")).map(node=>{
      const hex=attrs(node).style?.match(/(?:^|;)\s*--c\s*:\s*(#[a-f0-9]{6}|#[a-f0-9]{3})(?=\s*(?:;|$))/i)?.[1];
      const count=clean(text(first(node,item=>hasClass(item,"sp-count"))));
      const name=clean(text((node.childNodes||[]).find(item=>item.nodeName==="span"&&!hasClass(item,"sp-swatch")&&!hasClass(item,"sp-count"))));
      const percent=/^\d+(?:\.\d+)?%$/.test(count)?Number(count.slice(0,-1)):null;
      return hex&&name ? {name,hex,percent:percent!=null&&percent<=100?percent:null} : null;
    }).filter(Boolean).slice(0,20);
    const similarSection=first(document,node=>hasClass(node,"sp-similar"));
    const similarStyles=similarSection?parseStyleFinderDocument(similarSection,relativeFile).slice(0,12):[];
    const examples=findAll(document,node=>node.nodeName==="img"&&hasClass(node,"sp-render")).slice(0,4).map(image).filter(Boolean);
    if(!examples.length){
      // Older detail pages display quadrants from a single grid. Keep the source grid intact.
      const grid=image(first(document,node=>node.nodeName==="img"&&hasClass(node,"sp-vq-pic"))||{});
      if(grid)examples.push(grid);
    }
    return [{id:slug,name:clean(text(heading)),sourceUrl:`https://midlibrary.io/library/${slug}`,category:clean(text(first(document,node=>hasClass(node,"sp-kind")))),prompt:paragraphs(observations) || (rawPrompt.startsWith("--")?"":rawPrompt),midjourneyPrompt:rawPrompt,sref:rawPrompt.match(/--sref\s+\d+/)?.[0] || "",notes:paragraphs(about),tags:findAll(document,node=>hasClass(node,"sp-term")).map(node=>clean(text((node.childNodes||[]).find(child=>child.nodeName==="span")))),examples,colours,similarStyles,detailAvailable:true}];
  }
  const records=new Map();
  function walk(value) { if(!value || typeof value!=="object")return; if(typeof value.slug==="string" && typeof value.name==="string" && typeof value.prompt==="string")records.set(value.slug,value); for(const child of Object.values(value))if(child&&typeof child==="object")walk(child); }
  for(const script of findAll(document,node=>node.nodeName==="script")) {
    const match=text(script).match(/^self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?$/); if(!match)continue;
    try {const stream=JSON.parse(match[1])[1];if(typeof stream!=="string")continue;for(const line of stream.split("\n")){try{walk(JSON.parse(line.slice(line.indexOf(":")+1)));}catch{}}}catch{}
  }
  return findAll(document,node=>hasClass(node,"ml-style")&&attrs(node)["data-tile"]).map(card=>{
    const id=attrs(card)["data-tile"],record=records.get(id)||{};
    return {id,name:record.name || clean(text(first(card,node=>hasClass(node,"ml-style-name")))),sourceUrl:`https://midlibrary.io/library/${id}`,category:record.category || clean(text(first(card,node=>hasClass(node,"ml-style-category")))),prompt:record.prompt?.startsWith("--")?"":record.prompt || "",midjourneyPrompt:record.prompt || "",sref:record.prompt?.match(/--sref\s+\d+/)?.[0] || "",tags:[],notes:"",examples:[image(first(card,node=>node.nodeName==="img"&&hasClass(node,"ml-style-preview"))||{})].filter(Boolean)};
  }).filter(style=>style.name && /^[a-z0-9-]+$/.test(style.id));
}

export function createStyleFinderCatalog({root,cacheMs=30000,createdStore,initialSnapshot,imageEndpoint="/api/style-library/catalog-image",overrides={}}={}) {
  let snapshot=null,pending=null,expires=0;
  const applyOverride=style=>Object.hasOwn(overrides,style.id)?{...style,...overrides[style.id],id:style.id}:style;
  const pages=new Map();
  async function pageStyles(directory,file) {
    const absolute=path.join(directory,file), info=await stat(absolute);
    if(info.size>12*1024*1024)return {styles:[]};
    const previous=pages.get(file);
    if(previous?.mtime===info.mtimeMs&&previous.size===info.size)return previous;
    const document=parse(await readFile(absolute,"utf8"));
    const styles=parseStyleFinderDocument(document,file);
    const nextLink=file.includes("/") ? null : first(document,node=>node.nodeName==="a"&&attrs(node)["aria-label"]==="Next page");
    const next=nextLink&&attrs(nextLink).href?.match(/^(library[a-f0-9]+(?:-\d+)?\.html)\?page=\d+$/i)?.[1];
    const page={mtime:info.mtimeMs,size:info.size,styles,next};
    pages.set(file,page);return page;
  }
  async function siteRoot() { if(!root)fail("Choose the local StyleFinder folder in your server configuration.",503); const absolute=path.resolve(root); try {await stat(path.join(absolute,"library.html"));return absolute;}catch{const child=path.join(absolute,"midlibrary.io");await stat(path.join(child,"library.html"));return child;} }
  async function asset(file) {
    return resolveImage(await realpath(await siteRoot()),file);
  }
  async function available(style,directory,includeRelated=false) {
    style=applyOverride(style);
    if (style.catalogId) {
      const {fallbackExamples,similarStyles,...publicStyle}=style;
      return {...publicStyle,detailAvailable:true,previewUrl:style.examples[0]?.localUrl || "",...(includeRelated?{similarStyles:await Promise.all((similarStyles||[]).map(item=>available(item,directory)))}:{})};
    }
    async function resolveExamples(candidates) {
      const resolved=await Promise.all(candidates.map(async ({id,relativePath,alternates=[]})=>{
        // Some mirrored HTML references have only a same-name JPEG copy on disk.
        for(const reference of [relativePath,...alternates]){
          const paths=/\.html$/i.test(reference) ? [reference,reference.replace(/\.html$/i,".jpg")] : [reference];
          for(const file of paths){
            try{
              const {extension}=await resolveImage(directory,file);
              return {id,url:`${imageEndpoint}?file=${encodeURIComponent(file)}`,fileName:path.posix.basename(file,path.posix.extname(file))+extension};
            }catch{/* Try the next representation of this source image. */}
          }
        }
      }));
      return resolved.filter(Boolean);
    }
    let examples=await resolveExamples(style.examples||[]);
    if(!examples.length)examples=await resolveExamples(style.fallbackExamples||[]);
    const {fallbackExamples,similarStyles,...publicStyle}=style;
    return {...publicStyle,examples,previewUrl:examples[0]?.url || "",...(includeRelated?{similarStyles:await Promise.all((similarStyles||[]).map(item=>available(item,directory)))}:{})};
  }
  async function index(refresh=false) {
    if(initialSnapshot){await siteRoot();return initialSnapshot;}
    if(!refresh&&snapshot&&Date.now()<expires)return snapshot;
    if(pending)return pending;
    pending=(async()=>{
      let directory;try{directory=await siteRoot();}catch{return {ready:false,styles:[],populating:false};}
      const records=new Map();
      const indexedPages=new Set();
      async function addListing(file){
        const {styles,next}=await pageStyles(directory,file);
        indexedPages.add(file);
        for(const style of styles)if(!records.has(style.id))records.set(style.id,style);
        return next;
      }
      // Follow the unfiltered library's own paging links before considering legacy mirror filenames.
      let next="library.html",complete=false;
      try{
        while(next&&!indexedPages.has(next))next=await addListing(next);
        complete=!next&&indexedPages.size>1;
      }catch{/* Files can still be arriving. */}
      if(!complete){
        const files=(await readdir(directory)).filter(file=>/^library[a-f0-9]*(?:-\d+)?\.html$/i.test(file)).sort();
        for(const file of files){
          if(indexedPages.has(file))continue;
          try{await addListing(file);}catch{/* Files can still be arriving. */}
        }
      }
      let details=[];try{details=(await readdir(path.join(directory,"library"))).filter(file=>/^[a-z0-9-]+\.html$/.test(file));}catch{}
      const detailSet=new Set(details.map(file=>file.slice(0,-5)));
      for(const file of details){try{const {styles}=await pageStyles(directory,`library/${file}`);for(const style of styles)records.set(style.id,{...style,fallbackExamples:records.get(style.id)?.examples||[]});}catch{}}
      let populating=false;try{await stat(path.join(directory,"..","hts-in_progress.lock"));populating=true;}catch{}
      snapshot={ready:true,styles:[...records.values()],populating,detailCount:detailSet.size};expires=Date.now()+cacheMs;return snapshot;
    })().finally(()=>{pending=null;});return pending;
  }
  async function search({refresh=false,...query}={}) {
    const data=await index(refresh);
    const created=createdStore ? await createdStore.read() : [], styles=[...created,...data.styles.map(applyOverride)];
    // Expose Characters explicitly while keeping other descriptive tags out of the Filter menu.
    const categories=new Set([...created,...data.styles].flatMap(style=>[style.category,...(style.catalogId?style.tags:[])]).filter(Boolean));
    if(styles.some(style=>style.tags.includes("Characters")))categories.add("Characters");
    const page=selectStyleFinderPage(styles,query);
    const directory=data.ready ? await realpath(await siteRoot()) : null;
    return {...page,ready:data.ready||created.length>0,populating:data.populating,categories:[...categories].sort(),styles:await Promise.all(page.styles.map(style=>available(style,directory)))};
  }
  async function detail(id,{includeRelated=true}={}) {
    if(!/^[a-z0-9-]{1,100}$/.test(id||""))fail("Choose a valid style.");
    const created=createdStore ? (await createdStore.read()).find(item=>item.id===id) : null;
    if(created)return {style:await available(created)};
    const data=await index();let style=data.styles.find(item=>item.id===id)||data.styles.flatMap(item=>item.similarStyles||[]).find(item=>item.id===id);if(!style)fail("This style is not in the local catalog yet.",404);
    const directory=await realpath(await siteRoot());
    try{const {styles:[detail]}=await pageStyles(directory,`library/${id}.html`);if(detail)style={...detail,fallbackExamples:style.fallbackExamples||style.examples};}catch{}
    return {style:await available(style,directory,includeRelated)};
  }
  return {search,detail,asset,snapshot:index};
}

export function registerStyleFinderRoutes(app,{root,createdStore}={}) {
  const catalog=createStyleFinderCatalog({root,createdStore});
  app.get("/api/style-library/catalog",async(req,res)=>{try{res.json(await catalog.search({...req.query,refresh:req.query.refresh==="1"}));}catch{res.status(500).json({error:"Could not read the local style catalog. Retry after its current download finishes."});}});
  app.get("/api/style-library/catalog/:id",async(req,res)=>{try{res.json(await catalog.detail(req.params.id));}catch(e){res.status(e.status||500).json({error:e.status?e.message:"Could not read this local style."});}});
  app.get("/api/style-library/catalog-image",async(req,res)=>{try{const {filename,mimeType}=await catalog.asset(req.query.file);res.sendFile(filename,{headers:{"Content-Type":mimeType,"Cache-Control":"private, max-age=60","X-Content-Type-Options":"nosniff"}});}catch(e){res.status(e.status||404).json({error:"This example is not available locally yet."});}});
}
