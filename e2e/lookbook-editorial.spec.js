import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Lookbook matches the shared header and browses all three local editorial sections beneath style actions", async ({page}) => {
  const {errors,requests}=await openFixture(page,{count:1});
  await page.route("**/api/style-library",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({version:1,revision:0,collections:[]})}));
  await page.route("**/api/style-library/catalog?**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({ready:true,styles:[],total:0,indexed:0,categories:[]})}));
  const sections=[{id:"guides",title:"Guides",description:"Creative techniques",count:2,items:[{id:"midguide/ink.html",title:"Ink techniques",summary:"A practical guide",available:true,cover:{url:"/outputs/e2e/cover.png",alt:"Ink"}},{id:"midguide/other.html",title:"Color guide",summary:"Color",available:true}]},{id:"compilations",title:"Compilations",count:1,items:[{id:"tops/ink.html",title:"Ten ink looks",available:true}]},{id:"in-focus",title:"In Focus",count:1,items:[{id:"focus/ink.html",title:"Ink in focus",available:true}]}];
  await page.route("**/api/style-library/editorial?**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({ready:true,sections})}));
  let failArticle=false,articleRequests=0;
  await page.route("**/api/style-library/editorial/article?**",route=>{
    articleRequests++;
    if(failArticle)return route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({error:"This article has not downloaded yet."})});
    const file=new URL(route.request().url()).searchParams.get("file");
    return route.fulfill({contentType:"application/json",body:JSON.stringify({id:file,title:file.startsWith("tops")?"Ten ink looks":file.startsWith("focus")?"Ink in focus":"Ink techniques",author:"Catalog author",lead:"A local article.",cover:{url:"/outputs/e2e/cover.png",alt:"Guide cover"},blocks:[{type:"heading",text:"Explore Ink",link:{type:"look",id:"ink"}},{type:"paragraph",runs:[{text:"Try this treatment."}]},{type:"gallery",images:[{url:"/outputs/e2e/example.png",alt:"Ink example",caption:"An ink drawing --sref 123"}]}]})});
  });
  await page.route("**/api/style-library/catalog/ink",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({style:{id:"ink",name:"Ink look",prompt:"Fine ink",examples:[{localUrl:"/outputs/e2e/example.png"}]}})}));
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  const header=page.locator(".lookbook-hero");
  await expect(header).toHaveClass(/stats-hero/);await expect(header.getByRole("heading",{name:"Lookbook",exact:true})).toBeVisible();
  await expect(header).toHaveCSS("text-align","left");await expect(header).toHaveCSS("border-radius","14px");
  await expect(page.getByRole("button",{name:"Browse Guides",exact:true})).toContainText("2 articles");
  const selection=await page.getByLabel("Style previews",{exact:true}).boundingBox(),tile=await page.getByRole("button",{name:"Browse Guides",exact:true}).boundingBox();
  expect(tile.y).toBeGreaterThan(selection.y+selection.height);
  await page.screenshot({path:test.info().outputPath("lookbook-editorial-tiles.png"),fullPage:true});
  for(const title of ["Compilations","In Focus","Guides"]){await page.getByRole("button",{name:`Browse ${title}`,exact:true}).click();await expect(page.getByLabel(`${title} articles`,{exact:true})).toBeVisible();}
  await page.getByLabel("Search Guides",{exact:true}).fill("ink");await expect(page.locator(".editorial-article-card")).toHaveCount(1);
  await page.getByRole("button",{name:"Clear article search",exact:true}).click();await expect(page.locator(".editorial-article-card")).toHaveCount(2);
  await page.getByRole("button",{name:/Ink techniques A practical guide/}).click();
  const reader=page.getByRole("dialog",{name:"Catalog article",exact:true});
  await expect(reader.getByRole("heading",{name:"Ink techniques",exact:true})).toBeVisible();
  await reader.getByRole("button",{name:"Enlarge Ink example",exact:true}).click();
  const preview=page.getByRole("dialog",{name:"Article image preview",exact:true});await expect(preview.locator("img")).toHaveCSS("object-fit","contain");
  await preview.press("Escape");await expect(reader).toBeVisible();
  await reader.getByRole("button",{name:"Explore Ink",exact:true}).click();
  const style=page.getByRole("dialog",{name:"Style details",exact:true});await expect(style.getByRole("heading",{name:"Ink look",exact:true})).toBeVisible();
  await style.getByRole("button",{name:"Close style details",exact:true}).click();await expect(reader).toBeVisible();
  await reader.getByRole("button",{name:"Close article",exact:true}).click();
  failArticle=true;await page.getByRole("button",{name:/Ink techniques A practical guide/}).click();await expect(reader.getByRole("alert")).toContainText("not downloaded yet");
  failArticle=false;await reader.getByRole("button",{name:"Retry article",exact:true}).click();await expect(reader.getByRole("heading",{name:"Ink techniques",exact:true})).toBeVisible();
  await page.screenshot({path:test.info().outputPath("lookbook-local-reader.png"),fullPage:true});
  expect(articleRequests).toBe(3);expect(requests.some(item=>item.path==="/api/style-library/analyze")).toBe(false);expect(errors).toEqual([]);
});

test("Editorial tiles retain useful empty and unavailable states while source files arrive",async({page})=>{
  await openFixture(page,{count:1});
  await page.route("**/api/style-library",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({version:1,revision:0,collections:[]})}));
  await page.route("**/api/style-library/catalog?**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({ready:false,styles:[],total:0,indexed:0,categories:[]})}));
  let unavailable=true;
  await page.route("**/api/style-library/editorial?**",route=>route.fulfill({status:unavailable?503:200,contentType:"application/json",body:JSON.stringify(unavailable?{error:"Catalog download is unavailable."}:{ready:false,sections:[{id:"guides",title:"Guides",count:0,items:[]},{id:"compilations",title:"Compilations",count:0,items:[]},{id:"in-focus",title:"In Focus",count:0,items:[]}]})}));
  await page.getByRole("button",{name:"Looks",exact:true}).click();await expect(page.getByRole("button",{name:"Browse In Focus",exact:true})).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("download is unavailable");unavailable=false;await page.getByRole("button",{name:"Retry articles",exact:true}).click();
  await page.getByRole("button",{name:"Browse Guides",exact:true}).click();await expect(page.getByLabel("Guides articles",{exact:true})).toContainText("finishes downloading");
});
