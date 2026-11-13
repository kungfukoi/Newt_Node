import { test,expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { createStyleFinderAudition } from "../server/stylefinder-audition.js";
import { indexStyleFinder } from "../scripts/indexStyleFinder.mjs";
import { mkdtemp,mkdir,writeFile,readFile,rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

test("StyleFinder local audition has independent paging, search, categories, complete previews and row sizing without paid calls",async({page})=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"newt-stylefinder-browser-"));
  try{
    let directory=process.env.NEWT_STYLEFINDER_AUDITION_DATA_DIR;
    if(!directory){
      const source=path.join(root,"mirror");directory=path.join(root,"data");await mkdir(path.join(source,"img"),{recursive:true});await mkdir(path.join(source,"library"));
      const jpeg=await sharp({create:{width:160,height:120,channels:3,background:"#986648"}}).jpeg().toBuffer();await writeFile(path.join(source,"img/ink.html"),jpeg);
      const cards=Array.from({length:60},(_,i)=>`<div class="ml-style" data-tile="ink-${i}"><a class="ml-style-category">${i%2?"Techniques":"Painters"}</a><div class="ml-style-name">Ink ${i}</div><img class="ml-style-preview" src="img/missing.jpg" srcset="img/ink.html?crop=1024,1024 320w"></div>`).join("");await writeFile(path.join(source,"library.html"),cards);
      await writeFile(path.join(source,"library/ink-0.html"),'<h1 class="sp-name">Ink 0</h1><a class="sp-kind">Painters</a><section id="sp-observations"><p class="sp-prose">Fine ink on warm paper.</p></section><img class="sp-render" src="../img/ink.html">');
      await indexStyleFinder(source,directory);
    }
    const catalog=createStyleFinderAudition({directory}),initial=await catalog.search(),first=initial.styles[0];
    const {errors,requests}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
    const json=(route,data,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
    await page.route("**/api/style-library",route=>json(route,{revision:0,collections:[]}));
    await page.route("**/api/style-library/catalog?**",route=>json(route,{ready:true,total:0,styles:[],categories:[]}));
    await page.route("**/api/style-library/stylefinder**",async route=>{
      try{
        const url=new URL(route.request().url());
        if(url.pathname.endsWith("stylefinder-image")){
          const {filename,mimeType}=await catalog.asset(url.searchParams.get("file"));
          return route.fulfill({contentType:mimeType,body:await readFile(filename)});
        }
        const id=url.pathname.split("/")[4];
        return json(route,id?await catalog.detail(id):await catalog.search(Object.fromEntries(url.searchParams)));
      }catch(error){return json(route,{error:error.message},error.status||503);}
    });
    await page.getByRole("button",{name:"Looks",exact:true}).click();
    async function choose(label,name){await page.getByRole("combobox",{name:label,exact:true}).click();await page.getByRole("option",{name,exact:true}).click();}
    const title="StyleFinder";
    await expect(page.getByRole("combobox",{name:"Looks source",exact:true})).toHaveText(title);
    const strip=page.getByLabel("Style previews",{exact:true});await expect(strip.locator(".stylebuilder-tile")).toHaveCount(48);
    await choose("Looks source",title);await expect(strip.locator(".stylebuilder-tile")).toHaveCount(48);
    await expect(strip.locator(".stylebuilder-mosaic").first()).toHaveCSS("width","207.375px");
    await expect.poll(()=>strip.locator("img").first().evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
    await page.screenshot({path:test.info().outputPath("stylefinder-audition.png"),fullPage:true});
    await expect(strip.getByRole("button",{name:"More Styles",exact:true})).toHaveCount(0);
    const firstPreview = await strip.locator(".stylebuilder-tile-open").first().getAttribute("aria-label");
    await strip.evaluate(element=>{element.scrollLeft=element.scrollWidth;});
    await expect(strip.locator(".stylebuilder-tile")).toHaveCount(Math.min(96,initial.total));
    await expect(strip.locator(".stylebuilder-tile-open").first()).toHaveAttribute("aria-label",firstPreview);
    expect(await strip.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0);
    const search=page.getByRole("textbox",{name:"Search looks",exact:true});await search.fill(first.name);await expect(strip.locator(".stylebuilder-tile")).toHaveCount(Math.min(48,(await catalog.search({q:first.name})).total));
    await page.getByRole("button",{name:`View ${first.name}`,exact:true}).click();const details=page.getByRole("dialog",{name:"Style details",exact:true});await expect(details).toBeVisible();await expect(details.getByRole("link",{name:"Midlibrary.io",exact:true})).toHaveCount(0);
    const example=details.getByRole("button",{name:`Enlarge ${first.name} example 1`,exact:true});
    await expect.poll(()=>example.locator("img").evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
    await example.click();
    const preview=page.getByRole("dialog",{name:"Look example preview",exact:true});
    await expect(preview).toBeVisible();
    await expect.poll(()=>preview.locator("img").evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
    await page.keyboard.press("Escape");await page.screenshot({path:test.info().outputPath("stylefinder-details.png"),fullPage:true});await page.keyboard.press("Escape");
    await search.fill("");await choose("Look category",first.category);await expect(strip.locator(".stylebuilder-tile")).toHaveCount(Math.min(48,(await catalog.search({category:first.category})).total));await choose("Look category","All categories");
    const handle=page.getByRole("separator",{name:`Resize ${title} rows`,exact:true});await handle.focus();await handle.press("ArrowDown");await expect(handle).toHaveAttribute("aria-valuenow","2");
    await choose("Looks source","Commercial");await expect(strip.locator(".stylebuilder-tile")).toHaveCount(0);await choose("Looks source",title);await expect(handle).toHaveAttribute("aria-valuenow","2");await expect(strip.locator(".stylebuilder-tile")).toHaveCount(48);
    await search.fill("no-matching-style-for-this-test");await expect(strip).toContainText("No styles match this view.");
    expect(requests.some(request=>request.path==="/api/style-library/analyze")).toBe(false);expect(errors).toEqual([]);
  }finally{await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
});
