import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp,mkdir,writeFile,readFile,readdir,rm,rename } from "node:fs/promises";
import express from "express";
import { indexStyleFinder } from "../scripts/indexStyleFinder.mjs";
import { createStyleFinderAudition,registerStyleFinderAuditionRoutes } from "../server/stylefinder-audition.js";

async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"newt-stylefinder-audition-"));t.after(()=>rm(root,{recursive:true,force:true}));
  const source=path.join(root,"mirror"),directory=path.join(root,"data");await mkdir(path.join(source,"img"),{recursive:true});await mkdir(path.join(source,"library"));
  const card=id=>`<div class="ml-style" data-tile="${id}"><a class="ml-style-category">Techniques</a><div class="ml-style-name">${id}</div><img class="ml-style-preview" src="img/ink.jpg"></div>`;
  await writeFile(path.join(source,"library.html"),card("ink")+card("wash"));
  await writeFile(path.join(source,"img/ink.jpg"),"local-image");
  await writeFile(path.join(source,"library/ink.html"),'<h1 class="sp-name">Ink</h1><a class="sp-kind">Techniques</a><section id="sp-observations"><p class="sp-prose">Fine ink on warm paper.</p></section><img class="sp-render" src="../img/ink.jpg">');
  await indexStyleFinder(source,directory);
  return {source,directory,catalog:createStyleFinderAudition({directory})};
}
test("StyleFinder audition reads a local index, keeps identities distinct and materializable image routes, and preserves source files",async t=>{
  const f=await fixture(t),files=await readdir(f.source),page=await f.catalog.search({limit:1});
  assert.equal(page.source,"stylefinder");assert.equal(page.total,2);assert.equal(page.styles[0].id,"stylefinder-ink");assert.equal(page.styles[0].catalogId,"stylefinder-ink");
  assert.equal(page.styles[0].sourceProvider,"Midlibrary");assert.match(page.styles[0].examples[0].url,/stylefinder-image/);
  assert.equal((await f.catalog.search({q:"warm paper",category:"Techniques"})).total,1);
  assert.equal((await f.catalog.search({offset:1,limit:1})).styles[0].id,"stylefinder-wash");
  assert.equal((await f.catalog.detail("stylefinder-ink")).style.prompt,"Fine ink on warm paper.");
  assert.equal(await readFile(await f.catalog.asset("img/ink.jpg"),"utf8"),"local-image");
  await assert.rejects(f.catalog.detail("ink"),e=>e.status===400);await assert.rejects(f.catalog.asset("../private.jpg"),e=>e.status===400);
  await indexStyleFinder(f.source,f.directory);assert.deepEqual(await readdir(f.source),files);
  await rename(f.source,`${f.source}-moved`);await assert.rejects(f.catalog.search(),/source folder is unavailable/);
});
test("StyleFinder audition routes handle missing indexes, detail and confined local images without replacing the online catalog",async t=>{
  const f=await fixture(t),app=express();registerStyleFinderAuditionRoutes(app,{directory:f.directory});
  const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await fetch(base+"/api/style-library/stylefinder")).json()).total,2);
  assert.equal((await (await fetch(base+"/api/style-library/stylefinder/stylefinder-ink")).json()).style.name,"Ink");
  assert.equal(await (await fetch(base+"/api/style-library/stylefinder-image?file=img%2Fink.jpg")).text(),"local-image");
  assert.equal((await fetch(base+"/api/style-library/stylefinder-image?file=..%2Fsecret.jpg")).status,400);
  assert.equal((await fetch(base+"/api/style-library/catalog")).status,404);
  await rm(path.join(f.directory,"stylefinder-audition.json"));assert.equal((await fetch(base+"/api/style-library/stylefinder")).status,503);
});
