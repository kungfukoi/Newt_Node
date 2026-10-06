import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
const frames = Array.from({length:3}, (_,i)=>({id:"frame-"+i,number:i+1,shot:"WS",lens:"35mm",angle:"None",beat:"Original beat",prompt:"Original prompt "+i,notes:"",resultUrl:"/outputs/e2e/original-"+i+".png",status:"complete"}));
async function setup(page) {
  await page.addInitScript(frames => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({nodes:[{id:"board",type:"storyboard",x:10,y:10,data:{title:"Board",storyboardTab:"view",sceneDescription:"A bottle on a table",storyboardPlanSceneDescription:"Old scene deliberately changed",storyboardFrames:frames,storyboardAutoQc:false,useInternalStoryboardCharacters:false}}],edges:[],groups:[],viewport:{x:0,y:0,scale:0.7}})); },frames);
  const fixture=await openFixture(page,{count:1,settings:{falKeyConfigured:true,modelProviderPreferences:{imageGeneration:"fal",llm:"fal"}}});
  return { ...fixture, card:page.locator('[data-node-card-id="board"]') };
}
const savedFrames = page => page.evaluate(()=>JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes[0].data.storyboardFrames);
test("selected revisions commit successful replacements and preserve failed and unselected panels", async ({page}, testInfo) => {
  const {card,errors}=await setup(page);let plans=[],images=[];
  await page.route("**/api/node/storyboard-revise",async route=>{const b=route.request().postDataJSON();plans.push(b);await route.fulfill({json:{revision:{frames:b.frames.filter(f=>b.frameIds.includes(f.id)).map(({id,number})=>({id,number,shot:"CU",lens:"85mm",angle:"None",beat:"New beat",prompt:"Revised prompt "+number,notes:"Keep bottle"})),warnings:[]}}});});
  await page.route("**/api/node/generate-image",async route=>{images.push(route.request().postDataJSON());await route.fulfill(images.length===2?{status:502,json:{error:"Mock provider failed"}}:{json:{images:[{localUrl:"/outputs/e2e/revised.png",mimeType:"image/png"}]}});});
  await page.route("**/api/node/storyboard-export-frame",route=>route.fulfill({json:{frame:{localUrl:"/outputs/e2e/revised-export.png",fileName:"revised.png"}}}));
  await card.getByLabel("Select panel 1 for revision").check();await card.getByLabel("Select panel 2 for revision").check();
  await card.getByLabel("Selected panel revision").fill("Move closer, preserve the bottle");
  await card.getByRole("button",{name:"Revise Selected",exact:true}).click();
  await expect(card.getByRole("button",{name:"Revise Selected",exact:true})).toBeEnabled();
  await expect.poll(()=>images.length).toBe(2);
  await expect.poll(async()=> (await savedFrames(page))[0].prompt).toBe("Revised prompt 1");
  const saved=await savedFrames(page);
  expect(saved[0].shot).toBe("CU");expect(saved[0].resultUrl).toBe("/outputs/e2e/revised.png");
  expect(saved[1].prompt).toBe(frames[1].prompt);expect(saved[1].resultUrl).toBe(frames[1].resultUrl);expect(saved[1].error).toContain("Mock provider failed");
  expect(saved[2].prompt).toBe(frames[2].prompt);expect(saved[2].resultUrl).toBe(frames[2].resultUrl);
  expect(plans).toHaveLength(1);expect(plans[0].frames).toHaveLength(3);expect(plans[0].frameIds).toEqual(["frame-0","frame-1"]);
  expect(images[0].storyboardRevision).toBe(true);expect(images[0].imagePromptUrls).toContain(frames[0].resultUrl);
  await page.screenshot({path:testInfo.outputPath("revisions.png")});
  await page.reload();await page.getByRole("button",{name:"Nodes",exact:true}).click();
  await expect(card.getByLabel("Selected panel revision")).toHaveValue("Move closer, preserve the bottle");
  expect((await savedFrames(page))[1].resultUrl).toBe(frames[1].resultUrl);expect(errors).toEqual([]);
});
test("failed revision planning leaves every panel unchanged and submits no images",async({page})=>{
  const {card,errors}=await setup(page);let images=0;
  await page.route("**/api/node/storyboard-revise",route=>route.fulfill({status:400,json:{error:"Revision returned invalid panels"}}));
  await page.route("**/api/node/generate-image",route=>{images++;return route.abort();});
  await card.getByLabel("Select panel 2 for revision").check();await card.getByLabel("Selected panel revision").fill("Closer");await card.getByRole("button",{name:"Revise Selected",exact:true}).click();
  await expect(card.getByText("Revision returned invalid panels",{exact:true})).toBeVisible();
  expect(images).toBe(0);expect((await savedFrames(page)).map(f=>f.resultUrl)).toEqual(frames.map(f=>f.resultUrl));expect(errors).toEqual([]);
});
