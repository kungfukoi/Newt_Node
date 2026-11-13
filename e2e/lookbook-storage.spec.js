import {test,expect} from "@playwright/test";
import {chooseLookbookSource,openFixture} from "./helpers.mjs";

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
  await page.getByRole("button",{name:"Settings",exact:true}).click();await page.getByRole("button",{name:/User Preferences/}).click();
  const panel=page.getByRole("region",{name:"Lookbook storage",exact:true});
  await panel.getByLabel("Shared User Looks",{exact:true}).fill("/Volumes/Company/Newt_Shared_Looks");
  await panel.getByRole("button",{name:"Save folders",exact:true}).click();await expect(panel.getByRole("status")).toContainText("New Looks and their images will be saved to Shared User Looks");
  await page.getByRole("button",{name:"Looks",exact:true}).click();await expect(page.getByRole("button",{name:"View Shared Ink",exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"Look category",exact:true}).click();
  await expect(page.getByRole("option",{name:"Photography",exact:true})).toBeVisible();
  await page.getByRole("option",{name:"Illustration",exact:true}).click();
  await expect.poll(()=>category).toBe("Illustration");
  await expect(page.getByRole("button",{name:"View Shared Ink",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"View StyleFinder Ink",exact:true})).toHaveCount(0);
  expect(catalogReads).toBeGreaterThan(before);expect(requests.some(item=>item.path==="/api/style-library/analyze")).toBe(false);expect(errors).toEqual([]);
});
test("User Preferences can swap a compact Lookbook between a Windows network path and a Mac mount",async({page})=>{
  const {errors}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  let state={directory:"",looksDirectory:"",filmStillsDirectory:"",mode:"local",localCount:2},fail=false,last;
  const json=(route,value,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(value)});
  await page.route("**/api/style-library/storage",route=>{if(route.request().method()==="PUT"){last=route.request().postDataJSON();if(fail)return json(route,{error:"Shared folder unavailable; previous setting unchanged."},503);state={...state,directory:last.directory,looksDirectory:last.looksDirectory,mode:last.looksDirectory?"shared":"local",format:"compact"};}return json(route,state);});
  await page.getByRole("button",{name:"Settings",exact:true}).click();
  await page.getByRole("button",{name:/User Preferences/}).click();
  const panel=page.getByRole("region",{name:"Lookbook storage",exact:true}),field=panel.getByLabel("Shared Looks Catalog",{exact:true});
  const looks=panel.getByLabel("Shared User Looks",{exact:true}),save=panel.getByRole("button",{name:"Save folders",exact:true});
  const uncPath="\\\\server\\Company\\Newt_Node_Lib";
  await field.fill(uncPath);await save.click();
  await expect(panel.getByRole("status")).toContainText("New Looks will be saved on this computer");expect(last).toEqual({directory:uncPath,looksDirectory:"",filmStillsDirectory:"",copyLocal:true});
  fail=true;await field.fill("/Volumes/Company/Newt_Node_Lib");await save.click();await expect(panel.getByRole("alert")).toContainText("previous setting unchanged");expect(state.directory).toBe(uncPath);
  fail=false;await looks.fill("/Volumes/Company/Newt_Shared_Looks");await save.click();await expect(panel.getByRole("status")).toContainText("Browse it in Looks Catalog");expect(state.directory).toBe("/Volumes/Company/Newt_Node_Lib");
  await page.reload();await page.getByRole("button",{name:"Settings",exact:true}).click();
  const toggle=page.getByRole("button",{name:/User Preferences/});await expect(toggle).toBeVisible();await toggle.click();
  await expect(field).toHaveValue("/Volumes/Company/Newt_Node_Lib");await expect(looks).toHaveValue("/Volumes/Company/Newt_Shared_Looks");expect(errors).toEqual([]);
  await panel.screenshot({path:test.info().outputPath("shared-lookbook-setting.png")});
});
