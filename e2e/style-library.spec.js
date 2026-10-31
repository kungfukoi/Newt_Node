import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import sharp from "sharp";

test("Look defaults to its first example, permits grade overrides and replaces the default on switch", async ({page}) => {
  const fixture={nodes:[{id:"style",type:"style",x:20,y:20,data:{title:"Style",stylePreset:"None",gradePreset:"Warm"}}],edges:[],groups:[],viewport:{x:0,y:0,scale:1}};
  const {errors}=await openFixture(page,{fixture});let analyses=0;
  const look=(id,name,images)=>({id,name,prompt:"Source",styleAnalysis:{stylePrompt:`Rendering treatment for ${name}`},examples:images.map(localUrl=>({localUrl}))});
  const library={revision:0,collections:[{id:"looks",name:"Looks",styles:[look("red","Red",["/outputs/e2e/red.png","/outputs/e2e/green.png"]),look("green","Green",["/outputs/e2e/green.png","/outputs/e2e/red.png"]),look("slow","Slow",["/outputs/e2e/slow.png"])]}]};
  await page.route("**/api/style-library",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(library)}));
  await page.route("**/api/style-library/analyze",route=>{analyses++;return route.fulfill({status:500,body:"Analysis should not run"});});
  let releaseSlow;
  const slowGate=new Promise(resolve=>{releaseSlow=resolve;});
  for(const [name,color] of [["red","#ff0000"],["green","#00ff00"],["slow","#0000ff"]]){
    const buffer=await sharp({create:{width:48,height:32,channels:3,background:color}}).png().toBuffer();
    await page.route(`**/outputs/e2e/${name}.png`,async route=>{if(name==="slow")await slowGate;return route.fulfill({contentType:"image/png",headers:{"Access-Control-Allow-Origin":"*"},body:buffer});});
  }
  const node=page.locator('.react-flow__node[data-id="style"]'),picker=node.getByLabel("Look",{exact:true}),grade=node.getByLabel("Grade",{exact:true});
  await picker.focus();
  await expect(picker.getByRole("option",{name:"Red",exact:true})).toHaveCount(1);
  await picker.selectOption({label:"Red"});
  await expect(grade).toHaveValue("Custom");await expect(grade).toBeEnabled();
  await expect(node.locator(".custom-palette-preview")).toHaveAttribute("src",/red\.png/);
  await expect(node.locator(".custom-palette-preview")).toHaveCSS("object-fit","contain");
  await expect(node.locator(".custom-grade-hex-list")).toContainText("#FF0000",{ignoreCase:true});
  await expect(node.locator('.custom-palette-panel input[type="file"]')).toBeEnabled();
  await expect(node.getByTitle("Clear extracted palette",{exact:true})).toBeEnabled();
  const blue=await sharp({create:{width:48,height:32,channels:3,background:"#0000ff"}}).png().toBuffer();
  const override=()=>node.locator('.custom-palette-panel input[type="file"]').setInputFiles({name:"override.png",mimeType:"image/png",buffer:blue});
  await override();
  await expect(node.locator(".custom-grade-hex-list")).toContainText("#0000FF",{ignoreCase:true});
  await expect(picker.locator("option:checked")).toHaveText("Red");
  await page.waitForTimeout(700);await page.reload();
  await expect(node.locator(".custom-grade-hex-list")).toContainText("#0000FF",{ignoreCase:true});
  await grade.selectOption("Warm");
  await expect(picker.locator("option:checked")).toHaveText("Red");
  await page.waitForTimeout(700);await page.reload();
  await expect(grade).toHaveValue("Warm");
  const request=page.waitForRequest(request=>request.url().includes("/outputs/e2e/slow.png"));
  await picker.selectOption({label:"Slow"});await request;
  await override();
  await expect(node.locator(".custom-grade-hex-list")).toContainText("#0000FF",{ignoreCase:true});
  releaseSlow();
  await page.waitForTimeout(150);
  await expect(picker.locator("option:checked")).toHaveText("Slow");
  await expect(node.locator(".custom-grade-hex-list")).toContainText("#0000FF",{ignoreCase:true});
  await picker.selectOption({label:"Green"});
  await expect(node.locator(".custom-grade-hex-list")).toContainText("#00FF00",{ignoreCase:true});
  await expect(node.locator(".custom-palette-preview")).toHaveAttribute("src",/green\.png/);
  await page.waitForTimeout(700);await page.reload();
  await expect(grade).toHaveValue("Custom");await expect(grade).toBeEnabled();
  await expect(node.locator(".custom-palette-preview")).toHaveAttribute("src",/green\.png/);
  await expect(node.locator(".custom-grade-hex-list")).toContainText("#00FF00",{ignoreCase:true});
  await node.getByTitle("Clear extracted palette",{exact:true}).click();
  await expect(node.locator(".custom-palette-preview")).toHaveCount(0);
  await expect(picker.locator("option:checked")).toHaveText("Green");
  await page.waitForTimeout(700);await page.reload();
  await expect(node.locator(".custom-palette-preview")).toHaveCount(0);
  await picker.selectOption({label:"Red"});
  await expect(node.locator(".custom-palette-preview")).toHaveAttribute("src",/red\.png/);
  await expect(node.locator(".custom-grade-hex-list")).toContainText("#FF0000",{ignoreCase:true});
  await override();await expect(node.locator(".custom-grade-hex-list")).toContainText("#0000FF",{ignoreCase:true});
  await picker.selectOption("");await expect(grade).toHaveValue("Custom");
  await expect(node.locator(".custom-grade-hex-list")).toContainText("#0000FF",{ignoreCase:true});
  expect(analyses).toBe(0);expect(errors).toEqual([]);
});

test("Rejected look analysis clears the progress notice and preserves the open details and collection", async ({page}) => {
  const {errors}=await openFixture(page,{count:1});let paidCalls=0,saves=0;
  const style={id:"blade-runner",name:"Blade Runner",prompt:"Source observations",examples:[{localUrl:"/outputs/e2e/example.png"}]};
  await page.route("**/api/style-library",route=>{if(route.request().method()==="PUT")saves++;return route.fulfill({contentType:"application/json",body:JSON.stringify({revision:0,collections:[{id:"looks",name:"Looks",styles:[style]}]})});});
  await page.route("**/api/style-library/catalog?**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({ready:true,total:0,indexed:0,categories:[],styles:[]})}));
  await page.route("**/api/style-library/analyze",route=>{paidCalls++;return route.fulfill({status:502,contentType:"application/json",body:JSON.stringify({error:"Atlas Cloud: The model produced invalid content."})});});
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await page.getByRole("combobox",{name:"Looks source",exact:true}).click(); await page.getByRole("option",{name:"My collection",exact:true}).click();
  await page.getByRole("button",{name:"View Blade Runner",exact:true}).click();
  const details=page.getByRole("dialog",{name:"Style details",exact:true});
  await details.getByRole("button",{name:"Use in Style",exact:true}).click();
  await expect(details.getByRole("alert")).toContainText("invalid content");
  await expect(details.getByRole("status")).toHaveCount(0);
  await expect(details.getByRole("button",{name:"Use in Style",exact:true})).toBeEnabled();
  expect(paidCalls).toBe(1);expect(saves).toBe(0);expect(errors).toEqual([]);
});

test("Lookbook keeps details open, enlarges whole examples, clears search and reuses its saved Astra description", async ({page}) => {
  const {errors}=await openFixture(page,{count:1});
  let library={version:1,revision:0,collections:[]},analyses=0;
  const prompt="Preserve the requested subject. Use translucent ink washes, irregular fine contours, muted warm paper and sparse crimson accents.";
  const style={id:"wash",name:"Ink wash",sourceUrl:"https://midlibrary.io/library/wash",prompt:"A woman beside a tree, in delicate ink washes",examples:[{localUrl:"/outputs/e2e/example.png"},{localUrl:"/outputs/e2e/reference.png"}]};
  await page.route("**/api/style-library",route=>{if(route.request().method()==="PUT")library={...route.request().postDataJSON(),revision:library.revision+1};return route.fulfill({contentType:"application/json",body:JSON.stringify(library)});});
  await page.route("**/api/style-library/catalog?**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({ready:true,total:1,indexed:1,categories:[],styles:[style]})}));
  await page.route("**/api/style-library/catalog/wash",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({style})}));
  await page.route("**/api/style-library/analyze",route=>{
    analyses++;
    expect(route.request().postDataJSON().observations).toBe(style.prompt);
    expect(route.request().postDataJSON().examples).toHaveLength(2);
    return route.fulfill({contentType:"application/json",body:JSON.stringify({stylePrompt:prompt,fingerprint:"saved-ink",model:"gpt-6-astra",version:1})});
  });
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await page.getByRole("textbox",{name:"Search looks",exact:true}).fill("ink");
  await page.getByRole("button",{name:"Clear look search",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Search looks",exact:true})).toHaveValue("");
  await expect(page.getByRole("textbox",{name:"Search looks",exact:true})).toBeFocused();
  await page.getByRole("button",{name:"View Ink wash",exact:true}).click();
  const details=page.getByRole("dialog",{name:"Style details",exact:true});
  await page.getByRole("button",{name:"Enlarge Ink wash example 1",exact:true}).click();
  const preview=page.getByRole("dialog",{name:"Look example preview",exact:true});
  await expect(preview).toBeVisible();
  await expect(preview.locator("img")).toHaveCSS("object-fit","contain");
  await preview.press("ArrowRight");
  await expect(preview.locator("img")).toHaveAttribute("alt","Ink wash example 2, enlarged");
  await page.screenshot({path:test.info().outputPath("lookbook-preview.png"),fullPage:true});
  await preview.press("Escape");
  await expect(preview).not.toBeVisible();await expect(details).toBeVisible();
  await details.getByRole("button",{name:"Save to my collection",exact:true}).click();
  await expect(details).toBeVisible();expect(analyses).toBe(0);
  await details.getByRole("button",{name:"Create Mood Board node",exact:true}).click();
  await expect(details.getByRole("status")).toContainText("Created Mood Board");
  await expect(details).toBeVisible();expect(analyses).toBe(0);
  await details.getByRole("button",{name:"Use in Style",exact:true}).click();
  await expect(details.getByRole("status")).toContainText("description is saved");
  await expect(details).toBeVisible();expect(analyses).toBe(1);
  expect(library.collections[0].styles[0].styleAnalysis.stylePrompt).toBe(prompt);
  await details.getByRole("button",{name:"Use in Style",exact:true}).click();
  await expect(details.getByRole("button",{name:"Use in Style",exact:true})).toBeEnabled();expect(analyses).toBe(1);
  await page.getByRole("button",{name:"Close style details",exact:true}).click();
  await page.getByRole("button",{name:"Nodes",exact:true}).click();
  await expect(page.getByLabel("Look",{exact:true})).toHaveCount(2);
  await page.reload();
  await page.getByLabel("Look",{exact:true}).first().selectOption("");
  await page.getByLabel("Look",{exact:true}).first().selectOption({label:"Ink wash"});
  await expect(page.getByLabel("Look",{exact:true}).first().locator("option:checked")).toHaveText("Ink wash");
  expect(analyses).toBe(1);expect(errors).toEqual([]);
});

async function mockAnalysis(page) {
  await page.route("**/api/style-library/analyze", route => {
    const body=route.request().postDataJSON();
    return route.fulfill({contentType:"application/json",body:JSON.stringify({stylePrompt:`Astra: ${body.observations.replace(/--sref.*$/, "").trim()}`,fingerprint:"e2e-analysis",model:"gpt-6-astra",version:1})});
  });
}

test("Library replaces media tabs and sends saved descriptions and complete examples to existing nodes", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 1, uiState: { workspaceMode: "image" } });
  await mockAnalysis(page);
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
  await expect(page.getByRole("heading", { name: "Lookbook", exact: true })).toBeVisible();
  await expect(page.locator(".lookbook-hero").getByRole("button")).toHaveCount(0);
  await expect(page.getByLabel("Style direction",{exact:true})).toHaveCount(0);
  await expect(page.getByLabel("Visual description",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Add style references",exact:true})).toHaveCount(0);
  await page.getByRole("combobox",{name:"Looks source",exact:true}).click(); await page.getByRole("option",{name:"My collection",exact:true}).click();
  await page.getByRole("button",{name:"View Crimson ink",exact:true}).click();
  await expect(page.locator(".library-detail-examples img")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("stylebuilder.png"), fullPage: true });
  await page.getByRole("button", { name: "Use in Style", exact: true }).click();
  await expect(page.getByRole("dialog",{name:"Style details"}).getByRole("status")).toContainText("description is saved");
  await page.getByRole("button",{name:"Close style details",exact:true}).click();
  await nav.getByRole("button",{name:"Nodes",exact:true}).click();
  await expect(page.getByLabel("Look",{exact:true}).locator("option:checked")).toHaveText("Crimson ink");
  await expect(page.getByLabel("Custom library style description")).toHaveCount(0);
  await expect(page.getByTitle("Refresh library", { exact: true })).toHaveCount(0);
  await expect(page.locator(".library-style-picker").getByRole("button", { name: "Clear", exact: true })).toHaveCount(0);
  await expect(page.locator('.react-flow__node').filter({ has: page.getByLabel("Look",{exact:true}) }).locator('[data-port-key$=":styleOut"]')).toHaveCount(1);
  const rows=await page.locator('.react-flow__node').filter({has:page.getByLabel("Look",{exact:true})}).locator('.style-preset-row > span').allTextContents();
  expect(rows).toEqual(["Style","Grade","Look"]);
  await nav.getByRole("button", { name: "Looks", exact: true }).click();
  await expect(page.locator(".stylebuilder-tile input[type=checkbox]")).toHaveCount(0);
  await page.getByRole("button",{name:"View Crimson ink",exact:true}).click();
  await expect(page.getByRole("button",{name:"Select style",exact:true})).toHaveCount(0);
  await expect(page.getByText("Select a style to begin",{exact:true})).toHaveCount(0);
  await expect(page.locator(".library-board")).toHaveCount(0);
  await page.getByRole("button", { name: "Create Mood Board node", exact: true }).click();
  await page.getByRole("button",{name:"Close style details",exact:true}).click();
  await nav.getByRole("button",{name:"Nodes",exact:true}).click();
  await expect(page.getByLabel("Mood Board visual direction")).toHaveCount(0);
  await expect(page.locator(".style-collage img")).toHaveCount(1);
  await page.route("**/api/node/upload-transfer-collage", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ asset: { localUrl: "/outputs/e2e/board.png", fileName: "MOOD_BOARD.png", mimeType: "image/png" } }) }));
  await page.getByTitle("Compile MOOD_BOARD.png", { exact: true }).click();
  await expect(page.getByTitle("Unlock mood board", { exact: true })).toBeVisible();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByLabel("Look",{exact:true}).locator("option:checked")).toHaveText("Crimson ink");
  await expect(page.getByLabel("Custom library style description")).toHaveCount(0);
  await expect(page.getByLabel("Mood Board visual direction")).toHaveCount(0);
  const savedBoard = await page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.type === "transfer"));
  expect(savedBoard.data.libraryBoardPrompt).toBe("Astra: Heavy ink, crimson accents, rough paper");
  const savedStyle = await page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.type === "style"));
  expect(savedStyle.data.libraryStyle.prompt).toBe("Astra: Heavy ink, crimson accents, rough paper");
  await expect(page.getByTitle("Unlock mood board", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Catalog looks open details, save examples and create a named Style without prompting or generation",async({page})=>{
  const fixture={nodes:[{id:"existing-style",type:"style",x:20,y:20,data:{title:"Style",stylePreset:"None"}}],edges:[],groups:[],viewport:{x:0,y:0,scale:1}};
  const {errors,requests}=await openFixture(page,{fixture});
  await mockAnalysis(page);
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
  await expect(page.getByRole("button",{name:"Select style",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Save to my collection",exact:true}).click();
  await expect.poll(()=>library.collections[0]?.styles.length||0).toBe(1);
  expect(library.collections[0].styles[0].examples).toHaveLength(4);
  expect(library.collections[0].styles[0].examples.every(image=>image.localUrl.startsWith("/outputs/"))).toBe(true);
  await expect(page.getByRole("button",{name:"Remove from my collection",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Close style details",exact:true}).click();
  await expect(page.getByRole("button",{name:"Remove from collection: Ink drawing",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("textbox",{name:"Search looks",exact:true}).fill("missing");
  await expect(page.locator(".stylebuilder-tile")).toHaveCount(0);
  await page.getByRole("combobox",{name:"Looks source",exact:true}).click(); await page.getByRole("option",{name:"My collection",exact:true}).click();
  await page.getByRole("textbox",{name:"Search looks",exact:true}).fill("");
  await expect(page.locator(".stylebuilder-tile")).toHaveCount(1);
  await expect(page.getByLabel("Style direction",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Start",exact:true})).toHaveCount(0);
  await expect(page.locator(".stylebuilder-editor")).toHaveCount(0);
  expect(requests.some(item=>item.path==="/api/node/generate-image")).toBe(false);
  await page.getByRole("button",{name:"View Ink drawing",exact:true}).click();
  await page.getByRole("button",{name:"Use in Style",exact:true}).click();
  await expect.poll(()=>library.collections[0]?.styles[0]?.styleAnalysis?.stylePrompt||"").toContain("Astra:");
  await page.getByRole("button",{name:"Close style details",exact:true}).click();
  await page.getByRole("button",{name:"Nodes",exact:true}).click();
  const createdPicker=page.locator('.react-flow__node:not([data-id="existing-style"])').getByLabel("Look",{exact:true});
  await expect(createdPicker.locator("option:checked")).toHaveText("Ink drawing");
  const existingPicker=page.locator('.react-flow__node[data-id="existing-style"]').getByLabel("Look",{exact:true});
  await expect(existingPicker.getByRole("option",{name:"Ink drawing",exact:true})).toHaveCount(1);
  await existingPicker.selectOption({label:"Ink drawing"});
  await expect(existingPicker.locator("option:checked")).toHaveText("Ink drawing");
  await expect(page.getByLabel("Custom library style description")).toHaveCount(0);
  expect(library.collections[0].styles).toHaveLength(1);
  expect(library.collections[0].styles[0].prompt).toBe("Fine ink lines on warm paper.");
  expect(errors).toEqual([]);
});

test("A catalog look must save before its node is created, with retry after a collection conflict",async({page})=>{
  const {errors}=await openFixture(page,{count:1});await mockAnalysis(page);let conflict=true;
  let library={version:1,revision:0,collections:[]};
  await page.route("**/api/style-library",route=>{
    if(route.request().method()==="PUT"){
      if(conflict)return route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({error:"Library changed in another window. Reload the library before saving again."})});
      library={...route.request().postDataJSON(),revision:library.revision+1};
    }
    return route.fulfill({contentType:"application/json",body:JSON.stringify(library)});
  });
  const style={id:"warm-ink",name:"Warm ink",sourceUrl:"https://midlibrary.io/library/warm-ink",prompt:"Warm paper and soft ink",examples:[{localUrl:"/outputs/e2e/example.png"}]};
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
  await expect(page.getByRole("dialog",{name:"Style details"}).getByRole("status")).toContainText("description is saved");
  await page.getByRole("button",{name:"Close style details",exact:true}).click();
  await page.getByRole("button",{name:"Nodes",exact:true}).click();
  await expect(page.getByLabel("Look",{exact:true}).locator("option:checked")).toHaveText("Warm ink");
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

test("Unstarring removes saved copies immediately and after reload while retaining workflow snapshots",async({page})=>{
  const look={id:"ink-catalog",name:"Ink drawing",sourceUrl:"https://midlibrary.io/library/ink-drawing",prompt:"Fine ink on warm paper",examples:[],detailAvailable:true};
  const saved={...look,id:"saved-ink"};
  const other={id:"other",name:"Other look",prompt:"Pastel shapes",examples:[]};
  let library={version:1,revision:0,collections:[{id:"first",name:"First",styles:[saved,other]},{id:"second",name:"Second",styles:[{...saved,id:"second-copy"}]}]},conflict=true;
  const fixture={nodes:[
    {id:"style",type:"style",x:20,y:20,data:{title:"Style",stylePreset:"None",libraryStyle:saved}},
    {id:"board",type:"transfer",x:450,y:20,data:{title:"Mood Board",libraryBoard:true,libraryBoardPrompt:look.prompt,transferImages:[{id:"sample",localUrl:"/outputs/e2e/reference.png"}],resultUrl:"/outputs/e2e/board.png",fileName:"MOOD_BOARD.png",locked:true,activated:true}}
  ],edges:[],groups:[],viewport:{x:0,y:0,scale:1}};
  const {errors,requests}=await openFixture(page,{fixture});
  await mockAnalysis(page);
  await page.route("**/api/style-library",route=>{
    if(route.request().method()==="PUT"){
      if(conflict)return route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({error:"Library changed in another window. Reload the library before saving again."})});
      library={...route.request().postDataJSON(),revision:library.revision+1};
    }
    return route.fulfill({contentType:"application/json",body:JSON.stringify(library)});
  });
  await page.route("**/api/style-library/catalog?**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({ready:true,indexed:1,total:1,categories:[],styles:[look]})}));
  await page.route("**/api/style-library/catalog/ink-catalog",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({style:look})}));
  await page.getByRole("button",{name:"Looks",exact:true}).click();
  await page.getByRole("combobox",{name:"Looks source",exact:true}).click(); await page.getByRole("option",{name:"My collection",exact:true}).click();
  const remove=page.getByRole("button",{name:"Remove from collection: Ink drawing",exact:true});
  await remove.click();
  await expect(page.getByRole("alert")).toContainText("Library changed in another window");
  await expect(remove).toHaveAttribute("aria-pressed","true");
  expect(library.collections[0].styles).toHaveLength(2);
  conflict=false;await remove.click();
  await expect(page.getByRole("button",{name:"View Ink drawing",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"View Other look",exact:true})).toBeVisible();
  expect(library.collections[0].styles.map(style=>style.name)).toEqual(["Other look"]);
  expect(library.collections[1].styles).toHaveLength(0);
  await page.getByRole("combobox",{name:"Looks source",exact:true}).click(); await page.getByRole("option",{name:"Catalog",exact:true}).click();
  await expect(page.getByRole("button",{name:"Save to collection: Ink drawing",exact:true})).toHaveAttribute("aria-pressed","false");
  await page.getByRole("button",{name:"View Ink drawing",exact:true}).click();
  await page.getByRole("button",{name:"Save to my collection",exact:true}).click();
  await expect(page.getByRole("button",{name:"Remove from my collection",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Remove from my collection",exact:true}).click();
  await expect(page.getByRole("button",{name:"Save to my collection",exact:true})).toHaveAttribute("aria-pressed","false");
  await page.getByRole("button",{name:"Close style details",exact:true}).click();
  await page.reload();await page.getByRole("button",{name:"Looks",exact:true}).click();
  await page.getByRole("combobox",{name:"Looks source",exact:true}).click(); await page.getByRole("option",{name:"My collection",exact:true}).click();
  await expect(page.getByRole("button",{name:"View Ink drawing",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Nodes",exact:true}).click();
  await expect(page.getByLabel("Look",{exact:true}).locator("option:checked")).toHaveText("Ink drawing");
  await expect(page.getByLabel("Look",{exact:true}).locator('optgroup[label="Saved with workflow"] option')).toHaveCount(1);
  await expect(page.getByTitle("Unlock mood board",{exact:true})).toBeVisible();
  const snapshot=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")));
  expect(snapshot.nodes.find(node=>node.id==="style").data.libraryStyle.prompt).toBe(look.prompt);
  expect(snapshot.nodes.find(node=>node.id==="board").data.resultUrl).toBe("/outputs/e2e/board.png");
  expect(requests.some(item=>item.path==="/api/node/generate-image")).toBe(false);
  expect(errors).toEqual([]);
});
