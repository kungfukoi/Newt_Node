import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';
const position = locator => locator.evaluate(el => { const values=el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);return {x:Number(values[1]),y:Number(values[2])}; });
// Header centers can hit Rename or the color picker with platform-specific fonts.
// Use the decorative icon as a stable, non-interactive selection and drag surface.
const dragHandle = card => card.locator('.node-title-label > svg').first();
async function drag(page,card,dx,dy){const box=await dragHandle(card).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:8});await page.mouse.up();}
test('snap is optional, persists, supports Alt, undo and existing zoom controls',async({page},info)=>{
 const {errors}=await openFixture(page,{count:2,scale:1});
 const snap=page.getByRole('button',{name:'Snap to grid',exact:true});await expect(snap).toHaveAttribute('aria-pressed','false');
 const card=page.locator('[data-node-card-id="fixture-0"]'),flow=page.locator('.react-flow__node[data-id="fixture-0"]');
 await dragHandle(card).click();await expect(flow).toHaveClass(/selected/);const initial=await position(flow);await snap.click();await expect(snap).toHaveAttribute('aria-pressed','true');expect(await position(flow)).toEqual(initial);
 await drag(page,card,43,37);await expect.poll(()=>position(flow)).not.toEqual(initial);let moved=await position(flow);expect(moved.x%28).toBe(0);expect(moved.y%28).toBe(0);
 await page.keyboard.press('ControlOrMeta+z');await expect.poll(()=>position(flow)).toEqual(initial);
 await page.keyboard.down('Alt');await drag(page,card,43,37);await page.keyboard.up('Alt');await expect.poll(()=>position(flow)).not.toEqual(initial);moved=await position(flow);expect(moved.x%28===0&&moved.y%28===0).toBe(false);
 await page.getByRole('button',{name:'Zoom out',exact:true}).click();await expect(page.getByRole('button',{name:'Reset zoom',exact:true})).not.toHaveText('100%');
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Reset zoom',exact:true}).click();await expect(page.getByRole('button',{name:'Reset zoom',exact:true})).toHaveText('100%');
 await page.screenshot({path:info.outputPath('snap-and-zoom.png')});await page.reload();await page.getByRole('button',{name:'Nodes',exact:true}).click();await expect(snap).toHaveAttribute('aria-pressed','true');expect(errors).toEqual([]);
});
test('snapping multiple nodes preserves their spacing',async({page})=>{
 await openFixture(page,{count:2,scale:1});const a=page.locator('.react-flow__node[data-id="fixture-0"]'),b=page.locator('.react-flow__node[data-id="fixture-1"]');
 await dragHandle(a).click();await dragHandle(b).click({modifiers:['Shift']});await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
 const first=await position(a),second=await position(b);await page.getByRole('button',{name:'Snap to grid',exact:true}).click();await drag(page,a,43,37);await expect.poll(()=>position(a)).not.toEqual(first);await expect.poll(()=>position(b)).not.toEqual(second);const nextA=await position(a),nextB=await position(b);expect(nextB.x-nextA.x).toBe(second.x-first.x);expect(nextB.y-nextA.y).toBe(second.y-first.y);
});
