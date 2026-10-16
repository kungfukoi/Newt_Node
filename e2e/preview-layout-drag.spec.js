import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';

async function drag(page, source, x, y) {
  const box = await source.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2, { steps: 3 });
  await page.mouse.move(x, y, { steps: 15 });
  await page.mouse.move(x, y);
  await page.mouse.up();
}

test('Preview Layout reorders images and copies full resolution images to canvas', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seedance-node-editor-draft-v1')) sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify({
      nodes: [{ id: 'preview', type: 'preview', x: 30, y: 30, data: { title: 'Preview', previewTab: 'layout', nodeWidth: 850,
        previewLayoutItems: ['A', 'B', 'C'].map((label, index) => ({ id: label, label, type: 'image', url: '/outputs/e2e/' + label + '.png', width: 1600, height: 900 }))
      } }], edges: [], groups: [], viewport: { x: 0, y: 0, scale: 0.8 }
    }));
  });
  const { errors } = await openFixture(page, { count: 1 });
  const node = page.locator('[data-node-card-id="preview"]');
  const images = node.locator('.preview-layout-item img');
  await expect(images).toHaveCount(3);
  const position = await node.boundingBox();
  const target = await images.nth(0).boundingBox();
  await drag(page, images.nth(2), target.x + target.width * .2, target.y + target.height / 2);
  await expect.poll(() => images.evaluateAll(items => items.map(item => item.alt))).toEqual(['C', 'A', 'B']);
  const after = await node.boundingBox();
  expect(after.x).toBeCloseTo(position.x, 0);
  expect(after.y).toBeCloseTo(position.y, 0);
  const last = await images.nth(2).boundingBox();
  await drag(page, images.nth(0), last.x + last.width * .8, last.y + last.height / 2);
  await expect.poll(() => images.evaluateAll(items => items.map(item => item.alt))).toEqual(['A', 'B', 'C']);
  await drag(page, images.nth(2), 1150, 650);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(images).toHaveCount(3);
  const newImage = page.locator('.node-type-image');
  await expect(newImage).toHaveCount(1);
  await expect(newImage.locator('img').first()).toHaveAttribute('data-full-resolution-url', '/outputs/e2e/C.png');
  await page.waitForTimeout(700);
  await page.reload();
  await page.getByRole('button', { name: 'Nodes', exact: true }).click();
  await expect.poll(() => images.evaluateAll(items => items.map(item => item.alt))).toEqual(['A', 'B', 'C']);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('Layout lightbox Left/Right follows mixed media order and wraps', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify({
    nodes: [{ id: 'preview', type: 'preview', x: 30, y: 30, data: { previewTab: 'layout', nodeWidth: 850,
      previewLayoutItems: [
        { id: 'A', label: 'Image A', url: '/outputs/e2e/A.png', type: 'image', width: 1600, height: 900 },
        { id: 'B', label: 'Video B', url: '/outputs/e2e/motion.mp4', type: 'video', width: 1600, height: 900 },
        { id: 'C', label: 'Image C', url: '/outputs/e2e/C.png', type: 'image', width: 1600, height: 900 }
      ]
    } }], edges: [], groups: [], viewport: { x: 0, y: 0, scale: .8 }
  })));
  const { errors } = await openFixture(page, { count: 1 });
  await page.locator('.preview-layout-item').first().dblclick();
  const stage = page.locator('.output-lightbox-stage');
  await expect(stage.locator('img')).toHaveAttribute('alt', 'Image A');
  await page.keyboard.press('ArrowRight');
  await expect(stage.locator('video')).toHaveAttribute('src', /motion.mp4/);
  await page.keyboard.press('ArrowRight');
  await expect(stage.locator('img')).toHaveAttribute('alt', 'Image C');
  await page.keyboard.press('ArrowRight');
  await expect(stage.locator('img')).toHaveAttribute('alt', 'Image A');
  await page.keyboard.press('ArrowLeft');
  await expect(stage.locator('img')).toHaveAttribute('alt', 'Image C');
  await page.keyboard.press('Escape');
  await expect(stage).toHaveCount(0);
  expect(errors).toEqual([]);
});
