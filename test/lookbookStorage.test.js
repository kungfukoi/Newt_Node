import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import {createHash,randomUUID} from "node:crypto";
import {mkdtemp,mkdir,readFile,rename,rm,readdir,symlink,writeFile,stat} from "node:fs/promises";
import sharp from "sharp";
import express from "express";
import {createLookbookStorage,registerLookbookStorageRoutes,removeOriginalLookImage} from "../server/lookbook-storage.js";
import {createStyleFinderAudition} from "../server/stylefinder-audition.js";

const draft=()=>({id:`look-${randomUUID()}`,name:"Shared ink",prompt:"Fine irregular ink contours with transparent watercolor washes, softly feathered edges and visible warm paper grain.",sourceProvider:"Newt",notes:"Ink and wash",tags:["Illustration"],examples:[{localUrl:"/uploads/local.png",fileName:"reference.png"}],styleAnalysis:{stylePrompt:"Already extracted",fingerprint:"a".repeat(64)}});
async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"newt-lookbook-shared-"));assert.equal(path.dirname(root),os.tmpdir());
  t.after(()=>rm(root,{recursive:true,force:true}));
  const shared=path.join(root,"Lucid Folder"),a=path.join(root,"computer-a"),b=path.join(root,"computer-b");await mkdir(shared);
  const buffer=await sharp({create:{width:32,height:40,channels:3,background:"#ddc631"}}).png().toBuffer();
  const store=directory=>createLookbookStorage({directory,cacheDirectory:path.join(directory,"uploads","shared-looks"),readAsset:async()=>({buffer,fileName:"reference.png"})});
  return {root,shared,a,b,buffer,one:store(a),two:store(b),store};
}
test("Shared looks and images use relative records; separate machines hydrate their own portable managed assets",async t=>{
  const f=await fixture(t);await f.one.configure({directory:f.shared});await f.two.configure({directory:f.shared});
  const source=draft(),saved=await f.one.add(source);assert.match(saved.examples[0].localUrl,/^\/uploads\/shared-looks\/[a-f0-9]{64}\.png$/);
  const manifest=await readFile(path.join(f.shared,"looks",source.id,"look.json"),"utf8");assert.equal(manifest.includes("/uploads/"),false);assert.equal(manifest.includes(f.a),false);
  const other=await f.two.get(source.id);assert.equal(other.name,source.name);assert.equal(other.styleAnalysis.stylePrompt,source.prompt);
  const filename=await f.two.ensureAsset(other.examples[0].localUrl);assert.ok(filename.startsWith(f.b));assert.deepEqual(await readFile(filename),f.buffer);
  assert.equal((await f.two.read()).length,1);assert.equal((await f.store(f.b).state()).directory,await (await import('node:fs/promises')).realpath(f.shared));
});

test("Shared Looks has its own destination and an empty path keeps new looks local",async t=>{
  const f=await fixture(t),catalog=path.join(f.root,"compact-catalog");
  await mkdir(catalog);
  const card={id:"catalog-ink",name:"Catalog ink",tags:[],examples:[]};
  await writeFile(path.join(catalog,"catalog.json"),JSON.stringify({version:1,styles:[card],categories:["Illustration","Photography"],assets:{},details:{}}));
  const settings=await f.one.configure({directory:catalog,looksDirectory:""});
  assert.equal(settings.mode,"local");
  assert.equal(settings.format,"compact");
  const localLook=draft();
  await f.one.add(localLook);
  assert.equal((await f.one.get(localLook.id)).examples[0].localUrl,"/uploads/local.png");
  assert.deepEqual((await f.one.searchLocalLooks()).styles.map(look=>look.id),[localLook.id]);

  await f.one.configure({directory:settings.directory,looksDirectory:f.shared,copyLocal:false});
  await f.two.configure({directory:f.shared});
  const legacy=draft();
  await f.two.add(legacy);
  await f.two.configure({directory:"",looksDirectory:f.shared});
  const source=draft(),saved=await f.one.add(source);
  assert.ok(await stat(path.join(f.shared,source.id,"look.json")));
  assert.ok(await stat(path.join(f.shared,"looks",legacy.id,"look.json")));
  await assert.rejects(stat(path.join(catalog,"looks")),{code:"ENOENT"});
  assert.equal((await f.one.get(legacy.id)).id,legacy.id);
  await f.one.add(legacy);
  await assert.rejects(stat(path.join(f.shared,legacy.id)),{code:"ENOENT"});
  assert.deepEqual((await f.two.get(source.id)).examples,saved.examples);
  const reopened=f.store(f.a),current=await reopened.state();
  const styleFinder=createStyleFinderAudition({directory:f.a,readSharedCompact:reopened.readSharedCompact,readCreatedLooks:reopened.read,readSharedLooks:reopened.readSharedLooks});
  const first=await styleFinder.searchSharedUserLooks({limit:1});
  const second=await styleFinder.searchSharedUserLooks({offset:1,limit:1});
  assert.equal(first.total,2);
  assert.equal(first.looksDirectory,current.looksDirectory);
  assert.deepEqual(first.categories,(await styleFinder.search()).categories);
  assert.deepEqual((await styleFinder.search({own:true})).styles.map(look=>look.id),["stylefinder-catalog-ink"]);
  assert.deepEqual((await reopened.searchLocalLooks()).styles,[]);
  assert.equal((await styleFinder.searchSharedUserLooks({category:"Illustration"})).total,2);
  assert.equal((await styleFinder.searchSharedUserLooks({category:"Photography"})).total,0);
  assert.deepEqual(new Set([...first.styles,...second.styles].map(look=>look.id)),new Set([source.id,legacy.id]));
  assert.equal((await styleFinder.searchSharedUserLooks({q:"not present"})).total,0);
  assert.equal(current.directory,settings.directory);
  assert.equal(current.mode,"shared");
  assert.equal((await reopened.readSharedCompact()).search({}).styles[0].id,card.id);
  await assert.rejects(reopened.remove(source.id,{directory:current.directory}),{status:409});
  await assert.rejects(reopened.purgeSharedLook(source.id,current.directory),{status:409});
  assert.equal((await reopened.purgeSharedLook(source.id,first.looksDirectory)).removed,true);
  await assert.rejects(stat(path.join(f.shared,source.id)),{code:"ENOENT"});
  assert.equal((await reopened.purgeSharedLook(source.id,first.looksDirectory)).removed,false);
  assert.deepEqual((await styleFinder.searchSharedUserLooks()).styles.map(look=>look.id),[legacy.id]);

  await reopened.configure({directory:current.directory,looksDirectory:""});
  assert.deepEqual((await styleFinder.searchSharedUserLooks()).styles,[]);
  assert.deepEqual((await reopened.read()).map(look=>look.id),[localLook.id]);
  assert.equal((await reopened.state()).format,"compact");
});
test("Film Stills keeps its own folder, detail identities and versioned image route",async t=>{
  const f=await fixture(t),film=path.join(f.root,"Film Stills");
  const hash=createHash("sha256").update(f.buffer).digest("hex"),blob=`${hash}.png`;
  const bucket=path.join(film,"images",hash.slice(0,2));
  await mkdir(bucket,{recursive:true});
  await writeFile(path.join(bucket,blob),f.buffer);
  const example={url:"/api/style-library/stylefinder-image?file=img%2Fstill.png"};
  const style={id:"still",name:"First frame",category:"Film Stills",tags:[],examples:[example]};
  await writeFile(path.join(film,"catalog.json"),JSON.stringify({version:1,styles:[style],categories:["Film Stills"],details:{},assets:{"img/still.png":blob}}));
  const saved=await f.one.configure({directory:"",looksDirectory:f.shared,filmStillsDirectory:film});
  await assert.rejects(f.one.configure({...saved,filmStillsDirectory:f.shared}),{status:503});
  await f.one.configure({directory:"",looksDirectory:f.shared,copyLocal:false});
  assert.equal((await f.one.state()).filmStillsDirectory,saved.filmStillsDirectory);
  assert.equal(await f.one.readSharedCompact(),null);

  const app=express();
  registerLookbookStorageRoutes(app,f.one);
  const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}`;
  const endpoint=`${base}/api/style-library/film-stills`;
  const page=await (await fetch(`${endpoint}?q=first&category=Film%20Stills`)).json();
  assert.equal(page.total,1);
  const [card]=page.styles;
  assert.equal(card.catalogId,"film-stills-still");
  assert.deepEqual((await (await fetch(`${endpoint}/${card.id}`)).json()).style,card);
  const image=await fetch(base+card.examples[0].url);
  assert.equal(image.headers.get("content-type"),"image/png");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),f.buffer);
  assert.equal((await fetch(base+card.examples[0].url.replace(blob,"stale.png"))).status,404);
});
test("Independent concurrent writers retain both looks; identical Save retries are idempotent and conflicting ids reject",async t=>{
  const f=await fixture(t);await f.one.configure({directory:f.shared});await f.two.configure({directory:f.shared});const first=draft(),second={...draft(),name:"Second"};
  await Promise.all([f.one.add(first),f.two.add(second)]);assert.equal((await f.one.read()).length,2);
  await Promise.all([f.one.add(first),f.two.add(first)]);assert.equal((await f.two.read()).length,2);
  await assert.rejects(f.one.add({...first,name:"Changed"}),error=>error.status===409);
  assert.equal((await readdir(path.join(f.shared,"looks"))).filter(name=>name.startsWith(".")).length,0);
});
test("Choosing a shared folder copies local looks without deleting originals and unavailable mounts never receive local fallback saves",async t=>{
  const f=await fixture(t),source=draft();await f.one.add(source);await f.one.configure({directory:f.shared});assert.equal((await f.two.configure({directory:f.shared})).mode,"shared");assert.equal((await f.two.read()).length,1);
  assert.equal(JSON.parse(await readFile(path.join(f.a,"custom-looks.json"),"utf8")).looks.length,1);
  const cached=await f.one.get(source.id),cachedFile=await f.one.ensureAsset(cached.examples[0].localUrl);
  await rename(f.shared,f.shared+"-offline");await assert.rejects(f.one.add(draft()),error=>error.status===503);await assert.rejects(f.one.read(),error=>error.status===503);
  assert.equal(await f.one.ensureAsset(cached.examples[0].localUrl),cachedFile);
  assert.equal(JSON.parse(await readFile(path.join(f.a,"custom-looks.json"),"utf8")).looks.length,1);
  await f.one.configure({directory:""});assert.equal((await f.one.read()).length,1);
});
test("Settings and asset routes reject sharing URIs/traversal and retain the prior setting on invalid paths",async t=>{
  const f=await fixture(t);await f.one.configure({directory:f.shared});
  await assert.rejects(f.one.configure({directory:"lucid://filespace/file/12:34/library"}),/absolute filesystem path/);
  assert.equal((await f.one.state()).directory,await (await import('node:fs/promises')).realpath(f.shared));
  for(const url of ["/uploads/shared-looks/../../secret","/uploads/shared-looks/a.svg","/uploads/shared-looks/"+"a".repeat(64)+".png?token=x"])await assert.rejects(f.one.ensureAsset(url));
  const app=express();app.use(express.json());registerLookbookStorageRoutes(app,f.one);const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,saved=await f.one.add(draft());assert.equal((await fetch(base+"/api/style-library/storage")).status,200);
  const image=await fetch(base+saved.examples[0].localUrl);assert.equal(image.status,200);assert.match(image.headers.get("content-type"),/image\/png/);assert.deepEqual(Buffer.from(await image.arrayBuffer()),f.buffer);
  const deleted=await fetch(base+"/api/style-library/shared-user-looks/"+saved.id,{
    method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({directory:(await f.one.state()).looksDirectory}),
  });
  assert.equal(deleted.status,200);
  assert.deepEqual(await deleted.json(),{id:saved.id,removed:true});
  await assert.rejects(stat(path.join(f.shared,"looks",saved.id)),{code:"ENOENT"});
});

test("A filesystem symbolic-link or Windows junction root resolves to the same shared folder",async t=>{
  const f=await fixture(t),link=path.join(f.root,"linked-library");await symlink(f.shared,link,process.platform==="win32"?"junction":"dir");
  await f.one.configure({directory:link});const look=draft();await f.one.add(look);await f.two.configure({directory:f.shared});assert.equal((await f.two.get(look.id)).name,look.name);
});

test("Retiring local originals removes only verified duplicates and preserves old workflow image URLs through shared aliases",async t=>{
  const f=await fixture(t),uploads=path.join(f.a,"uploads");await mkdir(uploads,{recursive:true});const original=path.join(uploads,"local.png");await writeFile(original,f.buffer);
  const store=createLookbookStorage({directory:f.a,cacheDirectory:path.join(uploads,"shared-looks"),readAsset:async()=>({buffer:f.buffer,fileName:"reference.png"}),removeOriginal:url=>removeOriginalLookImage(url,uploads)});
  await store.add(draft());await store.configure({directory:f.shared});const result=await store.retireLocalCopies();assert.equal(result.retiredLooks,1);assert.equal(result.removedImages,1);assert.equal(result.localCount,0);assert.equal((await store.read()).length,1);
  await assert.rejects(stat(original),error=>error.code==="ENOENT");await assert.rejects(stat(path.join(f.a,"custom-looks.json")),error=>error.code==="ENOENT");
  const target=await store.assetAlias("/uploads/local.png");assert.match(target,/^\/uploads\/shared-looks\//);assert.deepEqual(await readFile(await store.ensureAsset(target)),f.buffer);
  const reopened=f.store(f.a);assert.equal(await reopened.assetAlias("/uploads/local.png"),target);
  const app=express();registerLookbookStorageRoutes(app,reopened);const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/uploads/local.png`);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),f.buffer);
  assert.equal(await removeOriginalLookImage("/outputs/history.png",uploads),false);assert.equal(await removeOriginalLookImage("/uploads/../secret.png",uploads),false);assert.equal(await removeOriginalLookImage(target,uploads),false);
  const next=draft();next.examples=[{localUrl:"/uploads/new.png",fileName:"new.png"}];await writeFile(path.join(uploads,"new.png"),f.buffer);
  const added=await store.add(next);await assert.rejects(stat(path.join(uploads,"new.png")),error=>error.code==="ENOENT");assert.equal(await store.assetAlias("/uploads/new.png"),added.examples[0].localUrl);assert.equal((await store.state()).localCount,0);
});

test("Deleting a shared Look hides it for all clients while preserving images for existing workflows, including fresh clients",async t=>{
  const f=await fixture(t);await f.one.configure({directory:f.shared});await f.two.configure({directory:f.shared});const source=draft(),saved=await f.one.add(source);
  await assert.rejects(f.one.remove(source.id,{directory:"different-folder"}),error=>error.status===409);assert.equal((await f.one.read()).length,1);
  assert.equal((await f.one.remove(source.id)).removed,true);assert.equal((await f.two.read()).length,0);assert.equal(await f.two.get(source.id),undefined);
  const filename=await f.two.ensureAsset(saved.examples[0].localUrl);assert.deepEqual(await readFile(filename),f.buffer);assert.ok(await stat(path.join(f.shared,"looks",source.id,"look.json")));assert.ok(await stat(path.join(f.shared,"looks",source.id,"deleted.json")));
  assert.equal((await f.two.remove(source.id)).removed,false);await assert.rejects(f.one.add(source),error=>error.status===409);await assert.rejects(f.one.remove("styleref-online"),/Only user-created/);
});
