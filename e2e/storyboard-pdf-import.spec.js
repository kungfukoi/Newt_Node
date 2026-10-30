import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';
test('PDF script import appends authored shots and retains source dialogue',async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('seedance-node-editor-draft-v1',JSON.stringify({nodes:[{id:'board',type:'storyboard',x:10,y:10,data:{title:'Board',storyboardTab:'setup',storyboardApproach:'Shot List',useInternalStoryboardCharacters:false,storyboardFrames:[{id:'s1',number:1,prompt:'',shotDescription:'',shot:'None',lens:'None',angle:'None'}]}}],edges:[],groups:[],viewport:{x:0,y:0,scale:.7}}))});
 await openFixture(page,{count:1,settings:{falKeyConfigured:true}});const card=page.locator('[data-node-card-id="board"]');
 await page.route('**/api/health',r=>r.fulfill({json:{ok:true,routes:{storyboardScriptImport:true}}}));
 await page.route('**/api/node/upload-asset',r=>r.fulfill({json:{asset:{localUrl:'/uploads/script.pdf'}}}));
 await page.route('**/api/node/storyboard-script-*',r=>{const mode=r.request().url().split('-').at(-1);return r.fulfill({json:mode==='inspect'?{digest:'abc',pageCount:1}:mode==='analyze'?{catalog:{scripts:[{title:'Spot',pages:[1],scenes:[],format:'Screenplay',version:'',duration:'',excerpt:'A door',uncertain:false}],warnings:[]}}:{draft:{title:'Spot',needsNarrowing:false,warnings:[],shots:[{description:'A door opens',scene:'Hall',dialogue:'Hello',voiceover:'',onScreenText:'',timing:'',productionNotes:'',pages:[1],shot:'WS',lens:'35mm',angle:'None'}]}}})});
 await card.locator('input[type=file][accept="application/pdf,.pdf"]').setInputFiles({name:'script.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-fixture')});
 await expect(card.getByLabel('Shot 1 description')).toHaveValue('A door opens');await expect(card.getByText('1 shots added',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('seedance-node-editor-draft-v1')).nodes[0].data.storyboardFrames[0].sourceScript?.dialogue)).toBe('Hello');
});
