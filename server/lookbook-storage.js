import path from "node:path";
import { createHash,randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile,rename,readdir,stat,realpath,rm } from "node:fs/promises";
import sharp from "sharp";
import { createCustomLookStore,prepareCustomLook } from "./custom-looks.js";
import { createCompactStyleFinderReader } from "./stylefinder-compact.js";
import { normalizeLibraryStyle } from "../src/styleLibrary.js";

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const digest=buffer=>createHash("sha256").update(buffer).digest("hex");
const idPattern=/^look-[a-f0-9-]{36}$/;
const assetPattern=/^([a-f0-9]{64})\.(png|jpg|webp|avif)$/;
const assetPrefix="/uploads/shared-looks/";
const looksRoot=setting=>setting.looksDirectory??setting.directory;
function lookLocation(setting){
  const root=looksRoot(setting);
  const nested=path.join(root,"looks");
  // A dedicated folder stores records directly. Read the older nested layout too.
  if(setting.looksDirectory===undefined)return {root,folders:[nested]};
  return {root,folders:root===setting.directory?[nested,root]:[root,nested]};
}
export async function removeOriginalLookImage(url,uploadsDirectory){
  if(typeof url!=="string"||!url.startsWith("/uploads/")||url.startsWith(assetPrefix)||url.includes("..")||/[?#\\]/.test(url))return false;
  const root=path.resolve(uploadsDirectory),filename=path.resolve(root,url.slice("/uploads/".length));
  if(!filename.startsWith(root+path.sep))fail("Original image path is outside managed uploads.");
  let resolved;try{resolved=await realpath(filename);}catch(error){if(error.code==="ENOENT")return false;throw error;}
  const actualRoot=await realpath(root);if(!resolved.startsWith(actualRoot+path.sep)||(await stat(resolved)).isDirectory())fail("Original image path is outside managed uploads.");
  await rm(filename);return true;
}
export function createLookbookStorage({directory,cacheDirectory,readAsset,removeOriginal}){
  const local=createCustomLookStore({directory}),configPath=path.join(directory,"lookbook-storage.json"),aliasPath=path.join(directory,"lookbook-image-aliases.json"),assets=new Map();
  const readCatalog=createCompactStyleFinderReader({shared:true});
  let queue=Promise.resolve(),aliasCache=null;
  function serial(action){const work=queue.then(action);queue=work.catch(()=>{});return work;}
  async function config(){try{const value=JSON.parse(await readFile(configPath,"utf8"));if(typeof value.directory!=="string"||(value.looksDirectory!==undefined&&typeof value.looksDirectory!=="string"))throw Error("Invalid Lookbook storage setting.");return value;}catch(error){if(error.code==="ENOENT")return {directory:""};throw error;}}
  async function rootAvailable(root){
    try{if(!(await stat(root)).isDirectory())throw Error("Not a directory");}
    catch{fail("The shared folder is unavailable. Mount the drive or update the path in Settings → User Preferences.",503);}
  }
  async function resolveFolder(value,previous){
    if(typeof value!=="string"||value.length>4096)fail("Enter a folder path.");
    const root=value.trim();
    if(!root||root===previous)return root;
    if(!path.isAbsolute(root)||root.includes("\0"))fail("Use the mounted folder's absolute filesystem path, not a lucid:// sharing link.");
    await rootAvailable(root);
    return realpath(root);
  }
  async function checkWritable(root){
    const probe=path.join(root,`.newt-lookbook-${randomUUID()}.tmp`);
    try{await writeFile(probe,"",{flag:"wx"});await rm(probe);}
    catch{fail("The Shared User Looks folder needs write access. Check its permissions or choose another folder.",503);}
  }
  async function openCompact(root,options){
    try{return await readCatalog(root,options);}
    catch{fail("The shared compact catalog could not be opened. Check that its folder is mounted and contains a valid catalog.json.",503);}
  }
  async function readSharedCompact(){
    const setting=await config();
    return setting.format==="compact"?openCompact(setting.directory):null;
  }
  async function record(folder,id){
    const filename=path.join(folder,id,"look.json"),info=await stat(filename);
    if(info.size>1024*1024)throw Error("A shared look record is too large.");
    const value=JSON.parse(await readFile(filename,"utf8"));
    if(value.version!==1||value.look?.id!==id||!assetPattern.test(`${value.hash}.png`)||!Array.isArray(value.images)||!value.images.length||value.images.length>6)throw Error("A shared look record is invalid.");
    for(const image of value.images){if(!assetPattern.test(image.storedName)||image.hash!==image.storedName.split(".")[0])throw Error("A shared look image record is invalid.");}
    return value;
  }
  function display(folder,value){
    const examples=value.images.map((image,index)=>{
      const localUrl=assetPrefix+image.storedName;
      assets.set(localUrl,{filename:path.join(folder,value.look.id,"images",image.storedName),hash:image.hash,size:image.size});
      return {id:`example-${index}`,localUrl,fileName:image.fileName,mimeType:image.mimeType};
    });
    return normalizeLibraryStyle({...value.look,examples});
  }
  async function readShared({root,folders}){
    await rootAvailable(root);
    const locations=new Map();
    for(const folder of folders){
      let entries;
      try{entries=await readdir(folder,{withFileTypes:true});}catch(error){if(error.code==="ENOENT")continue;throw error;}
      for(const item of entries)if(item.isDirectory()&&idPattern.test(item.name)&&!locations.has(item.name))locations.set(item.name,folder);
    }
    const ids=[...locations.keys()].sort();
    const looks=[];for(let offset=0;offset<ids.length;offset+=16)looks.push(...await Promise.all(ids.slice(offset,offset+16).map(async id=>{try{const folder=locations.get(id),look=display(folder,await record(folder,id));return await isDeleted(folder,id)?null:look;}catch{fail(`Shared look ${id} could not be read. Check the shared folder before saving more looks.`,503);}})));
    const active=looks.filter(Boolean);if(active.length>5000)fail("The shared Lookbook exceeds 5,000 looks.");return active;
  }
  async function isDeleted(folder,id){try{await stat(path.join(folder,id,"deleted.json"));return true;}catch(error){if(error.code==="ENOENT")return false;throw error;}}
  async function findRecord(folders,id){
    for(const folder of folders){
      try{return {folder,value:await record(folder,id)};}catch(error){if(error.code!=="ENOENT")throw error;}
    }
    return null;
  }
  async function read(){const location=lookLocation(await config());return location.root?readShared(location):local.read();}
  async function readSharedLooks(){
    const location=lookLocation(await config());
    return location.root?readShared(location):null;
  }
  async function aliases(){if(aliasCache)return aliasCache;try{return aliasCache=JSON.parse(await readFile(aliasPath,"utf8"));}catch(error){if(error.code==="ENOENT")return aliasCache={};throw error;}}
  async function assetAlias(url){
    if(typeof url!=="string"||!url.startsWith("/uploads/")||url.startsWith(assetPrefix))return "";
    const target=(await aliases())[url];return typeof target==="string"&&target.startsWith(assetPrefix)&&assetPattern.test(target.slice(assetPrefix.length))?target:"";
  }
  async function ensureAsset(url){
    if(typeof url!=="string"||!url.startsWith(assetPrefix)||!assetPattern.test(url.slice(assetPrefix.length)))fail("Invalid shared look image.");
    const filename=path.join(cacheDirectory,url.slice(assetPrefix.length));
    try{if((await stat(filename)).isFile())return filename;}catch(error){if(error.code!=="ENOENT")throw error;}
    if(!assets.has(url))await read();
    const source=assets.get(url);if(!source)fail("This shared look image is not in the configured catalog.",404);
    let buffer;try{const info=await stat(source.filename);if(!info.isFile()||info.size>16*1024*1024)throw Error("Invalid image");buffer=await readFile(source.filename);}catch{fail("This shared look image is unavailable. Mount LucidLink and refresh the catalog.",503);}
    if(digest(buffer)!==source.hash)fail("The shared look image is incomplete or has changed. Refresh after LucidLink finishes syncing.",503);
    await mkdir(cacheDirectory,{recursive:true});const temporary=`${filename}.${randomUUID()}.tmp`;
    await writeFile(temporary,buffer);try{await rename(temporary,filename);}catch(error){await rm(temporary,{force:true});if(!(await stat(filename).catch(()=>null))?.isFile())throw error;}
    return filename;
  }
  async function get(id){const look=(await read()).find(item=>item.id===id);if(look)await Promise.all(look.examples.filter(image=>image.localUrl.startsWith(assetPrefix)).map(image=>ensureAsset(image.localUrl)));return look;}
  async function sharedAdd(location,source){
    await rootAvailable(location.root);const look=prepareCustomLook(source),images=[];
    for(const example of look.examples){
      const asset=await readAsset(example.localUrl);
      if(!asset.buffer?.length||asset.buffer.length>16*1024*1024)fail("Look images must be at most 16 MB.");
      const info=await sharp(asset.buffer,{limitInputPixels:40000000,animated:false}).metadata();
      const formats={png:["png","image/png"],jpeg:["jpg","image/jpeg"],webp:["webp","image/webp"],heif:["avif","image/avif"]},format=formats[info.format];
      if(!format)fail("Shared looks support PNG, JPEG, WebP and AVIF images.");
      const hash=digest(asset.buffer);images.push({hash,storedName:`${hash}.${format[0]}`,fileName:example.fileName||asset.fileName||`example.${format[0]}`,mimeType:format[1],size:asset.buffer.length,buffer:asset.buffer});
    }
    const metadata={...look,examples:[]},hash=digest(JSON.stringify({look:metadata,images:images.map(({buffer,...image})=>image)}));
    const [parent]=location.folders,target=path.join(parent,look.id);
    async function existing(){
      const match=await findRecord(location.folders,look.id);
      if(!match)return null;
      const {folder,value}=match;
      if(await isDeleted(folder,look.id))fail("This Look was deleted from the catalog. Create a new Look to save it again.",409);
      if(value.hash!==hash)fail("This look identity already exists with different contents. Edit the draft to save a new look.",409);
      return display(folder,value);
    }
    const previous=await existing();if(previous)return previous;
    if((await readShared(location)).length>=5000)fail("The shared Lookbook has reached its 5,000 look limit.");
    if(parent!==location.root)await mkdir(parent,{recursive:true});
    const temporary=path.join(parent,`.${look.id}.${randomUUID()}.tmp`);await mkdir(path.join(temporary,"images"),{recursive:true});
    const value={version:1,hash,look:metadata,images:images.map(({buffer,...image})=>image)};
    try{
      for(const image of images)await writeFile(path.join(temporary,"images",image.storedName),image.buffer,{mode:0o644});
      await writeFile(path.join(temporary,"look.json"),JSON.stringify(value,null,2),{mode:0o644});
      try{await rename(temporary,target);}catch(error){const winner=await existing();if(winner)return winner;throw error;}
      return display(parent,value);
    }finally{
      // Remove only this operation's known files; never recursively remove a shared folder.
      for(const image of images)await rm(path.join(temporary,"images",image.storedName),{force:true}).catch(()=>{});
      await rm(path.join(temporary,"look.json"),{force:true}).catch(()=>{});
      const {rmdir}=await import("node:fs/promises");await rmdir(path.join(temporary,"images")).catch(()=>{});await rmdir(temporary).catch(()=>{});
    }
  }
  async function retireImages(originals,sharedLooks){
    const mapping={...await aliases()};let images=0;
    for(let index=0;index<originals.length;index++){
      const shared=sharedLooks[index];await Promise.all(shared.examples.map(image=>ensureAsset(image.localUrl)));
      originals[index].examples.forEach((image,number)=>{if(image.localUrl!==shared.examples[number].localUrl)mapping[image.localUrl]=shared.examples[number].localUrl;});
    }
    const temporary=`${aliasPath}.${randomUUID()}.tmp`;await mkdir(directory,{recursive:true});await writeFile(temporary,JSON.stringify(mapping),{mode:0o600});await rename(temporary,aliasPath);aliasCache=mapping;
    if(removeOriginal)for(const url of new Set(originals.flatMap(look=>look.examples.map(image=>image.localUrl))))if(await removeOriginal(url))images++;
    return images;
  }
  function add(source){return serial(async()=>{const location=lookLocation(await config());if(!location.root)return local.add(source);const saved=await sharedAdd(location,source);await retireImages([source],[saved]);return saved;});}
  async function state(){const setting=await config(),looksDirectory=looksRoot(setting);return {directory:setting.directory,looksDirectory,mode:looksDirectory?"shared":"local",localCount:(await local.read()).length,...(setting.format==="compact"?{format:setting.format}:{})};}
  function configure(body={}){return serial(async()=>{
    const previous=await config();
    const root=await resolveFolder(body.directory,previous.directory);
    const compact=root===previous.directory?previous.format==="compact"
      :root&&await openCompact(root,{optional:body.looksDirectory===undefined});
    const looksDirectory=body.looksDirectory===undefined?previous.looksDirectory:await resolveFolder(body.looksDirectory,looksRoot(previous));
    const location=lookLocation({directory:root,looksDirectory});
    if(location.root){
      const copies=body.copyLocal===false?[]:await local.read();
      if(copies.length||(location.root!==looksRoot(previous)&&(looksDirectory!==undefined||!compact)))await checkWritable(location.root);
      for(const look of copies)await sharedAdd(location,look);
    }
    await mkdir(directory,{recursive:true});const temporary=`${configPath}.${randomUUID()}.tmp`;await writeFile(temporary,JSON.stringify({version:1,directory:root,looksDirectory,...(compact?{format:"compact"}:{})}),{mode:0o600});await rename(temporary,configPath);
    return state();
  });}
  function retireLocalCopies(){return serial(async()=>{
    const location=lookLocation(await config());if(!location.root)fail("Set Shared User Looks before removing local originals.");
    await rootAvailable(location.root);const originals=await local.read(),sharedLooks=[];
    for(const source of originals)sharedLooks.push(await sharedAdd(location,source));
    const images=await retireImages(originals,sharedLooks);
    await rm(path.join(directory,"custom-looks.json"),{force:true});
    return {...await state(),retiredLooks:originals.length,removedImages:images};
  });}
  function remove(id,{directory:expectedDirectory}={}){return serial(async()=>{
    if(!idPattern.test(id||""))fail("Only user-created Looks can be deleted.");
    const {root,folders}=lookLocation(await config());if(expectedDirectory!==undefined&&expectedDirectory!==root)fail("Lookbook storage changed. Refresh the catalog before deleting this Look.",409);if(!root)return local.remove(id);
    await rootAvailable(root);const match=await findRecord(folders,id);if(!match)return {id,removed:false};
    const {folder,value}=match;
    display(folder,value);if(await isDeleted(folder,id))return {id,removed:false};
    const filename=path.join(folder,id,"deleted.json"),temporary=`${filename}.${randomUUID()}.tmp`;
    await writeFile(temporary,JSON.stringify({version:1,id,deletedAt:new Date().toISOString()}),{mode:0o644});try{await rename(temporary,filename);}catch(error){await rm(temporary,{force:true});if(!await isDeleted(folder,id))throw error;}
    return {id,removed:true};
  });}
  return {read,add,get,ensureAsset,assetAlias,state,configure,retireLocalCopies,remove,readSharedCompact,readSharedLooks};
}
export function registerLookbookStorageRoutes(app,store){
  const error=(res,e)=>res.status(e.status||500).json({error:e.status?e.message:"Could not access Lookbook storage. Check the folder and its permissions; the previous setting is unchanged."});
  app.get("/api/style-library/storage",async(_req,res)=>{try{res.json(await store.state());}catch(e){error(res,e);}});
  app.put("/api/style-library/storage",async(req,res)=>{try{res.json(await store.configure(req.body));}catch(e){error(res,e);}});
  app.post("/api/style-library/storage/retire-local",async(_req,res)=>{try{res.json(await store.retireLocalCopies());}catch(e){error(res,e);}});
  app.get("/uploads/shared-looks/:filename",async(req,res)=>{try{res.sendFile(await store.ensureAsset(assetPrefix+req.params.filename));}catch(e){error(res,e);}});
  app.use("/uploads",async(req,res,next)=>{try{const target=await store.assetAlias("/uploads"+req.path);if(!target)return next();res.sendFile(await store.ensureAsset(target));}catch(e){error(res,e);}});
}
