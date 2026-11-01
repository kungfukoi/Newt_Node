import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createStyleRefCatalog, registerStyleRefCatalogRoutes, styleRefImageUrl, normalizeStyleRefCard } from "../server/styleref-catalog.js";
import { normalizeLibraryStyle, libraryStyleSnapshot } from "../src/styleLibrary.js";
const host="https://piteahvrjstrlirkpoid.supabase.co/storage/v1/object/public/images/public/";
const prompt="Apply translucent watercolor washes, fine broken ink contours, warm paper grain, muted ochre and sage accents, soft light and gently feathered edges.";
const card=(index)=>({slug:`style-${index}`,name:`Watercolor ${index}`,category:index%2?"Illustration":"Fine art",author:"@artist",tags:["paper","watercolor"],palette:["#f4f0e6","#55524e"],heroImage:`${host}example-${index}_thumb.webp`});
function fixture(options={}) {
  const calls=[],cards=Array.from({length:30},(_,index)=>card(index));
  const fetchImpl=async(value,init)=>{
    calls.push({url:String(value),init});const url=new URL(value);
    if(url.origin!=="https://styleref.io")return new Response(Buffer.from("image"),{headers:{"Content-Type":"image/webp"}});
    if(url.pathname.endsWith("/styles")){
      const category=url.searchParams.get("category"),query=url.searchParams.get("query"),offset=Number(url.searchParams.get("offset"));
      const matched=cards.filter(card=>(!category||card.category===category)&&(!query||card.name.toLowerCase().includes(query.toLowerCase())));
      return Response.json({styles:matched.slice(offset,offset+25),hasMore:offset+25<matched.length,nextOffset:offset+25});
    }
    if(url.searchParams.get("format")==="json")return Response.json({name:"Watercolor 0",description:"Warm ink and wash",sections:{colors:{}},referenceImages:[{url:`${host}example-0.webp`,kind:"source"},{url:`${host}example-1.webp`,kind:"sample"}]});
    return new Response(`[YOUR SUBJECT/SCENE PROMPT HERE].\n\n${prompt}`,{headers:{"Content-Type":"text/markdown"}});
  };
  return {calls,fetchImpl,catalog:createStyleRefCatalog({fetchImpl,...options})};
}
test("StyleRef forwards search/category, coalesces and caches paginated reads, and merges created looks",async()=>{
  const f=fixture({createdStore:{read:async()=>[{id:"look-local",name:"Watercolor local",category:"Various",tags:[],prompt:"warm paper",examples:[{localUrl:"/uploads/a.png"}]}]}});
  const [first,second]=await Promise.all([f.catalog.search({limit:10}),f.catalog.search({limit:10})]);
  assert.equal(first.source,"styleref");assert.equal(first.remoteCount,30);assert.equal(first.total,31);assert.equal(first.styles.length,10);assert.equal(first.styles[0].id,"look-local");
  assert.deepEqual(first,second);assert.equal(f.calls.length,2);
  const filtered=await f.catalog.search({q:"Watercolor 2",category:"Illustration"});assert.equal(filtered.styles.every(style=>style.category==="Illustration"),true);
  assert.ok(f.calls.some(call=>new URL(call.url).searchParams.get("query")==="Watercolor 2"));
  await f.catalog.search({refresh:true});assert.equal(f.calls.filter(call=>new URL(call.url).searchParams.get("offset")==="0").length,3);
});

test("Real Moments is excluded before catalog counts and pagination, while saved detail access remains available",async()=>{
  const slug="9a2adtz6-cd8d77ee2f51",hidden={...card(0),slug,name:"Real Moments"};
  const catalog=createStyleRefCatalog({fetchImpl:async value=>{
    const url=new URL(value);
    if(url.pathname.endsWith("/styles"))return Response.json({styles:url.searchParams.get("query")?[hidden]:[hidden,card(1)],hasMore:false});
    if(url.searchParams.get("format")==="json")return Response.json({name:hidden.name,sections:{},referenceImages:[]});
    return new Response(prompt,{headers:{"Content-Type":"text/markdown"}});
  }});
  const result=await catalog.search({limit:1});
  assert.equal(result.total,1);assert.equal(result.remoteCount,1);assert.equal(result.indexed,1);
  assert.equal(result.styles[0].name,"Watercolor 1");
  assert.equal((await catalog.search({q:"Real Moments"})).total,0);
  assert.equal((await catalog.search({category:hidden.category})).styles.some(style=>style.id===`styleref-${slug}`),false);
  assert.equal((await catalog.detail(`styleref-${slug}`)).style.name,hidden.name);
});
test("StyleRef details retain provenance, complete references and visual-only source specification; saved snapshots stay managed",async()=>{
  const f=fixture(),detail=await f.catalog.detail("styleref-style-0");
  assert.equal(detail.style.prompt,prompt);assert.equal(detail.style.examples.length,2);assert.equal(detail.style.colours[0].hex,"#f4f0e6");
  assert.equal(detail.style.sourceAuthor,"@artist");assert.equal(detail.style.sourceUrl,"https://styleref.io/share/style-0");
  assert.ok(f.calls.some(call=>call.url.includes("format=flux&compact=1&raw=1")));
  assert.equal(detail.style.styleAnalysis,undefined); // Existing explicit Astra first-use flow remains authoritative.
  const saved=normalizeLibraryStyle({...detail.style,examples:[{localUrl:"/uploads/example.webp"}]});
  assert.equal(saved.sourceProvider,"StyleRef");assert.equal(saved.sourceAuthor,"@artist");assert.equal(saved.catalogId,"styleref-style-0");
  assert.equal(libraryStyleSnapshot(saved).sourceUrl,detail.style.sourceUrl);assert.equal(libraryStyleSnapshot(saved).gradeReference.localUrl,"/uploads/example.webp");
  await assert.rejects(f.catalog.detail("blade-runner"),error=>error.status===404);
});
test("StyleRef image proxy rejects arbitrary hosts, traversal, signed queries and non-raster bodies",async()=>{
  const f=fixture();
  for(const url of ["http://127.0.0.1/private",host+"../private.webp",host+"a.svg",host+"a.webp?token=secret","https://example.com/a.webp",host+"a.webp#fragment"]){assert.equal(styleRefImageUrl(url),"");await assert.rejects(f.catalog.asset(url));}
  assert.equal(f.calls.length,0);assert.equal((await f.catalog.asset(host+"example.webp")).type,"image/webp");
  const bad=createStyleRefCatalog({fetchImpl:async()=>new Response("<html>",{headers:{"Content-Type":"text/html"}})});
  await assert.rejects(bad.asset(host+"example.webp"),/supported image/);
});

test("Shared custom looks remain browsable during an online outage and unavailable shared storage is reported beside online looks",async()=>{
  const local={id:"look-test",name:"Shared ink",category:"Illustration",tags:[],prompt:"Warm paper",examples:[]};
  const offline=createStyleRefCatalog({createdStore:{read:async()=>[local],get:async()=>local},fetchImpl:async()=>{throw Error("offline");}});
  const result=await offline.search();assert.equal(result.styles[0].name,"Shared ink");assert.match(result.warning,/Online catalog unavailable/);assert.equal((await offline.detail(local.id)).style,local);
  const f=fixture({createdStore:{read:async()=>{throw Error("Shared folder unavailable");}}});
  const online=await f.catalog.search();assert.equal(online.remoteCount,30);assert.equal(online.localCount,0);assert.match(online.warning,/Shared folder unavailable/);
});
test("429 sets a retry window without retrying or silently using the legacy catalog",async()=>{
  let calls=0;const catalog=createStyleRefCatalog({fetchImpl:async()=>{calls++;return new Response("limited",{status:429,headers:{"Retry-After":"60"}});},legacyCatalog:{search:()=>{throw Error("must not fall back");}}});
  await assert.rejects(catalog.search(),error=>error.status===429&&error.retryAfter==="60");
  await assert.rejects(catalog.search(),error=>error.status===429);assert.equal(calls,1);
});
test("StyleRef routes use the online source and serve bounded raster images",async t=>{
  const f=fixture(),app=express();registerStyleRefCatalogRoutes(app,{fetchImpl:f.fetchImpl});
  const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(base+"/api/style-library/catalog");const data=await response.json();assert.equal(data.source,"styleref");
  const image=await fetch(base+data.styles[0].examples[0].url);assert.equal(image.headers.get("content-type"),"image/webp");assert.equal(image.headers.get("x-content-type-options"),"nosniff");
  assert.equal((await fetch(base+"/api/style-library/styleref-image?url=http://127.0.0.1/private")).status,400);
  assert.equal(normalizeStyleRefCard({slug:"../../private",name:"bad"}),null);
});
