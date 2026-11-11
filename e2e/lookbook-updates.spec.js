import {test,expect} from "@playwright/test";
import {chooseLookbookSource,openFixture} from "./helpers.mjs";
async function setup(page){
  const {errors,requests}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});let deleted=false,deleteCalls=0,failDelete=false,detailCalls=0;
  const images=Array.from({length:4},(_,index)=>({id:String(index),localUrl:`/outputs/e2e/look-${index}.png`}));
  const custom={id:"look-11111111-1111-4111-8111-111111111111",catalogId:"look-11111111-1111-4111-8111-111111111111",name:"Custom Ink",sourceProvider:"Newt",category:"Illustration",tags:[],examples:images,styleAnalysis:{stylePrompt:"Fine expressive ink contours on warm paper"}};
  const online={id:"styleref-photo",catalogId:"styleref-photo",name:"Photo",sourceProvider:"StyleRef",sourceUrl:"https://styleref.io/share/photo",category:"Photography",tags:[],examples:images.slice(0,1)};
  let library={revision:0,collections:[{id:"system-starred",name:"Starred",styles:[online]},{id:"saved",name:"Saved",styles:[custom,online]},{id:"empty",name:"Empty",styles:[]}]};
  const json=(route,value,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(value)});
  await page.route("**/api/style-library",route=>{if(route.request().method()==="PUT")library={...route.request().postDataJSON(),revision:library.revision+1};return json(route,library);});
  await page.route("**/api/style-library/storage",route=>json(route,{directory:"C:/fixtures/Shared",mode:"shared",localCount:0}));
  await page.route("**/api/style-library/catalog?**",route=>{const category=new URL(route.request().url()).searchParams.get("category"),styles=[...(deleted?[]:[custom]),online].filter(style=>!category||style.category===category);return json(route,{ready:true,remoteCount:1,localCount:deleted?0:1,total:styles.length,styles,categories:["Illustration","Photography"]});});
  await page.route("**/api/style-library/catalog/*",route=>{detailCalls++;return json(route,{style:route.request().url().endsWith(custom.id)?custom:{...online,examples:images}});});
  await page.route("**/api/style-library/created/*",route=>{deleteCalls++;if(failDelete)return json(route,{error:"Shared folder is unavailable"},503);deleted=true;return json(route,{id:custom.id,removed:true});});
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await chooseLookbookSource(page,"Commercial");
  const choose=async(label,name)=>{await page.getByRole("combobox",{name:label,exact:true}).click();await page.getByRole("option",{name,exact:true}).click();};
  return {errors,requests,choose,deleteCalls:()=>deleteCalls,detailCalls:()=>detailCalls,setFail:value=>{failDelete=value;},library:()=>library};
}
test("Category filters remain available and filter Catalog, Starred, named and empty collections",async({page})=>{
  const f=await setup(page);await f.choose("Look category","Illustration");await expect(page.getByRole("button",{name:"View Custom Ink",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"View Photo",exact:true})).toHaveCount(0);
  await f.choose("Looks source","Starred");await expect(page.getByRole("combobox",{name:"Look category",exact:true})).toHaveText("All categories");await f.choose("Look category","Photography");await expect(page.getByRole("button",{name:"View Photo",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"View Custom Ink",exact:true})).toHaveCount(0);
  await f.choose("Looks source","Saved");await f.choose("Look category","Illustration");await expect(page.getByRole("button",{name:"View Custom Ink",exact:true})).toBeVisible();
  await f.choose("Looks source","Empty");await expect(page.getByRole("combobox",{name:"Look category",exact:true})).toHaveText("All categories");await expect(page.getByText("Filter:",{exact:true})).toBeVisible();expect(f.errors).toEqual([]);
});
test("Thumbnails show the first example until hover or keyboard focus reveals the four-up preview",async({page})=>{
  const f=await setup(page),tile=page.locator(".stylebuilder-tile").filter({has:page.getByRole("button",{name:"View Photo",exact:true})}),cover=tile.locator(".stylebuilder-cover"),grid=tile.locator(".stylebuilder-mosaic-grid");
  await expect(cover).toHaveCSS("opacity","1");await expect(grid).toHaveCSS("opacity","0");await tile.hover();await expect(grid).toHaveCSS("opacity","1");await expect(grid.locator("img")).toHaveCount(4);await expect(cover).toHaveCSS("object-fit","contain");
  await tile.screenshot({path:test.info().outputPath("look-four-up-hover.png")});await page.getByRole("heading",{name:"Lookbook",exact:true}).hover();await expect(cover).toHaveCSS("opacity","1");await tile.getByRole("button",{name:"View Photo",exact:true}).focus();await expect(grid).toHaveCSS("opacity","1");expect(f.detailCalls()).toBe(1);expect(f.errors).toEqual([]);
});
test("Only custom Looks have Delete; cancellation/failure preserve the Look and success removes catalog and local collection copies",async({page})=>{
  const f=await setup(page);await page.getByRole("button",{name:"View Photo",exact:true}).click();const details=page.getByRole("dialog",{name:"Style details",exact:true});await expect(details.getByRole("button",{name:"Delete Look",exact:true})).toHaveCount(0);await details.getByRole("button",{name:"Close style details",exact:true}).click();
  await page.getByRole("button",{name:"View Custom Ink",exact:true}).click();
  expect(await details.evaluate(root=>root.querySelector('.library-detail-examples').nextElementSibling.classList.contains('look-detail-actions'))).toBe(true);
  await details.screenshot({path:test.info().outputPath("look-detail-actions.png")});
  await details.getByRole("button",{name:"Delete Look",exact:true}).click();await expect(details.getByLabel("Delete custom Look")).toContainText("shared catalog for everyone");await details.getByRole("button",{name:"Cancel delete",exact:true}).click();expect(f.deleteCalls()).toBe(0);
  f.setFail(true);await details.getByRole("button",{name:"Delete Look",exact:true}).click();await details.getByRole("button",{name:"Confirm delete Look",exact:true}).click();await expect(details.getByRole("alert")).toContainText("Shared folder is unavailable");await expect(details).toBeVisible();
  f.setFail(false);await details.getByRole("button",{name:"Confirm delete Look",exact:true}).click();await expect(details).not.toBeVisible();await expect(page.getByRole("button",{name:"View Custom Ink",exact:true})).toHaveCount(0);expect(f.library().collections.flatMap(item=>item.styles).some(style=>style.name==="Custom Ink")).toBe(false);expect(f.requests.some(request=>request.path==="/api/style-library/analyze")).toBe(false);expect(f.errors).toEqual([]);
});

test("User Looks removes only checked looks and retains failed selections for retry",async({page})=>{
  const f=await setup(page);
  const directory="C:/fixtures/Shared";
  const looks=["Ink","Wash","Pencil"].map((name,index)=>({
    id:`look-00000000-0000-4000-8000-00000000000${index}`,name,examples:[],category:"Illustration",
  }));
  const removed=new Set(),attempts=[];
  let failWash=true;
  await page.route("**/api/style-library/shared-user-looks?**",route=>{
    const styles=looks.filter(look=>!removed.has(look.id));
    return route.fulfill({json:{ready:true,styles,total:styles.length,categories:["Illustration"],looksDirectory:directory}});
  });
  await page.route("**/api/style-library/shared-user-looks/*",route=>{
    const id=new URL(route.request().url()).pathname.split("/").at(-1);
    attempts.push({id,...route.request().postDataJSON()});
    if(id===looks[1].id&&failWash)return route.fulfill({status:503,json:{error:"Folder temporarily unavailable"}});
    removed.add(id);
    return route.fulfill({json:{id,removed:true}});
  });
  const remove=page.getByRole("button",{name:"Remove Look",exact:true});
  await expect(remove).toHaveCount(0);
  await chooseLookbookSource(page,"User Looks");
  await expect(remove).toBeDisabled();
  await page.getByRole("checkbox",{name:"Select Ink",exact:true}).check();
  await page.getByRole("checkbox",{name:"Select Wash",exact:true}).check();
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(page.getByRole("alert")).toContainText("Could not remove 1 look");
  await expect(page.getByRole("button",{name:"View Ink",exact:true})).toHaveCount(0);
  await expect(page.getByRole("checkbox",{name:"Select Wash",exact:true})).toBeChecked();
  await expect(page.getByRole("button",{name:"View Pencil",exact:true})).toBeVisible();
  failWash=false;
  await page.getByRole("alert").getByRole("button",{name:"Retry",exact:true}).click();
  await expect(page.getByRole("button",{name:"View Wash",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"View Pencil",exact:true})).toBeVisible();
  expect(attempts).toEqual([looks[0],looks[1],looks[1]].map(({id})=>({id,directory})));
  expect(f.errors).toEqual([]);
});
