import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';
test('authored shots preserve text and cameras through planning and reload',async({page})=>{
 await page.addInitScript(()=>{if(!sessionStorage.getItem('seedance-node-editor-draft-v1'))sessionStorage.setItem('seedance-node-editor-draft-v1',JSON.stringify({nodes:[{id:'board',type:'storyboard',x:10,y:10,data:{title:'Board',storyboardTab:'setup',storyboardApproach:'Shot List',sceneDescription:'',useInternalStoryboardCharacters:false,storyboardFrames:[{id:'s1',number:1,shotDescription:'The door opens',prompt:'',shot:'WS',lens:'35mm',angle:'None'}]}}],edges:[],groups:[],viewport:{x:0,y:0,scale:.7}}))});
 await openFixture(page,{count:1,settings:{falKeyConfigured:true,modelProviderPreferences:{llm:'fal'}}});const card=page.locator('[data-node-card-id="board"]');
 await expect(card.getByLabel('Shot 1 description')).toHaveValue('The door opens');await card.getByLabel('Shot 1 lens').selectOption('85mm');
 let calls=0;await page.route('**/api/node/storyboard-plan-v2',r=>{calls++;const b=r.request().postDataJSON();expect(b.shots[0].lens).toBe('85mm');return r.fulfill({json:{skillVersion:'2.2.0',plan:{sceneTitle:'Door',frames:b.shots.map(s=>({...s,prompt:'A door opens',beat:'Door',shotId:s.id,phase:'single',cast:[],spatial:null}))}}})});
 await card.getByRole('button',{name:'Plan Shots',exact:true}).click();await expect.poll(()=>calls).toBe(1);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('seedance-node-editor-draft-v1')).nodes[0].data.storyboardFrames[0].shotPlanSource)).toBeTruthy();
 await page.reload();await page.getByRole('button',{name:'Nodes',exact:true}).click();await card.getByRole('tab',{name:'Storyboard Setup',exact:true}).click();await expect(card.getByLabel('Shot 1 description')).toHaveValue('The door opens');await expect(card.getByLabel('Shot 1 lens')).toHaveValue('85mm');
});
