import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openFixture } from './helpers.mjs';
test('built-in presets insert as editable nodes and cannot be deleted',async({page})=>{
 const manifest=JSON.parse(await readFile('server/system-newt-presets/manifest.json','utf8'));
 const presets=await Promise.all(manifest.presets.map(async e=>({...JSON.parse(await readFile(`server/system-newt-presets/${e.id}.json`,'utf8')),isSystem:true})));
 const {errors}=await openFixture(page,{count:1,scale:0.5});
 await page.route('**/api/newt-presets',r=>r.fulfill({json:presets.map(p=>({...p,nodeCount:p.graph.nodes.length}))}));
 await page.route('**/api/newt-presets/*',r=>r.fulfill({json:presets.find(p=>r.request().url().endsWith(p.id))}));
 if(await page.getByRole('button',{name:'Show node palette',exact:true}).isVisible()) await page.getByRole('button',{name:'Show node palette',exact:true}).click();
 await page.getByRole('button',{name:'Refresh presets',exact:true}).click();
 for(const p of presets){await page.getByRole('combobox',{name:'Newt Preset',exact:true}).selectOption(p.id);await expect(page.getByRole('button',{name:'Delete preset',exact:true})).toBeDisabled();const before=await page.locator('[data-node-card-id]').count();await page.getByRole('button',{name:'Insert preset',exact:true}).click();await expect(page.locator('[data-node-card-id]')).toHaveCount(before+p.graph.nodes.length);}
 expect(errors).toEqual([]);
});
