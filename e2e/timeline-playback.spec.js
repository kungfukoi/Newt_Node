import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';

test('Timeline J/K/L shuttles the focused transport and leaves text inputs alone', async ({ page }) => {
  const { errors } = await openFixture(page, { timeline: true, scale: 0.7 });
  const node = page.locator('[data-node-card-id="timeline"]');
  const body = node.locator('.assembly-node-body');
  const video = node.locator('.assembly-media-pool video');
  const canvas = node.locator('.assembly-frame-canvas');
  const frame = async () => Number((await node.locator('.assembly-frame-number').textContent()).match(/\d+/)[0]);

  await body.press('l');
  await expect.poll(frame).toBeGreaterThan(8);
  await body.press('l');
  await expect.poll(() => video.evaluate(element => element.playbackRate)).toBe(2);
  await body.press('k');
  await expect(node.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  const stoppedFrame = await frame();
  const stoppedImage = await canvas.evaluate(element => element.toDataURL());
  await body.press('j');
  await expect.poll(frame).toBeLessThan(stoppedFrame - 2);
  await expect.poll(() => canvas.evaluate(element => element.toDataURL())).not.toBe(stoppedImage);
  await body.press('k');
  await expect(node.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  const input = await body.evaluateHandle(element => element.appendChild(document.createElement('input')));
  await input.press('l');
  expect(await input.evaluate(element => element.value)).toBe('l');
  await expect(node.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

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
