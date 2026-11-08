import {test,expect} from "@playwright/test";
import {chooseLookbookSource,openFixture} from "./helpers.mjs";
import {createStyleRefCatalog} from "../server/styleref-catalog.js";

test("Shared category shows only shared-store looks, supports search, and reports unavailable storage",async({page})=>{
  const {errors,requests}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  let unavailable=false;
  const shared=["Shared Ink","Shared Wash"].map((name,index)=>({id:`look-${index}`,name,category:"Illustration",tags:[],prompt:"Paper texture",sourceProvider:"Newt",examples:[{localUrl:"/outputs/e2e/shared.png"}]}));
  const catalog=createStyleRefCatalog({createdStore:{state:async()=>({mode:"shared"}),read:async()=>{if(unavailable)throw Object.assign(Error("Shared folder unavailable. Mount LucidLink."),{status:503});return shared;}},fetchImpl:async()=>Response.json({styles:[{slug:"online-ink",name:"Online Ink",category:"Illustration",tags:[]}],hasMore:false})});
  const json=(route,value,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(value)});
  await page.route("**/api/style-library",route=>json(route,{revision:0,collections:[]}));
  await page.route("**/api/style-library/catalog?**",async route=>{
    try{return json(route,await catalog.search(Object.fromEntries(new URL(route.request().url()).searchParams)));}
    catch(error){return json(route,{error:error.message},error.status||503);}
  });
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await chooseLookbookSource(page,"Commercial");
  await expect(page.getByRole("button",{name:"View Online Ink",exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"Look category",exact:true}).click();await page.getByRole("option",{name:"Shared",exact:true}).click();
  await expect(page.getByText("2 shared looks",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"View Online Ink",exact:true})).toHaveCount(0);
  const strip=page.getByLabel("Style previews",{exact:true});await expect(strip.locator(".stylebuilder-tile")).toHaveCount(2);
  const search=page.getByRole("textbox",{name:"Search looks",exact:true});await search.fill("Ink");await expect(page.getByText("1 shared look",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"View Shared Ink",exact:true})).toBeVisible();
  await search.fill("no-matching-shared-look");await expect(strip).toContainText("No styles match this view.");
  await search.fill("");await expect(strip.locator(".stylebuilder-tile")).toHaveCount(2);
  unavailable=true;await page.getByRole("button",{name:"Refresh catalog",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Mount LucidLink");
  expect(requests.some(item=>item.path==="/api/style-library/analyze")).toBe(false);expect(errors).toEqual([]);
});
