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

test('Location Coverage scouts nine shots from one image and retains settings after reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seedance-node-editor-draft-v1')) sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify({
      nodes: [
        { id: 'source', type: 'image', x: 10, y: 80, data: { resultUrl: '/outputs/e2e/landscape.png' } },
        { id: 'coverage', type: 'utility', x: 500, y: 80, data: { utilityMode: 'image', utilityImageModel: 'Coverage', model: 'Nano Banana Pro', settingsOpen: true } }
      ],
      edges: [{ id: 'input', from: { nodeId: 'source', port: 'imageOut' }, to: { nodeId: 'coverage', port: 'imageIn' } }],
      groups: [], viewport: { x: 0, y: 0, scale: 0.8 }
    }));
  });
  const { errors } = await openFixture(page, { count: 2 });
  const node = page.locator('[data-node-card-id="coverage"]');
  await node.getByLabel('Coverage', { exact: true }).selectOption('Location');
  await node.getByLabel('Location Type', { exact: true }).selectOption('Exterior');
  await node.getByLabel('Explore', { exact: true }).selectOption('Explore unseen space');
  await page.waitForTimeout(700);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(node.getByLabel('Coverage', { exact: true })).toHaveValue('Location');
  await expect(node.getByLabel('Location Type', { exact: true })).toHaveValue('Exterior');
  await expect(node.getByLabel('Explore', { exact: true })).toHaveValue('Explore unseen space');
  const requests = [];
  await page.route('**/api/node/generate-image', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { images: [{ localUrl: '/outputs/e2e/landscape.png' }] } });
  });
  await node.locator('.run-node-button').click();
  await expect.poll(() => requests.length, { timeout: 45000 }).toBe(9);
  await expect(node.locator('.run-node-button')).toBeEnabled();
  expect(new Set(requests.map(request => request.prompt)).size).toBe(9);
  for (const request of requests) {
    expect(request.prompt).toContain('Location type: Exterior');
    expect(request.prompt).toContain('Explore unseen areas');
    expect(request.imagePromptUrls).toEqual(['/outputs/e2e/landscape.png']);
  }
  expect(errors).toEqual([]);
});
