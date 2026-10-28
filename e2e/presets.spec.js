import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openFixture } from './helpers.mjs';
test('built-in presets insert as editable nodes and cannot be deleted',async({page})=>{
 const manifest=JSON.parse(await readFile('server/system-newt-presets/manifest.json','utf8'));
 const presets=await Promise.all(manifest.presets.map(async e=>({...JSON.parse(await readFile(`server/system-newt-presets/${e.id}.json`,'utf8')),isSystem:true})));
 const {errors}=await openFixture(page,{count:1,scale:0.5});
 await page.route('**/api/newt-presets',r=>r.fulfill({json:presets.map(p=>({...p,nodeCount:p.graph.nodes.length}))}));
 await page.route('**/api/newt-presets/*',r=>r.fulfill({json:presets.find(p=>r.request().url().endsWith(p.id))}));
 await page.getByRole('toolbar',{name:'Canvas menu bar'}).getByRole('button',{name:'Presets',exact:true}).click();
 await page.getByRole('button',{name:'Refresh presets',exact:true}).click();
 for(const p of presets){await page.getByRole('combobox',{name:'Newt Preset',exact:true}).selectOption(p.id);await expect(page.getByRole('button',{name:'Delete preset',exact:true})).toBeDisabled();const before=await page.locator('[data-node-card-id]').count();await page.getByRole('button',{name:'Insert preset',exact:true}).click();await expect(page.locator('[data-node-card-id]')).toHaveCount(before+p.graph.nodes.length);}
 expect(errors).toEqual([]);
});

test('toolbar preset library preserves bindings, saves selections and deletes personal presets', async ({ page }, testInfo) => {
 const source = { id: 'source', type: 'image', x: 20, y: 40, data: { title: 'Source image', resultUrl: '/outputs/e2e/source.png' } };
 await page.addInitScript(source => sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify({ nodes: [source], edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 } })), source);
 const { errors } = await openFixture(page, { count: 1 });
 const slots = [{ nodeId: 'reference', type: 'image', role: 'Image', label: 'Reference image' }];
 const preset = { id: 'personal-preset', name: 'Product edit', nodeCount: 2, slots, graph: {
   nodes: [{ ...source, id: 'reference', x: 0, y: 0 }, { id: 'model', type: 'imageModel', x: 400, y: 0, data: { title: 'Product model', prompt: 'Keep this product', settingsOpen: false } }],
   edges: [{ id: 'reference-model', from: { nodeId: 'reference', port: 'imageOut' }, to: { nodeId: 'model', port: 'imagePromptIn' } }], groups: [], slots
 } };
 let saved, deleted = '';
 await page.route('**/api/newt-presets', async route => {
   if (route.request().method() === 'POST') {
     saved = route.request().postDataJSON();
     await route.fulfill({ json: { id: 'saved-selection', ...saved } });
   } else await route.fulfill({ json: [preset] });
 });
 await page.route('**/api/newt-presets/*', async route => {
   if (route.request().method() === 'DELETE') { deleted = route.request().url().split('/').at(-1); await route.fulfill({ json: { ok: true } }); }
   else await route.fulfill({ json: preset });
 });
 const bar = page.getByRole('toolbar', { name: 'Canvas menu bar' });
 await expect(page.locator('.node-toolbar .newt-preset-library')).toHaveCount(0);
 await expect(page.locator('.node-workspace')).toHaveClass(/toolbar-collapsed/);
 await bar.getByRole('button', { name: 'Presets', exact: true }).focus();
 await page.keyboard.press('ArrowDown');
 const library = page.getByRole('dialog', { name: 'Workflow presets', exact: true });
 await expect(library.getByRole('combobox', { name: 'Newt Preset', exact: true })).toBeFocused();
 await expect(library.getByRole('button', { name: 'Save selection as preset…' })).toBeDisabled();
 await library.getByRole('button', { name: 'Refresh presets', exact: true }).click();
 await library.getByRole('combobox', { name: 'Newt Preset', exact: true }).selectOption(preset.id);
 await library.getByRole('combobox', { name: 'Reference image', exact: true }).selectOption('source');
 await page.screenshot({ path: testInfo.outputPath('toolbar-presets-desktop.png') });
 await library.getByRole('button', { name: 'Insert preset', exact: true }).click();
 await expect(page.locator('[data-node-card-id]')).toHaveCount(2);
 await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('seedance-node-editor-draft-v1')).edges.some(edge => edge.from.nodeId === 'source' && edge.to.port === 'imagePromptIn'))).toBe(true);
 await library.getByRole('button', { name: 'Save selection as preset…' }).click();
 const saveDialog = page.getByRole('dialog', { name: 'Newt Preset', exact: true });
 await saveDialog.getByLabel('Preset name', { exact: true }).fill('Selected product edit');
 await saveDialog.getByRole('button', { name: 'Save', exact: true }).click();
 await expect(saveDialog).toHaveCount(0);
 expect(saved.name).toBe('Selected product edit'); expect(saved.graph.nodes).toHaveLength(1);
 await bar.getByRole('button', { name: 'Presets', exact: true }).click();
 await expect(library.getByRole('combobox', { name: 'Newt Preset', exact: true })).toHaveValue('saved-selection');
 page.once('dialog', dialog => dialog.accept());
 await library.getByRole('button', { name: 'Delete preset', exact: true }).click();
 await expect.poll(() => deleted).toBe('saved-selection');
 await expect(library.getByRole('combobox', { name: 'Newt Preset', exact: true })).toHaveValue('');
 await page.setViewportSize({ width: 375, height: 812 });
 await expect(library).toBeVisible();
 const bounds = await library.boundingBox();
 expect(bounds.x).toBeGreaterThanOrEqual(15); expect(bounds.x + bounds.width).toBeLessThanOrEqual(360);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 await page.screenshot({ path: testInfo.outputPath('toolbar-presets-mobile.png') });
 await page.keyboard.press('Escape');
 await expect(library).toHaveCount(0);
 await expect(bar.getByRole('button', { name: 'Presets', exact: true })).toBeFocused();
 expect(errors).toEqual([]);
});
