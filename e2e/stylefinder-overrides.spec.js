import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { createStyleFinderAudition } from "../server/stylefinder-audition.js";
import { indexStyleFinder } from "../scripts/indexStyleFinder.mjs";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

test("Curated StyleFinder stills and visual prompt agree in the tile, detail and repeated full-frame previews", async ({page}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "newt-stylefinder-curation-"));
  try {
    let directory = process.env.NEWT_STYLEFINDER_OVERRIDES_DATA_DIR, uploadRoot;
    if (!directory) {
      directory = path.join(root, "data"); uploadRoot = path.join(root, "uploads");
      const source = path.join(root, "mirror");
      await mkdir(source, {recursive:true});
      await mkdir(directory, {recursive:true});
      await mkdir(path.join(uploadRoot, "stylefinder-overrides/ink"), {recursive:true});
      await writeFile(path.join(source,"library.html"), '<div class="ml-style" data-tile="ink"><div class="ml-style-name">Curated cinema</div><a class="ml-style-category">Filmmakers</a></div>');
      await indexStyleFinder(source,directory);
      const examples=[];
      for(let i=0;i<4;i++) {
        const fileName=`still-${i}.jpg`,localUrl=`/uploads/stylefinder-overrides/ink/${fileName}`;
        await sharp({create:{width:640,height:280+i*30,channels:3,background:["#987654","#333333","#334466","#756545"][i]}}).jpeg().toFile(path.join(uploadRoot,localUrl.slice(9)));
        examples.push({id:`still-${i}`,localUrl,fileName,mimeType:"image/jpeg"});
      }
      await writeFile(path.join(directory,"stylefinder-overrides.json"), JSON.stringify({version:1,styles:{ink:{prompt:"Compose an intimate cinematic frame with layered architecture, restrained colour and soft natural light.",notes:"Four locally curated stills; sources retained.",tags:["Chiaroscuro","Warm-cool contrast","Characters"],examples}}}));
    } else uploadRoot=path.resolve(directory,"../../uploads");
    const manifest=JSON.parse(await readFile(path.join(directory,"stylefinder-overrides.json"),"utf8"));
    const id=Object.keys(manifest.styles)[0],catalog=createStyleFinderAudition({directory}),style=(await catalog.detail(`stylefinder-${id}`)).style;
    const {errors,requests}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
    const json=(route,data,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
    await page.route("**/api/style-library",route=>json(route,{revision:0,collections:[]}));
    await page.route("**/api/style-library/catalog?**",route=>json(route,{ready:true,total:0,styles:[],categories:[]}));
    await page.route("**/api/style-library/stylefinder**",async route=>{
      try {
        const url=new URL(route.request().url()),target=url.pathname.split("/")[4];
        if(url.pathname.endsWith("stylefinder-image")) {
          const {filename,mimeType}=await catalog.asset(url.searchParams.get("file"));
          return route.fulfill({contentType:mimeType,body:await readFile(filename)});
        }
        return json(route,target?await catalog.detail(target):await catalog.search(Object.fromEntries(url.searchParams)));
      } catch(error) { return json(route,{error:error.message},error.status||503); }
    });
    const files=new Map(Object.values(manifest.styles).flatMap(item=>item.examples).map(image=>[image.localUrl,path.join(uploadRoot,image.localUrl.slice(9))]));
    await page.route("**/uploads/stylefinder-overrides/**",async route=>{
      const file=files.get(new URL(route.request().url()).pathname);
      return file?route.fulfill({contentType:"image/jpeg",body:await readFile(file)}):route.fulfill({status:404});
    });
    await page.getByRole("button",{name:"Looks",exact:true}).click();
    await page.getByRole("combobox",{name:"Looks source",exact:true}).click();
    await page.getByRole("option",{name:"StyleFinder",exact:true}).click();
    const index=JSON.parse(await readFile(path.join(directory,"stylefinder-audition.json"),"utf8"));
    const expectedCategories=new Set(index.snapshot.styles.map(item=>item.category).filter(Boolean));
    if(index.snapshot.styles.some(item=>(manifest.styles[item.id]?.tags??item.tags).includes("Characters")))expectedCategories.add("Characters");
    const filterCategories=[...expectedCategories].sort();
    const filter=page.getByRole("combobox",{name:"Look category",exact:true});
    const options=page.getByRole("listbox",{name:"Look category options",exact:true});
    await expect.poll(async()=>(await catalog.search()).categories).toEqual(filterCategories);
    await expect.poll(()=>page.getByLabel("Style previews",{exact:true}).locator("img").first().evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
    await filter.click();await expect(options.getByRole("option")).toHaveText(["All categories",...filterCategories]);
    await page.screenshot({path:test.info().outputPath("restored-filter-categories.png"),fullPage:true});
    if(expectedCategories.has("Characters")){
      const filtered=page.waitForResponse(response=>new URL(response.url()).searchParams.get("category")==="Characters"&&response.ok());
      await options.getByRole("option",{name:"Characters",exact:true}).click();
      const {styles}=await (await filtered).json();
      expect(styles.length).toBeGreaterThan(0);
      expect(styles.every(item=>item.tags.includes("Characters"))).toBe(true);
      await filter.click();
    }
    await page.keyboard.press("Escape");await expect(options).not.toBeVisible();
    await filter.click();await options.getByRole("option",{name:style.category,exact:true}).click();
    const tag=style.tags.find(value=>!filterCategories.includes(value));expect(tag).toBeTruthy();
    const tagQuery=`${style.name} ${tag}`,tagSearch=page.getByRole("textbox",{name:"Search looks",exact:true});await tagSearch.fill(tagQuery);
    await expect(page.getByLabel("Style previews",{exact:true}).locator(".stylebuilder-tile")).toHaveCount(Math.min(48,(await catalog.search({q:tagQuery,category:style.category})).total));
    await expect(page.getByRole("button",{name:`View ${style.name}`,exact:true})).toBeVisible();
    await filter.click();await expect(options.getByRole("option")).toHaveText(["All categories",...filterCategories]);
    await options.getByRole("option",{name:"All categories",exact:true}).click();
    const search=page.getByRole("textbox",{name:"Search looks",exact:true});await search.fill(style.name);
    const tile=page.getByRole("button",{name:`View ${style.name}`,exact:true});await expect(tile).toBeVisible();
    await expect.poll(()=>tile.locator("img").evaluateAll(images=>images.length===5&&images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
    await tile.hover();await expect(tile.locator(".stylebuilder-mosaic-grid")).toHaveCSS("opacity","1");await page.screenshot({path:test.info().outputPath("curated-tile.png"),fullPage:true});
    for(let pass=0;pass<2;pass++) {
      await tile.click();const details=page.getByRole("dialog",{name:"Style details",exact:true});await expect(details).toBeVisible();
      await expect(details.locator(".library-detail-examples img")).toHaveCount(4);
      await expect.poll(()=>details.locator(".library-detail-examples img").evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0&&getComputedStyle(image).objectFit==="contain"))).toBe(true);
      // The display formatter splits prose into blocks without textContent separators.
      await expect.poll(async()=>(await details.textContent()).replace(/\s+/g,"")).toContain(style.prompt.replace(/\s+/g,""));
      await expect(details).toContainText(style.notes);
      for(let i=1;i<=4;i++) {
        await details.getByRole("button",{name:`Enlarge ${style.name} example ${i}`,exact:true}).click();
        const preview=page.getByRole("dialog",{name:"Look example preview",exact:true});await expect(preview).toBeVisible();
        await expect.poll(()=>preview.locator("img").evaluate(image=>image.complete&&image.naturalWidth>0&&getComputedStyle(image).objectFit==="contain")).toBe(true);
        await page.keyboard.press("Escape");await expect(preview).not.toBeVisible();await expect(details).toBeVisible();
      }
      if(!pass){
        await page.screenshot({path:test.info().outputPath("curated-details.png"),fullPage:true});
        await details.locator(".look-description-body").scrollIntoViewIfNeeded();
        await page.screenshot({path:test.info().outputPath("curated-description.png"),fullPage:true});
      }
      await details.getByRole("button",{name:"Close style details",exact:true}).click();await expect(details).not.toBeVisible();
    }
    expect(requests.some(request=>request.path==="/api/style-library/analyze")).toBe(false);expect(errors).toEqual([]);
  } finally { await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100}); }
});
