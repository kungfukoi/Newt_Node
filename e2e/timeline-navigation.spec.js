import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';

test('Timeline tracks scroll horizontally and Fit resets scrolling without changing clips', async ({ page }) => {
  await openFixture(page, { timeline: true, scale: 0.7 });
  const card = page.locator('[data-node-card-id="timeline"]');
  const tracks = card.locator('.assembly-timeline-scroll');
  const scrollLeft = () => tracks.evaluate(element => element.scrollLeft);
  const clips = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('seedance-node-editor-draft-v1'))
    .nodes.find(node => node.id === 'timeline').data.assembly.tracks);
  const before = await clips();

  await expect(card.getByLabel('Timeline horizontal scroll')).toHaveCount(0);
  await card.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await tracks.hover();
  await page.mouse.wheel(200, 0);
  await expect.poll(scrollLeft).toBeGreaterThan(0);
  await card.getByRole('button', { name: 'Fit Timeline', exact: true }).click();
  await expect.poll(scrollLeft).toBe(0);
  await expect.poll(clips).toEqual(before);
});
