import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';
test('Director offers Camcorder and preserves its selection after reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seedance-node-editor-draft-v1')) sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify({
      nodes: [{ id: 'director', type: 'skillDirector', x: 30, y: 30, data: { title: 'Director', sceneName: 'Flashlight search' } }],
      edges: [], groups: [], viewport: { x: 0, y: 0, scale: .8 }
    }));
  });
  const { errors } = await openFixture(page, { count: 1 });
  const approach = page.getByRole('combobox', { name: 'Approach', exact: true });
  await approach.selectOption({ label: 'Camcorder' });
  await expect(approach).toHaveValue('camcorder');
  await page.waitForTimeout(700);
  await page.reload();
  await page.getByRole('button', { name: 'Nodes', exact: true }).click();
  await expect(approach).toHaveValue('camcorder');
  expect(errors).toEqual([]);
});
