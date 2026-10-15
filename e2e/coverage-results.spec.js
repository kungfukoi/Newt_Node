import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';

test('Utility Coverage displays completed shots before the batch ends and retains them on Stop', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify({
    nodes: [
      { id: 'source', type: 'image', x: 10, y: 80, data: { resultUrl: '/outputs/e2e/landscape.png' } },
      { id: 'coverage', type: 'utility', x: 500, y: 80, data: { utilityMode: 'image', utilityImageModel: 'Coverage', model: 'Nano Banana Pro', coverageMethod: 'Standard' } }
    ],
    edges: [{ id: 'input', from: { nodeId: 'source', port: 'imageOut' }, to: { nodeId: 'coverage', port: 'imageIn' } }],
    groups: [], viewport: { x: 0, y: 0, scale: 0.8 }
  })));
  const { errors } = await openFixture(page, { count: 2 });
  let requests = 0, finish;
  await page.route('**/api/node/generate-image', async route => {
    requests++;
    if (requests > 1) await new Promise(resolve => { finish = resolve; });
    await route.fulfill({ json: { images: [{ localUrl: '/outputs/e2e/landscape.png' }] } });
  });
  const node = page.locator('[data-node-card-id="coverage"]');
  await node.locator('.run-node-button').click();
  await expect(node.locator('.result-pane img')).toBeVisible();
  await expect.poll(() => Boolean(finish)).toBe(true);
  await page.getByRole('button', { name: 'Stop all active canvas nodes', exact: true }).click();
  finish();
  await expect(node.locator('.result-pane img')).toBeVisible();
  await expect(node.locator('.run-node-button')).toBeEnabled();
  await page.waitForTimeout(1500);
  expect(requests).toBe(2);
  expect(errors).toEqual([]);
});
