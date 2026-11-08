import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp,mkdir,writeFile,readFile,readdir,rm,rename } from "node:fs/promises";
import express from "express";
import sharp from "sharp";
import { indexStyleFinder } from "../scripts/indexStyleFinder.mjs";
import { packStyleFinder } from "../scripts/packStyleFinder.mjs";
import { createStyleFinderAudition,registerStyleFinderAuditionRoutes,registerStyleFinderCuratedImages } from "../server/stylefinder-audition.js";
import { compactStyleFinderSetting } from "../server/stylefinder-compact.js";

const jpeg = await sharp({create:{width:2,height:2,channels:3,background:"#987654"}}).jpeg().toBuffer();

const localOverride = (prompt = "Warm tungsten light, restrained colour and layered architectural framing.") => ({
  version: 1, styles: { ink: { prompt, notes: "Locally selected film stills; source credits retained.", tags: ["Cinematic"],
    examples: Array.from({length:4},(_,index)=>({id:`curated-${index}`,localUrl:`/uploads/stylefinder-overrides/ink/still-${index}.jpg`,fileName:`still-${index}.jpg`,mimeType:"image/jpeg"})) } }
});

async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),"newt-stylefinder-audition-"));t.after(()=>rm(root,{recursive:true,force:true}));
  const source=path.join(root,"mirror"),directory=path.join(root,"server","data");await mkdir(path.join(source,"img"),{recursive:true});await mkdir(path.join(source,"library"));
  const card=id=>`<div class="ml-style" data-tile="${id}"><a class="ml-style-category">Techniques</a><div class="ml-style-name">${id}</div><img class="ml-style-preview" src="img/ink.jpg" srcset="img/card.html?crop=1024,1024&width=320 320w, img/missing.jpg 480w"></div>`;
  await writeFile(path.join(source,"library.html"),card("ink")+card("wash"));
  await writeFile(path.join(source,"img/ink.jpg"),"<html>Bad Gateway</html>");
  await writeFile(path.join(source,"img/card.html"),jpeg);
  await writeFile(path.join(source,"img/first.jpg"),jpeg);
  await writeFile(path.join(source,"img/second.html"),jpeg);
  await writeFile(path.join(source,"library/ink.html"),'<h1 class="sp-name">Ink</h1><a class="sp-kind">Techniques</a><section id="sp-observations"><p class="sp-prose">Fine ink on warm paper.</p></section><img class="sp-render" src="../img/first.html"><img class="sp-render" src="/img/second.html"><img class="sp-render" src="../img/ink.jpg">');
  await indexStyleFinder(source,directory);
  return {root,source,directory,catalog:createStyleFinderAudition({directory})};
}
test("Compact StyleFinder serves curated URLs after moving with the source offline", async t => {
  const f = await fixture(t);
  const override = localOverride();
  await writeFile(path.join(f.directory, "stylefinder-overrides.json"), JSON.stringify(override));
  const curated = override.styles.ink.examples;
  await mkdir(path.dirname(path.join(f.root, curated[0].localUrl.slice(1))), { recursive: true });
  for (const image of curated) await writeFile(path.join(f.root, image.localUrl.slice(1)), jpeg);
  const query = { q: "tungsten", category: "Techniques" };
  const originalList = await f.catalog.search(query);
  const { similarStyles: _removed, ...originalWash } = (await f.catalog.detail("stylefinder-wash")).style;
  const output = path.join(f.root, "compact");
  const stats = await packStyleFinder(f.root, output, { expectedCount: 2 });
  assert.equal(stats.imagePaths, 5);
  assert.equal(stats.imageFiles, 1);
  const listing = path.join(f.source, "library.html");
  await writeFile(listing, (await readFile(listing, "utf8")) + '<div class="ml-style" data-tile="new"><div class="ml-style-name">New</div><img class="ml-style-preview" src="img/card.html"></div>');
  await writeFile(path.join(f.directory, "stylefinder-overrides.json"), JSON.stringify(localOverride("New cinematic description")));
  const updated = path.join(f.root, "updated");
  const update = await packStyleFinder(f.root, updated, { expectedCount: 3, previousFolder: output, refresh: true });
  assert.equal(update.addedStyles, 1);
  assert.equal(update.updatedStyles, 1);
  assert.equal(update.imageFiles, 1);
  assert.equal(JSON.parse(await readFile(path.join(output, "catalog.json"), "utf8")).styles.length, 2);
  await rename(f.source, path.join(f.root, "unavailable-mirror"));
  await rename(path.join(f.root, "uploads"), path.join(f.root, "unavailable-uploads"));
  const moved = path.join(f.root, "moved");
  await rename(output, moved);
  const setting = path.join(f.directory, compactStyleFinderSetting);
  await writeFile(setting, JSON.stringify({ directory: moved }));
  assert.deepEqual(await f.catalog.search(query), originalList);
  assert.deepEqual((await f.catalog.detail("stylefinder-wash")).style, originalWash);
  const app = express();
  registerStyleFinderCuratedImages(app, f.catalog);
  registerStyleFinderAuditionRoutes(app, { directory: f.directory }, f.catalog);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const url of [curated[0].localUrl, originalWash.previewUrl]) {
    const image = await fetch(base + url);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/jpeg");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), jpeg);
  }
  await writeFile(setting, JSON.stringify({ directory: updated }));
  assert.equal((await f.catalog.search()).total, 3);
  assert.equal((await f.catalog.detail("stylefinder-ink")).style.prompt, "New cinematic description");
  await writeFile(setting, JSON.stringify({ directory: output }));
  await assert.rejects(f.catalog.search(), /compact StyleFinder catalog is unavailable/);
});
test("StyleFinder audition reads a local index, keeps identities distinct and materializable image routes, and preserves source files",async t=>{
  const f=await fixture(t),files=await readdir(f.source),page=await f.catalog.search({limit:1});
  assert.equal(page.source,"stylefinder");assert.equal(page.sourceLabel,"StyleFinder");assert.equal(page.total,2);assert.equal(page.styles[0].id,"stylefinder-ink");assert.equal(page.styles[0].catalogId,"stylefinder-ink");
  assert.equal(page.styles[0].sourceProvider,"Midlibrary");assert.match(page.styles[0].examples[0].url,/stylefinder-image/);
  assert.equal(page.styles[0].previewUrl,page.styles[0].examples[0].url);
  assert.equal((await f.catalog.search({q:"warm paper",category:"Techniques"})).total,1);
  const [wash]=(await f.catalog.search({offset:1,limit:1})).styles;
  assert.equal(wash.id,"stylefinder-wash");
  assert.match(wash.previewUrl,/file=img%2Fcard\.html$/);
  const {style}=await f.catalog.detail("stylefinder-ink");
  assert.equal(style.prompt,"Fine ink on warm paper.");
  assert.deepEqual(style.examples.map(image=>image.fileName),["first.jpg","second.jpg"]);
  assert.deepEqual(await readFile((await f.catalog.asset("img/second.html")).filename),jpeg);
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
  const image=await fetch(base+"/api/style-library/stylefinder-image?file=img%2Fsecond.html");
  assert.equal(image.status,200);
  assert.equal(image.headers.get("content-type"),"image/jpeg");
  assert.equal(image.headers.get("x-content-type-options"),"nosniff");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),jpeg);
  assert.equal((await fetch(base+"/api/style-library/stylefinder-image?file=img%2Fink.jpg")).status,404);
  assert.equal((await fetch(base+"/api/style-library/stylefinder-image?file=..%2Fsecret.jpg")).status,400);
  assert.equal((await fetch(base+"/api/style-library/catalog")).status,404);
  await rm(path.join(f.directory,"stylefinder-audition.json"));assert.equal((await fetch(base+"/api/style-library/stylefinder")).status,503);
});

test("Local curation replaces listing and detail together, survives reindexing and reloads without changing the mirror",async t=>{
  const f=await fixture(t),filename=path.join(f.directory,"stylefinder-overrides.json"),before=await readFile(path.join(f.source,"library/ink.html"));
  const original=await f.catalog.detail("stylefinder-ink");
  await writeFile(filename,JSON.stringify(localOverride()));
  const page=await f.catalog.search({q:"tungsten"}),listed=page.styles[0],detail=(await f.catalog.detail("stylefinder-ink")).style;
  assert.equal(page.total,1);assert.equal(listed.id,original.style.id);assert.equal(listed.name,original.style.name);
  assert.equal(listed.prompt,detail.prompt);assert.deepEqual(listed.examples,detail.examples);assert.equal(listed.examples.length,4);
  assert.equal(listed.previewUrl,listed.examples[0].localUrl);assert.equal(listed.sourceProvider,"Newt");
  assert.equal(listed.styleAnalysis,null);assert.equal(listed.sref,"");assert.equal(listed.midjourneyPrompt,"");
  assert.equal(listed.fallbackExamples,undefined);assert.equal(listed.similarStyles,undefined);
  assert.equal((await f.catalog.detail("stylefinder-wash")).style.sourceProvider,"Midlibrary");
  await indexStyleFinder(f.source,f.directory);
  assert.equal((await f.catalog.detail("stylefinder-ink")).style.prompt,detail.prompt);
  const replacement=localOverride("Monochrome architectural silhouettes against a luminous evening sky.");
  await writeFile(filename,JSON.stringify(replacement));
  assert.equal((await f.catalog.search({q:"monochrome"})).styles[0].prompt,replacement.styles.ink.prompt);
  assert.deepEqual(await readFile(path.join(f.source,"library/ink.html")),before);
  await rm(filename);
  assert.equal((await f.catalog.detail("stylefinder-ink")).style.prompt,original.style.prompt);
});

test("Curated tags remain searchable without expanding the original Filter categories",async t=>{
  const f=await fixture(t),filename=path.join(f.directory,"stylefinder-overrides.json");
  const original=await f.catalog.search(),override=localOverride();
  override.styles.wash={...override.styles.ink,tags:["Cinematic","High contrast"]};
  await writeFile(filename,JSON.stringify(override));
  const filtered=await f.catalog.search({q:"CINEMATIC",category:"Techniques",limit:1});
  assert.deepEqual(filtered.categories,original.categories);
  assert.deepEqual(filtered.categories,["Techniques"]);
  assert.equal(filtered.total,2);assert.equal(filtered.styles.length,1);
  assert.deepEqual(filtered.styles[0].tags,["Cinematic"]);
  const next=await f.catalog.search({q:"cinematic",category:"Techniques",limit:1,offset:1});
  assert.equal(next.styles[0].id,"stylefinder-wash");assert.equal(next.total,2);
  assert.deepEqual(next.categories,original.categories);
  assert.equal((await f.catalog.search({q:"high contrast"})).styles[0].id,"stylefinder-wash");
  assert.equal((await f.catalog.search({q:"no matching tag"})).total,0);
  assert.deepEqual((await f.catalog.search({q:"no matching tag"})).categories,original.categories);
  await indexStyleFinder(f.source,f.directory);
  assert.deepEqual((await f.catalog.search({refresh:true})).categories,original.categories);
  assert.equal((await f.catalog.search({q:"high contrast"})).total,1);
});

test("The Characters filter finds tagged looks and combines with search",async t=>{
  const f=await fixture(t),filename=path.join(f.directory,"stylefinder-audition.json");
  const index=JSON.parse(await readFile(filename,"utf8"));
  index.snapshot.styles.find(style=>style.id==="ink").tags=["Characters","Illustrative"];
  index.snapshot.styles.find(style=>style.id==="wash").prompt="A character in a watercolor wash.";
  await writeFile(filename,JSON.stringify(index));

  assert.equal((await f.catalog.search({q:"character"})).total,2);
  const filtered=await f.catalog.search({category:"Characters"});
  assert.deepEqual(filtered.categories,["Characters","Techniques"]);
  assert.equal(filtered.total,1);
  assert.deepEqual(filtered.styles.map(style=>style.id),["stylefinder-ink"]);
  assert.equal((await f.catalog.search({category:"Characters",q:"warm paper"})).total,1);
  const empty=await f.catalog.search({category:"Characters",q:"wash"});
  assert.equal(empty.total,0);
  assert.deepEqual(empty.categories,filtered.categories);
});

test("Local curation rejects external and escaping assets rather than silently reverting the requested entry",async t=>{
  const f=await fixture(t),filename=path.join(f.directory,"stylefinder-overrides.json");
  for(const localUrl of ["https://example.com/still.jpg","/uploads/stylefinder-overrides/../private.jpg","/uploads/other/still.jpg","/UPLOADS/stylefinder-overrides/still.jpg"]){
    const override=localOverride();override.styles.ink.examples[0].localUrl=localUrl;
    await writeFile(filename,JSON.stringify(override));
    await assert.rejects(f.catalog.search(),error=>error.status===503&&/overrides file is invalid/.test(error.message));
  }
});
