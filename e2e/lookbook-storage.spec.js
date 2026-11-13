import {test,expect} from "@playwright/test";
import {chooseLookbookSource,openFixture} from "./helpers.mjs";

test("Film Stills groups color and mood filters and sends the selected filter with search", async ({page})=>{
  await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  await page.route("**/api/style-library/storage",route=>route.fulfill({json:{filmStillsDirectory:"/catalog",mode:"local"}}));
  let query;
  await page.route("**/api/style-library/film-stills?**",route=>{
    query=new URL(route.request().url()).searchParams;
    return route.fulfill({json:{ready:true,total:0,styles:[],categories:["Film Stills"]}});
  });
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await chooseLookbookSource(page,"Film Stills");
  const filter=page.getByRole("combobox",{name:"Look category",exact:true});
  await expect(filter).toHaveText("All filters");
  await filter.click();
  const list=page.getByRole("listbox",{name:"Look category options"});
  await expect(list.getByText("Color",{exact:true})).toBeVisible();
  await expect(list.getByText("Mood",{exact:true})).toBeVisible();
  await list.getByRole("option",{name:"Dark & Moody",exact:true}).click();
  await page.getByRole("textbox",{name:"Search looks"}).fill("frame");
  await expect.poll(()=>[query?.get("filter"),query?.get("q")]).toEqual(["dark-moody","frame"]);
  await expect(filter).toHaveText("Dark & Moody");
});

test("User Looks uses the configured Shared User Looks folder",async({page})=>{
  const {errors,requests}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  let storage={directory:"",looksDirectory:"",mode:"local",localCount:0},catalogReads=0,category;
  const json=(route,value)=>route.fulfill({contentType:"application/json",body:JSON.stringify(value)});
  const shared={id:"look-12345678-1234-1234-1234-123456789abc",name:"Shared Ink",sourceProvider:"Newt",category:"Illustration",examples:[{localUrl:"/outputs/e2e/shared-ink.png"}]};
  await page.route("**/api/style-library",route=>json(route,{revision:0,collections:[]}));
  await page.route("**/api/style-library/storage",route=>{
    if(route.request().method()==="PUT")storage={...storage,looksDirectory:route.request().postDataJSON().looksDirectory,mode:"shared"};
    return json(route,storage);
  });
  const list=route=>{
    catalogReads++;category=new URL(route.request().url()).searchParams.get("category");const styles=storage.mode==="shared"?[shared]:[];
    return json(route,{ready:true,source:"styleref",total:styles.length,localCount:styles.length,remoteCount:0,styles,categories:["Illustration","Photography"]});
  };
  await page.route("**/api/style-library/catalog?**",list);
  await page.route("**/api/style-library/stylefinder?**",route=>json(route,{
    ready:true,source:"stylefinder",total:1,styles:[{id:"stylefinder-ink",name:"StyleFinder Ink",examples:[]}],categories:["Illustration","Photography"],
  }));
  await page.route("**/api/style-library/shared-user-looks?**",list);
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await expect(page.getByRole("button",{name:"View StyleFinder Ink",exact:true})).toBeVisible();
  await chooseLookbookSource(page,"User Looks");
  await expect(page.getByLabel("Style previews",{exact:true})).toContainText("No styles match this view.");
  const before=catalogReads;
  await page.getByRole("button",{name:"Settings",exact:true}).click();await page.getByRole("button",{name:"Library Sources",exact:true}).click();
  const panel=page.getByRole("region",{name:"Lookbook storage",exact:true});
  await panel.getByLabel("Shared User Looks",{exact:true}).fill("/Volumes/Company/Newt_Shared_Looks");
  await panel.getByRole("button",{name:"Save sources",exact:true}).click();await expect(panel.getByRole("status")).toHaveText("Library sources saved.");
  await page.getByRole("button",{name:"Looks",exact:true}).click();await expect(page.getByRole("button",{name:"View Shared Ink",exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"Look category",exact:true}).click();
  await expect(page.getByRole("option",{name:"Photography",exact:true})).toBeVisible();
  await page.getByRole("option",{name:"Illustration",exact:true}).click();
  await expect.poll(()=>category).toBe("Illustration");
  await expect(page.getByRole("button",{name:"View Shared Ink",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"View StyleFinder Ink",exact:true})).toHaveCount(0);
  expect(catalogReads).toBeGreaterThan(before);expect(requests.some(item=>item.path==="/api/style-library/analyze")).toBe(false);expect(errors).toEqual([]);
});
test("Library Sources can swap a compact Lookbook between a Windows network path and a Mac mount",async({page})=>{
  const {errors}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  let state={directory:"",looksDirectory:"",filmStillsDirectory:"",mode:"local",localCount:2,sources:[],sourceNames:{}},fail=false,last;
  const json=(route,value,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(value)});
  await page.route("**/api/style-library/storage",route=>{if(route.request().method()==="PUT"){last=route.request().postDataJSON();if(fail)return json(route,{error:"Shared folder unavailable; previous setting unchanged."},503);state={...state,directory:last.directory,looksDirectory:last.looksDirectory,mode:last.looksDirectory?"shared":"local",format:"compact"};}return json(route,state);});
  await page.getByRole("button",{name:"Settings",exact:true}).click();
  await page.getByRole("button",{name:"Library Sources",exact:true}).click();
  const panel=page.getByRole("region",{name:"Lookbook storage",exact:true}),field=panel.getByLabel("Shared Looks Catalog",{exact:true});
  const looks=panel.getByLabel("Shared User Looks",{exact:true}),save=panel.getByRole("button",{name:"Save sources",exact:true});
  const uncPath="\\\\server\\Company\\Newt_Node_Lib";
  await field.fill(uncPath);await save.click();
  await expect(panel.getByRole("status")).toHaveText("Library sources saved.");expect(last).toEqual({directory:uncPath,looksDirectory:"",filmStillsDirectory:"",copyLocal:true,sources:[],sourceNames:{},removedSources:[]});
  fail=true;await field.fill("/Volumes/Company/Newt_Node_Lib");await save.click();await expect(panel.getByRole("alert")).toContainText("previous setting unchanged");expect(state.directory).toBe(uncPath);
  fail=false;await looks.fill("/Volumes/Company/Newt_Shared_Looks");await save.click();await expect(panel.getByRole("status")).toHaveText("Library sources saved.");expect(state.directory).toBe("/Volumes/Company/Newt_Node_Lib");
  await page.reload();await page.getByRole("button",{name:"Settings",exact:true}).click();
  const toggle=page.getByRole("button",{name:"Library Sources",exact:true});await expect(toggle).toBeVisible();await toggle.click();
  await expect(field).toHaveValue("/Volumes/Company/Newt_Node_Lib");await expect(looks).toHaveValue("/Volumes/Company/Newt_Shared_Looks");expect(errors).toEqual([]);
  await panel.screenshot({path:test.info().outputPath("shared-lookbook-setting.png")});
});

test("Renamed built-in sources and new folder and URL sources persist in Lookbook", async ({page})=>{
  await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  let state={directory:"",looksDirectory:"",filmStillsDirectory:"",mode:"local",localCount:0,sources:[],sourceNames:{}};
  await page.route("**/api/style-library/storage",route=>{
    if(route.request().method()==="PUT")state={...state,...route.request().postDataJSON()};
    return route.fulfill({json:state});
  });
  await page.route("**/api/style-library/sources/*?**",route=>{
    const id=new URL(route.request().url()).pathname.split("/").at(-1);
    const source=state.sources.find(source=>source.id===id);
    return route.fulfill({json:{total:1,styles:[{id,catalogId:id,name:`${source.name} Ink`,examples:[]}],categories:[]}});
  });
  await page.getByRole("button",{name:"Settings",exact:true}).click();
  await page.getByRole("button",{name:"User Preferences",exact:true}).click();
  await expect(page.getByLabel("Shared Looks Catalog",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Library Sources",exact:true}).click();
  await expect(page.getByRole("link",{name:"styleref.io",exact:true})).toHaveAttribute("href","https://styleref.io");
  for(const [before,after] of [["Shared Looks Catalog","Reference Archive"],["Film Stills Catalog","Film Frames"],["Shared User Looks","Team Looks"],["Commercial","StyleRef"]]){
    await page.getByRole("button",{name:before,exact:true}).dblclick();
    const name=page.getByRole("textbox",{name:`Rename ${before}`,exact:true});
    await name.fill(after);
    await name.press("Enter");
    await expect(page.getByRole("button",{name:after,exact:true})).toBeVisible();
  }
  await page.getByLabel("Film Frames",{exact:true}).fill("/Volumes/Studio/Film");
  const add=page.getByRole("button",{name:"Create new source",exact:true});
  await add.click();
  await add.click();
  await page.getByLabel("Source 1 name",{exact:true}).fill("Studio");
  await page.getByLabel("Source 1 path or URL",{exact:true}).fill("/Volumes/Studio/Catalog");
  await page.getByLabel("Source 2 name",{exact:true}).fill("Hosted");
  await page.getByLabel("Source 2 path or URL",{exact:true}).fill("https://catalog.example/catalog.json");
  await page.getByRole("button",{name:"Save sources",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Library sources saved"})).toBeVisible();

  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await chooseLookbookSource(page,"Reference Archive");
  await chooseLookbookSource(page,"Film Frames");
  await chooseLookbookSource(page,"Team Looks");
  await chooseLookbookSource(page,"StyleRef");
  await chooseLookbookSource(page,"Studio");
  await expect(page.getByRole("button",{name:"View Studio Ink",exact:true})).toBeVisible();
  await chooseLookbookSource(page,"All Sources");
  await expect(page.getByRole("button",{name:"View Hosted Ink",exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:"Settings",exact:true}).click();
  await page.getByRole("button",{name:"Library Sources",exact:true}).click();
  await expect(page.getByRole("button",{name:"Team Looks",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await chooseLookbookSource(page,"Hosted");
  await expect(page.getByRole("button",{name:"View Hosted Ink",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Settings",exact:true}).click();
  await page.getByRole("button",{name:"Remove StyleRef",exact:true}).click();
  await page.getByRole("button",{name:"Remove source 2",exact:true}).click();
  await page.getByRole("button",{name:"Save sources",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Library sources saved"})).toBeVisible();
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await page.getByRole("combobox",{name:"Looks source",exact:true}).click();
  await expect(page.getByRole("option",{name:"StyleRef",exact:true})).toHaveCount(0);
  await expect(page.getByRole("option",{name:"Hosted",exact:true})).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Settings",exact:true}).click();
  await page.getByLabel("Restore built-in source",{exact:true}).selectOption("library");
  await page.getByRole("button",{name:"Save sources",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Library sources saved"})).toBeVisible();
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await chooseLookbookSource(page,"StyleRef");
});
