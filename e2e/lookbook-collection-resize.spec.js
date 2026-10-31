import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("My collection supports drag and keyboard row resizing, persistence and yellow dropdown highlights", async ({page}) => {
  const {errors,requests}=await openFixture(page,{count:1});
  let uiState={};
  await page.route("**/api/ui-state",route=>{if(route.request().method()==="PUT")uiState=route.request().postDataJSON().state;return route.fulfill({contentType:"application/json",body:JSON.stringify({state:uiState,revision:0,updatedAt:0})});});
  const styles=Array.from({length:48},(_,index)=>({id:`look-${index}`,name:`Saved look ${index+1}`,prompt:"Fine ink",examples:[{id:"example",localUrl:"/outputs/e2e/example.png"}]}));
  await page.route("**/api/style-library",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({revision:0,collections:[{id:"looks",name:"Looks",styles}]})}));
  await page.route("**/api/style-library/catalog?**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({ready:true,styles:styles.slice(0,9),total:9,indexed:9,categories:["Architects","Painters","Techniques"]})}));
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  const handle=page.getByRole("separator",{name:"Resize My collection rows",exact:true}),strip=page.getByLabel("Style previews",{exact:true});
  await expect(handle).toHaveCount(0);
  const category=page.getByRole("combobox",{name:"Look category",exact:true});await category.click();
  await expect(category).toHaveCSS("border-color","rgb(221, 198, 49)");
  const selected=page.getByRole("option",{name:"All categories",exact:true});
  await expect(selected).toHaveCSS("background-color","rgb(221, 198, 49)");
  await category.press("ArrowDown");await category.press("Enter");await expect(category).toContainText("Architects");
  await category.click();await category.press("Escape");await expect(page.getByRole("listbox")).toHaveCount(0);
  async function source(name){await page.getByRole("combobox",{name:"Looks source",exact:true}).click();await page.getByRole("option",{name,exact:true}).click();}
  await source("My collection");await expect(handle).toHaveAttribute("aria-valuenow","1");
  await expect(strip.locator(".stylebuilder-tile")).toHaveCount(48);
  const oneRow=await strip.boundingBox();
  async function drag(delta){await handle.scrollIntoViewIfNeeded();const box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+delta,{steps:8});await page.mouse.up();}
  await drag(208);await expect(handle).toHaveAttribute("aria-valuenow","2");
  expect((await strip.boundingBox()).height).toBeGreaterThan(oneRow.height+190);
  await handle.focus();await handle.press("ArrowDown");await expect(handle).toHaveAttribute("aria-valuenow","3");
  const tops=await strip.locator(".stylebuilder-tile").evaluateAll(nodes=>[...new Set(nodes.map(node=>Math.round(node.getBoundingClientRect().top)))]);
  expect(tops).toHaveLength(3);
  const scrollable=await strip.evaluate(node=>{node.scrollLeft=300;return node.scrollWidth>node.clientWidth&&node.scrollLeft>0;});expect(scrollable).toBe(true);
  await expect(strip.locator("img").first()).toHaveCSS("object-fit","contain");
  await page.screenshot({path:test.info().outputPath("collection-three-rows.png"),fullPage:true});
  await source("Catalog");await expect(handle).toHaveCount(0);await expect(strip).toHaveCSS("display","flex");
  await source("My collection");await expect(handle).toHaveAttribute("aria-valuenow","3");
  await page.reload();await page.getByRole("button",{name:"Looks",exact:true}).click();await source("My collection");
  await expect(handle).toHaveAttribute("aria-valuenow","3");
  await handle.focus();await handle.press("ArrowDown");await expect(handle).toHaveAttribute("aria-valuenow","4");
  await handle.press("Home");await expect(handle).toHaveAttribute("aria-valuenow","1");
  await drag(208);await expect(handle).toHaveAttribute("aria-valuenow","2");
  await handle.scrollIntoViewIfNeeded();await handle.dblclick();await expect(handle).toHaveAttribute("aria-valuenow","1");
  expect(requests.some(item=>item.path==="/api/style-library/analyze")).toBe(false);expect(errors).toEqual([]);
});
