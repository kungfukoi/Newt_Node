import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {createStyleFinderCatalog,parseStyleFinderPage} from "../server/stylefinder-catalog.js";
import {registerStyleFinderRoutes} from "../server/stylefinder-catalog.js";
import express from "express";
import sharp from "sharp";

const jpeg = await sharp({create:{width:2,height:2,channels:3,background:"#456789"}}).jpeg().toBuffer();

const card=(id="ink")=>`<div class="ml-style" data-tile="${id}"><a class="ml-style-category">Techniques</a><div class="ml-style-name">Ink drawing</div><img class="ml-style-preview" src="img/ink-thumb.jpg?width=480"></div>`;
const detail=`<h1 class="sp-name">Ink drawing<span class="sp-badges">Tested!</span></h1><a class="sp-kind">Techniques</a><div class="sp-prompt">Ink drawing --v 8.2</div><section id="sp-observations"><p class="sp-prose">Dark ink, fine lines and warm paper.</p></section><a class="sp-term"><span>Fine lines</span><span>500</span></a><img class="sp-render" src="../img/ink.jpg?width=640"><img class="sp-render" src="../img/not-downloaded.jpg">`;
test("StyleFinder reads local cards and details without executing source scripts",()=>{
  const records=parseStyleFinderPage(card()+`<script>throw new Error('never execute')</script>`,"library.html");
  assert.equal(records[0].name,"Ink drawing");assert.equal(records[0].examples[0].relativePath,"img/ink-thumb.jpg");
  const style=parseStyleFinderPage(detail,"library/ink.html")[0];
  assert.equal(style.name,"Ink drawing");assert.equal(style.prompt,"Dark ink, fine lines and warm paper.");assert.deepEqual(style.tags,["Fine lines"]);
});

test("Detail parser reads only source Colours and Similar styles, rejecting unsafe colour CSS",()=>{
  const source=detail+`<a class="sp-colour" style="--c:#23502a"><span class="sp-swatch"></span><span>dark green</span><span class="sp-count">17%</span></a><a class="sp-colour" style="--c:url(javascript:bad)"><span>unsafe</span></a><section class="sp-similar">${card("related-ink").replace('src="img/','src="../img/')}</section>`;
  const style=parseStyleFinderPage(source,"library/ink.html")[0];
  assert.deepEqual(style.colours,[{name:"dark green",hex:"#23502a",percent:17}]);
  assert.equal(style.similarStyles[0].id,"related-ink");assert.equal(style.similarStyles[0].examples[0].relativePath,"img/ink-thumb.jpg");
});
test("A legacy source detail uses its complete grid once when it has no individual renders",()=>{
  const grid='<img class="sp-vq-pic" src="../img/ink-grid.jpg?width=1280">';
  const [style]=parseStyleFinderPage(`<h1 class="sp-name">Ink</h1>${grid.repeat(4)}`,"library/ink.html");
  assert.deepEqual(style.examples.map(image=>image.relativePath),["img/ink-grid.jpg"]);
});

test("Detail routes resolve source similar previews and partial related looks without bloating search",async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"newt-related-details-"));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,"library"));await mkdir(path.join(root,"img"));
  await writeFile(path.join(root,"library.html"),card());
  await writeFile(path.join(root,"library","ink.html"),detail+`<section class="sp-similar">${card("related-ink").replace('src="img/','src="../img/')}</section>`);
  await writeFile(path.join(root,"img","ink-thumb.jpg"),jpeg);
  const catalog=createStyleFinderCatalog({root});
  assert.equal((await catalog.search()).styles[0].similarStyles,undefined);
  const related=(await catalog.detail("ink")).style.similarStyles[0];
  assert.equal(related.id,"related-ink");assert.equal(related.examples.length,1);assert.equal(related.examples[0].relativePath,undefined);
  assert.equal((await catalog.detail("related-ink")).style.name,"Ink drawing");
});
test("RSC metadata is parsed as JSON and unsafe remote/traversal images are rejected",()=>{
  const record={slug:"ink",name:"Ink",prompt:"--sref 123 --v 8.2",category:"SREF codes"};
  const stream='1:'+JSON.stringify({styles:[record]})+'\n';
  const html=card()+`<script>self.__next_f.push(${JSON.stringify([1,stream])})</script>`;
  assert.equal(parseStyleFinderPage(html,"library.html")[0].sref,"--sref 123");
  assert.equal(parseStyleFinderPage(card().replace("img/ink-thumb.jpg?width=480","../secret.jpg"),"library.html")[0].examples.length,0);
});
test("The catalog follows the mirror's unfiltered paging links through filename collisions",async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"newt-stylefinder-pages-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(path.join(root,"library.html"),card()+`<a href="librarya123-2.html?page=2" aria-label="Next page">Next</a>`);
  await writeFile(path.join(root,"librarya123-2.html"),card("wash"));
  await writeFile(path.join(root,"librarya123.html"),card("filtered"));
  const {styles}=await createStyleFinderCatalog({root}).snapshot();
  assert.deepEqual(styles.map(style=>style.id),["ink","wash"]);
});
test("Catalog searches details, handles arriving/pruned files, and confines images",async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"newt-stylefinder-test-"));
  try{
    const root=path.join(directory,"midlibrary.io");await mkdir(path.join(root,"img"),{recursive:true});await mkdir(path.join(root,"library"));
    await writeFile(path.join(root,"library.html"),card());await writeFile(path.join(root,"library","ink.html"),detail);await writeFile(path.join(root,"img","ink.jpg"),jpeg);await writeFile(path.join(directory,"hts-in_progress.lock"),"");
    const catalog=createStyleFinderCatalog({root:directory});const value=await catalog.search({q:"warm paper",category:"Techniques"});assert.equal(value.total,1);assert.equal(value.styles[0].examples.length,1);assert.equal(value.populating,true);
    assert.equal((await catalog.detail("ink")).style.name,"Ink drawing");
    await assert.rejects(catalog.asset("../private.jpg"));await assert.rejects(catalog.asset("img/../private.jpg"));await assert.rejects(catalog.asset("img/file.svg"));
    await writeFile(path.join(root,"librarya123.html"),card("new-style"));assert.equal((await catalog.search({refresh:true})).indexed,2);
    await rm(path.join(root,"librarya123.html"));assert.equal((await catalog.search({refresh:true})).indexed,1);
    const missing=createStyleFinderCatalog({root:path.join(directory,"missing")});assert.equal((await missing.search()).ready,false);
    const app=express();registerStyleFinderRoutes(app,{root:directory});
    const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
    try {
      const base=`http://127.0.0.1:${server.address().port}`;
      const result=await (await fetch(base+"/api/style-library/catalog?q=warm")).json();assert.equal(result.styles[0].name,"Ink drawing");
      const image=await fetch(base+result.styles[0].examples[0].url);assert.equal(image.status,200);assert.match(image.headers.get("content-type"),/image\/jpeg/);assert.deepEqual(Buffer.from(await image.arrayBuffer()),jpeg);
      assert.equal((await fetch(base+"/api/style-library/catalog-image?file=..%2Fsecret.jpg")).status,400);
      assert.equal((await (await fetch(base+"/api/style-library/catalog/ink")).json()).style.name,"Ink drawing");
    } finally {await new Promise(resolve=>server.close(resolve));}
  }finally{await rm(directory,{recursive:true,force:true});}
});
