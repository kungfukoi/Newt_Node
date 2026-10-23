import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';

test('Timeline holds the full composition during a decoder stall instead of flashing the lower clip', async ({ page }) => {
  const { fixture, errors } = await openFixture(page, { timeline: true, scale: 0.7 });
  const timeline = fixture.nodes.find(node => node.id === 'timeline');
  timeline.data.assembly.media.push({ id: 'lower', type: 'image', url: '/outputs/e2e/landscape.png', duration: 2, width: 640, height: 360 });
  timeline.data.assembly.tracks.push({ id: 'v2', type: 'video', clips: [{ id: 'lower-clip', mediaId: 'lower', start: 0, duration: 2, sourceIn: 0, sourceDuration: 2 }] });
  await page.addInitScript(value => sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify(value)), fixture);
  await page.reload(); await page.getByRole('button', { name: 'Nodes', exact: true }).click();
  const node = page.locator('[data-node-card-id="timeline"]');
  const video = node.locator('.assembly-media-pool video');
  const canvas = node.locator('.assembly-frame-canvas');
  await expect.poll(() => node.locator('.assembly-media-pool img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await node.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.15);
  await video.evaluate(element => { Object.defineProperty(element, 'readyState', { configurable: true, get: () => 1 }); Object.defineProperty(element, 'seeking', { configurable: true, get: () => true }); });
  const held = await canvas.evaluate(element => element.toDataURL());
  await page.evaluate(() => new Promise(resolve => { let n = 0; const tick = () => ++n >= 15 ? resolve() : requestAnimationFrame(tick); requestAnimationFrame(tick); }));
  expect(await canvas.evaluate(element => element.toDataURL())).toBe(held);
  await video.evaluate(element => { delete element.readyState; delete element.seeking; });
  await expect.poll(() => canvas.evaluate(element => element.toDataURL())).not.toBe(held);
  expect(errors).toEqual([]);
});

test('Timeline playback keeps a decoded viewer frame across live updates', async ({ page }) => {
  const { errors } = await openFixture(page, { timeline: true, scale: 0.7 });
  const image = page.locator('[data-node-card-id="viewer"] img').first();
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.locator('[data-node-card-id="timeline"]').getByRole('button', { name: 'Play', exact: true }).click();
  const samples = await image.evaluate(img => new Promise(resolve => {
    let frames = 0, missing = 0; const urls = new Set();
    function sample() {
      urls.add(img.src);
      if (!img.complete || !img.naturalWidth) missing++;
      if (++frames >= 70) resolve({ missing, updates: urls.size });
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  expect(samples.updates).toBeGreaterThan(8);
  expect(samples.missing).toBe(0);
  expect(errors).toEqual([]);
});
