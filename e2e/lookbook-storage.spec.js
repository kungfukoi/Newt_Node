import {test,expect} from "@playwright/test";
import {openFixture} from "./helpers.mjs";
test("User Preferences saves this computer's shared Lookbook path, preserves failed settings and supports a different Mac mount",async({page})=>{
  const {errors}=await openFixture(page,{fixture:{nodes:[],edges:[],groups:[],viewport:{x:0,y:0,scale:1}}});
  let state={directory:"",mode:"local",localCount:2},fail=false,last;
  const json=(route,value,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(value)});
  await page.route("**/api/style-library/storage",route=>{if(route.request().method()==="PUT"){last=route.request().postDataJSON();if(fail)return json(route,{error:"Shared folder unavailable; previous setting unchanged."},503);state={...state,directory:last.directory,mode:last.directory?"shared":"local"};}return json(route,state);});
  await page.getByRole("button",{name:"Settings",exact:true}).click();
  await page.getByRole("button",{name:/User Preferences/}).click();
  const panel=page.getByRole("region",{name:"Lookbook storage",exact:true}),field=panel.getByLabel("Shared Lookbook folder",{exact:true});
  await field.fill("C:\\Volumes\\Company\\Newt_Node_Lib");await panel.getByRole("button",{name:"Save folder",exact:true}).click();
  await expect(panel.getByRole("status")).toContainText("Shared Lookbook folder saved");expect(last.copyLocal).toBe(true);
  fail=true;await field.fill("/Volumes/Company/Newt_Node_Lib");await panel.getByRole("button",{name:"Save folder",exact:true}).click();await expect(panel.getByRole("alert")).toContainText("previous setting unchanged");expect(state.directory).toContain("C:");
  fail=false;await panel.getByRole("button",{name:"Save folder",exact:true}).click();await expect(panel.getByRole("status")).toContainText("Shared Lookbook folder saved");expect(state.directory).toBe("/Volumes/Company/Newt_Node_Lib");
  await page.reload();await page.getByRole("button",{name:"Settings",exact:true}).click();
  const toggle=page.getByRole("button",{name:/User Preferences/});await expect(toggle).toBeVisible();if(await toggle.getAttribute("aria-expanded")!=="true")await toggle.click();
  await expect(field).toHaveValue("/Volumes/Company/Newt_Node_Lib");expect(errors).toEqual([]);
  await panel.screenshot({path:test.info().outputPath("shared-lookbook-setting.png")});
});
