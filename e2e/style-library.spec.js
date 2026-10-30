import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Library replaces media tabs and sends saved descriptions and complete examples to existing nodes", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 1, uiState: { workspaceMode: "image" } });
  let library = { version: 1, revision: 0, collections: [{id:"film-look",name:"Film look",styles:[{id:"crimson-ink",name:"Crimson ink",sourceUrl:"https://midlibrary.io/library/crimson-ink",prompt:"Heavy ink, crimson accents, rough paper --sref 123",examples:[{id:"example",localUrl:"/outputs/e2e/example.png",fileName:"example.png",mimeType:"image/png"}]}]}] };
  await page.route("**/api/style-library", async route => {
    if (route.request().method() === "PUT") { library = { ...route.request().postDataJSON(), revision: library.revision + 1 }; }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(library) });
  });
  await page.route("**/api/node/upload-asset", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ asset: { localUrl: "/outputs/e2e/example.png", fileName: "example.png", mimeType: "image/png" } }) }));
  await page.route("**/api/style-library/catalog?**", route => route.fulfill({contentType:"application/json",body:JSON.stringify({ready:false,total:0,indexed:0,categories:[],styles:[]})}));
  const nav = page.locator(".mode-switch");
  await expect(nav.getByRole("button", { name: "Image", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "Video", exact: true })).toHaveCount(0);
  await nav.getByRole("button", { name: "Looks", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Looks", exact: true })).toBeVisible();
  await page.getByRole("button", {name:"Looks settings",exact:true}).click();
  await page.getByRole("textbox", { name: "New collection name" }).fill("Other looks");
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await expect(page.getByLabel("Style direction",{exact:true})).toHaveCount(0);
  await expect(page.getByLabel("Visual description",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Add style references",exact:true})).toHaveCount(0);
  await page.getByLabel("Collection",{exact:true}).selectOption("film-look");
  await page.getByRole("button",{name:"Looks settings",exact:true}).click();
  await page.getByLabel("Looks source",{exact:true}).selectOption("collection");
  await page.getByRole("button",{name:"View Crimson ink",exact:true}).click();
  await expect(page.locator(".library-detail-examples img")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("stylebuilder.png"), fullPage: true });
  await page.getByRole("button", { name: "Use in Style", exact: true }).click();
  await expect(nav.getByRole("button", { name: "Nodes", exact: true })).toHaveClass("active");
  await expect(page.getByLabel("Looks style").locator("option:checked")).toHaveText("Crimson ink");
  await expect(page.getByLabel("Custom library style description")).toHaveCount(0);
  await expect(page.getByTitle("Refresh library", { exact: true })).toHaveCount(0);
  await expect(page.locator(".library-style-picker").getByRole("button", { name: "Clear", exact: true })).toHaveCount(0);
  await expect(page.locator('.react-flow__node').filter({ has: page.getByLabel("Looks style") }).locator('[data-port-key$=":styleOut"]')).toHaveCount(1);
  const rows=await page.locator('.react-flow__node').filter({has:page.getByLabel("Looks style")}).locator('.style-preset-row > span').allTextContents();
  expect(rows).toEqual(["Style","Grade","Looks"]);
  await nav.getByRole("button", { name: "Looks", exact: true }).click();
  await page.getByRole("checkbox", { name: "Crimson ink", exact: true }).check();
  await expect(page.locator(".library-board")).toHaveCount(0);
  await page.getByRole("button", { name: "Create Mood Board node", exact: true }).click();
  await expect(page.getByLabel("Mood Board visual direction")).toHaveCount(0);
  await expect(page.locator(".style-collage img")).toHaveCount(1);
  await page.route("**/api/node/upload-transfer-collage", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ asset: { localUrl: "/outputs/e2e/board.png", fileName: "MOOD_BOARD.png", mimeType: "image/png" } }) }));
  await page.getByTitle("Compile MOOD_BOARD.png", { exact: true }).click();
  await expect(page.getByTitle("Unlock mood board", { exact: true })).toBeVisible();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByLabel("Looks style").locator("option:checked")).toHaveText("Crimson ink");
  await expect(page.getByLabel("Custom library style description")).toHaveCount(0);
  await expect(page.getByLabel("Mood Board visual direction")).toHaveCount(0);
  const savedBoard = await page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.type === "transfer"));
  expect(savedBoard.data.libraryBoardPrompt).toBe("Heavy ink, crimson accents, rough paper");
  const savedStyle = await page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.type === "style"));
  expect(savedStyle.data.libraryStyle.prompt).toBe("Heavy ink, crimson accents, rough paper");
  await expect(page.getByTitle("Unlock mood board", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Catalog looks open details, save examples and create a named Style without prompting or generation",async({page})=>{
  const fixture={nodes:[{id:"existing-style",type:"style",x:20,y:20,data:{title:"Style",stylePreset:"None"}}],edges:[],groups:[],viewport:{x:0,y:0,scale:1}};
  const {errors,requests}=await openFixture(page,{fixture});
  let library={version:1,revision:0,collections:[]},uploads=0;
  const style={id:"ink-catalog",name:"Ink drawing",sourceUrl:"https://midlibrary.io/library/ink-catalog",category:"Techniques",detailAvailable:true,prompt:"Fine ink lines on warm paper.",sref:"--sref 123",tags:["Fine lines"],examples:Array.from({length:4},(_,index)=>({id:`ref-${index}`,url:`/outputs/e2e/ref-${index}.png`,fileName:`ref-${index}.png`}))};
  await page.route("**/api/style-library",async route=>{if(route.request().method()==="PUT")library={...route.request().postDataJSON(),revision:library.revision+1};return route.fulfill({contentType:"application/json",body:JSON.stringify(library)});});
  await page.route("**/api/style-library/catalog?**",route=>{const query=new URL(route.request().url()).searchParams.get("q");return route.fulfill({contentType:"application/json",body:JSON.stringify({ready:true,populating:true,total:query==="missing"?0:1,indexed:1008,categories:["Techniques"],styles:query==="missing"?[]:[style]})});});
  await page.route("**/api/style-library/catalog/ink-catalog",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({style})}));
  await page.route("**/api/node/upload-asset",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({asset:{localUrl:`/outputs/e2e/import-${++uploads}.png`,fileName:"example.png",mimeType:"image/png"}})}));
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await expect(page.locator(".stylebuilder-mosaic img")).toHaveCount(4);
  await page.getByRole("button",{name:"View Ink drawing",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Style details"})).toBeVisible();
  await expect(page.locator(".library-detail-examples img")).toHaveCount(4);
  await page.getByRole("button",{name:"Select style",exact:true}).click();
  await page.getByRole("button",{name:"Save to my collection",exact:true}).click();
  await expect.poll(()=>library.collections[0]?.styles.length||0).toBe(1);
  expect(library.collections[0].styles[0].examples).toHaveLength(4);
  expect(library.collections[0].styles[0].examples.every(image=>image.localUrl.startsWith("/outputs/"))).toBe(true);
  await expect(page.getByRole("button",{name:"Saved to my collection",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Close style details",exact:true}).click();
  await expect(page.getByRole("button",{name:"Saved to collection: Ink drawing",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("textbox",{name:"Search looks",exact:true}).fill("missing");
  await expect(page.locator(".stylebuilder-tile")).toHaveCount(0);
  await page.getByLabel("Looks source",{exact:true}).selectOption("selected");
  await page.getByRole("textbox",{name:"Search looks",exact:true}).fill("");
  await expect(page.locator(".stylebuilder-tile")).toHaveCount(1);
  await expect(page.getByLabel("Style direction",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Start",exact:true})).toHaveCount(0);
  await expect(page.locator(".stylebuilder-editor")).toHaveCount(0);
  expect(requests.some(item=>item.path==="/api/node/generate-image")).toBe(false);
  await page.getByRole("button",{name:"Use selected in Style",exact:true}).click();
  const createdPicker=page.locator('.react-flow__node:not([data-id="existing-style"])').getByLabel("Looks style");
  await expect(createdPicker.locator("option:checked")).toHaveText("Ink drawing");
  const existingPicker=page.locator('.react-flow__node[data-id="existing-style"]').getByLabel("Looks style");
  await expect(existingPicker.getByRole("option",{name:"Ink drawing",exact:true})).toHaveCount(1);
  await existingPicker.selectOption({label:"Ink drawing"});
  await expect(existingPicker.locator("option:checked")).toHaveText("Ink drawing");
  await expect(page.getByLabel("Custom library style description")).toHaveCount(0);
  expect(library.collections[0].styles).toHaveLength(1);
  expect(library.collections[0].styles[0].prompt).toBe("Fine ink lines on warm paper.");
  expect(errors).toEqual([]);
});

test("A catalog look must save before its node is created, with retry after a collection conflict",async({page})=>{
  const {errors}=await openFixture(page,{count:1});let conflict=true;
  let library={version:1,revision:0,collections:[]};
  await page.route("**/api/style-library",route=>{
    if(route.request().method()==="PUT"){
      if(conflict)return route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({error:"Library changed in another window. Reload the library before saving again."})});
      library={...route.request().postDataJSON(),revision:library.revision+1};
    }
    return route.fulfill({contentType:"application/json",body:JSON.stringify(library)});
  });
  const style={id:"warm-ink",name:"Warm ink",sourceUrl:"https://midlibrary.io/library/warm-ink",prompt:"Warm paper and soft ink",examples:[]};
  await page.route("**/api/style-library/catalog?**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({ready:true,styles:[style],total:1,categories:[],indexed:1})}));
  await page.route("**/api/style-library/catalog/warm-ink",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({style})}));
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await page.getByRole("button",{name:"View Warm ink",exact:true}).click();
  await page.getByRole("button",{name:"Use in Style",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Style details"}).getByRole("alert")).toContainText("Library changed in another window");
  await expect(page.locator(".mode-switch button.active")).toHaveText("Looks");
  expect(library.collections).toHaveLength(0);
  conflict=false;
  await page.getByRole("button",{name:"Use in Style",exact:true}).click();
  await expect(page.getByLabel("Looks style").locator("option:checked")).toHaveText("Warm ink");
  expect(library.collections[0].styles[0].prompt).toBe("Warm paper and soft ink");
  expect(errors).toEqual([]);
});

test("Library style reaches image generation and remains independent of later collection edits", async ({ page }) => {
  const fixture = { nodes: [
    { id: "style", type: "style", x: 20, y: 20, data: { title: "Style", stylePreset: "None", libraryStyle: { id: "ink", name: "Ink", prompt: "Heavy ink with crimson accents" } } },
    { id: "model", type: "imageModel", x: 450, y: 20, data: { title: "Image Model", model: "Nano Banana Pro", prompt: "An old lighthouse" } }
  ], edges: [{ id: "style-wire", from: { nodeId: "style", port: "styleOut" }, to: { nodeId: "model", port: "styleIn" }, color: "#9b5cff" }], groups: [], viewport: { x: 0, y: 0, scale: 1 } };
  const { errors } = await openFixture(page, { fixture });
  let submitted;
  await page.route("**/api/node/generate-image", async route => { submitted = route.request().postDataJSON(); return route.fulfill({ contentType: "application/json", body: JSON.stringify({ images: [{ localUrl: "/outputs/e2e/generated.png" }] }) }); });
  await page.locator('.react-flow__node[data-id="model"]').locator('.run-node-button').click();
  await expect.poll(() => submitted?.prompt || "").toContain("Heavy ink with crimson accents");
  expect(errors).toEqual([]);
});
