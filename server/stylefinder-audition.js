import path from "node:path";
import { readFile,stat } from "node:fs/promises";
import { createStyleFinderCatalog } from "./stylefinder-catalog.js";
import { readStyleFinderOverrides } from "./stylefinder-overrides.js";
import { createCompactStyleFinderSource, curatedStyleFinderPath } from "./stylefinder-compact.js";

const prefix="stylefinder-";
const fail=(message,status=503)=>{throw Object.assign(new Error(message),{status});};
export function createStyleFinderAudition({directory,readSharedCompact=async()=>null}) {
  let cached;
  const readCompact = createCompactStyleFinderSource(directory);
  async function activeCompact(){return await readSharedCompact() || readCompact();}
  async function read(){
    const compact = await activeCompact();
    if (compact) return compact;
    try{
      const filename=path.join(directory,"stylefinder-audition.json"),info=await stat(filename);
      if(info.size>64*1024*1024)throw Error("Index too large");
      const overrides=await readStyleFinderOverrides(directory);
      const key=`${info.mtimeMs}:${info.size}:${overrides.key}`;
      if(cached?.key===key)return cached.catalog;
      const manifest=JSON.parse(await readFile(filename,"utf8"));
      if(manifest.version!==1||!path.isAbsolute(manifest.sourceDirectory)||!manifest.snapshot?.ready||!Array.isArray(manifest.snapshot.styles)||manifest.snapshot.styles.length>50000)throw Error("Invalid index");
      for(const style of manifest.snapshot.styles){
        if(!/^[a-z0-9-]{1,100}$/.test(style.id)||typeof style.name!=="string"||!Array.isArray(style.tags)||!Array.isArray(style.examples))throw Error("Invalid look");
      }
      const catalog=createStyleFinderCatalog({root:manifest.sourceDirectory,initialSnapshot:manifest.snapshot,imageEndpoint:"/api/style-library/stylefinder-image",overrides:overrides.styles});
      cached={key,catalog};return catalog;
    }catch(error){if(error.status)throw error;fail("The local StyleFinder audition is unavailable. Index your mirror folder with scripts/indexStyleFinder.mjs, then refresh.");}
  }
  function style(value){
    const id=prefix+value.id;
    return {...value,id,catalogId:id,sourceProvider:value.sourceProvider||"Midlibrary",sourceAttribution:value.sourceAttribution||"Midlibrary.io · local StyleFinder mirror",
      ...(value.similarStyles?{similarStyles:value.similarStyles.map(style)}:{})};
  }
  async function searchShared(query){
    const compact=await readSharedCompact();
    if(!compact)return null;
    const result=compact.search(query);
    return {...result,styles:result.styles.map(style)};
  }
  async function search(query={}){
    try{
      const result=await (await read()).search(query);
      if(!result.ready)fail("The local StyleFinder source folder is unavailable. Reconnect it and refresh.");
      return {...result,source:"stylefinder",sourceLabel:"StyleFinder",styles:result.styles.map(style)};
    }catch(error){if(error.status)throw error;fail("The local StyleFinder source folder is unavailable. Reconnect it and refresh.");}
  }
  async function detail(id){
    if(typeof id!=="string"||!id.startsWith(prefix)||!/^[a-z0-9-]{1,100}$/.test(id.slice(prefix.length)))fail("Choose a valid StyleFinder look.",400);
    try{return {style:style((await (await read()).detail(id.slice(prefix.length))).style)};}
    catch(error){if(error.status)throw error;fail("This StyleFinder look is unavailable in the local source folder.");}
  }
  async function asset(file,version){
    if(version===undefined)return (await read()).asset(file);
    const compact=await readSharedCompact();
    if(!compact)fail("The shared catalog image is unavailable. Refresh the catalog.",404);
    return compact.asset(file,version);
  }
  async function curatedAsset(url) {
    if (!curatedStyleFinderPath.test(url)) return null;
    return (await readCompact())?.curatedAsset(url);
  }
  return {search,searchShared,detail,asset,curatedAsset};
}
export function registerStyleFinderCuratedImages(app, catalog) {
  app.get(curatedStyleFinderPath, async (req,res,next) => {
    try {
      const asset = await catalog.curatedAsset(req.path);
      if (!asset) return next();
      res.sendFile(asset.filename, {headers:{"Content-Type":asset.mimeType,"Cache-Control":"private, max-age=60","X-Content-Type-Options":"nosniff"}});
    } catch (error) {
      res.status(error.status || 404).json({error:"This curated StyleFinder image is unavailable in the compact catalog."});
    }
  });
}
export function registerStyleFinderAuditionRoutes(app,options,catalog=createStyleFinderAudition(options)){
  const error=(res,e)=>res.status(e.status||503).json({error:e.status?e.message:"This image is unavailable in the local StyleFinder folder."});
  app.get("/api/style-library/stylefinder",async(req,res)=>{try{res.json(await catalog.search({...req.query,refresh:req.query.refresh==="1"}));}catch(e){error(res,e);}});
  app.get("/api/style-library/stylefinder/:id",async(req,res)=>{try{res.json(await catalog.detail(req.params.id));}catch(e){error(res,e);}});
  app.get("/api/style-library/stylefinder-image",async(req,res)=>{
    try{
      const {filename,mimeType}=await catalog.asset(req.query.file,req.query.v);
      res.sendFile(filename,{headers:{"Content-Type":mimeType,"Cache-Control":"private, max-age=60","X-Content-Type-Options":"nosniff"}});
    }catch(e){
      if(e.code==="ENOENT")res.status(404).json({error:"This example has not downloaded yet."});
      else error(res,e);
    }
  });
}
