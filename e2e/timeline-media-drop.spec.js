import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Timeline accepts successive video drops onto an occupied media bin", async ({ page }) => {
  const { errors } = await openFixture(page, { timeline: true, scale: .8 });
  const bin = page.locator('[aria-label="Timeline media bin"]');
  await expect(bin.locator('.assembly-media-bin-item')).toHaveCount(1);
  for (const name of ["second", "third", "fourth"]) {
    await bin.locator('video').first().evaluate((target, name) => {
      const transfer = new DataTransfer();
      transfer.setData('application/x-newtnode-output', JSON.stringify({ id: name, sourceNodeId: 'video-source', sourcePort: 'videoOut', url: `/outputs/e2e/${name}.mp4`, type: 'video', label: name }));
      // Embedded/native media may swallow bubbling events. The bin must accept
      // drops in capture, before any populated thumbnail can consume them.
      target.addEventListener('drop', event => event.stopPropagation(), { once: true });
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, name);
    await expect(bin.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(bin.locator('.assembly-media-bin-item')).toHaveCount(4);
  await page.reload(); await page.getByRole('button', { name: 'Nodes', exact: true }).click();
  await expect(bin.locator('.assembly-media-bin-item')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("Timeline recovers a preview drag ending on an occupied bin when native drop is missing", async ({ page }) => {
  const { errors } = await openFixture(page, { timeline: true, scale: .8 });
  const bin = page.locator('[aria-label="Timeline media bin"]');
  for (const name of ['second', 'third', 'third']) {
    await bin.locator('video').first().evaluate((target, name) => {
      const rect = target.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent('newtnode-output-drag-end', { detail: { item: { url: `/outputs/e2e/${name}.mp4`, type: 'video', label: name }, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 } }));
    }, name);
    await expect(bin.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(bin.locator('.assembly-media-bin-item')).toHaveCount(3);
  expect(errors).toEqual([]);
});


test("Timeline media bin widens by dragging its divider and remembers the width", async ({ page }) => {
  const { errors } = await openFixture(page, { timeline: true, scale: .8 });
  const bin = page.locator('[aria-label="Timeline media bin"]');
  const divider = bin.getByRole('separator', { name: 'Media bin width' });
  const before = await bin.boundingBox();
  const handle = await divider.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 80, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await bin.boundingBox()).width).toBeGreaterThan(before.width + 50);
  const saved = await divider.getAttribute('aria-valuenow');
  await page.reload();
  await page.getByRole('button', { name: 'Nodes', exact: true }).click();
  await expect(divider).toHaveAttribute('aria-valuenow', saved);
  await divider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => Number(await divider.getAttribute('aria-valuenow'))).toBe(Number(saved) - 20);
  expect(errors).toEqual([]);
});


test("Timeline imports every connected video result and multiple source nodes", async ({ page }) => {
  const { fixture, errors } = await openFixture(page, { timeline: true, scale: .8 });
  const shots = ['batch-one', 'batch-two', 'batch-three'];
  fixture.nodes.push({ id: 'batch-source', type: 'videoModel', x: 1700, y: 20, data: {
    title: 'Batch source', model: 'seedance-1.5-pro', resultUrl: '/outputs/e2e/batch-one.mp4',
    resultItems: shots.map(name => ({ url: `/outputs/e2e/${name}.mp4`, type: 'video', label: name }))
  }});
  fixture.nodes.push({ id: 'other-source', type: 'video', x: 1700, y: 600, data: {
    title: 'Other source', videoUrl: '/outputs/e2e/other.mp4', resultUrl: '/outputs/e2e/other.mp4'
  }});
  fixture.edges.push(...['batch-source', 'other-source'].map(id => ({ id: `edge-${id}`, from: { nodeId: id, port: 'videoOut' }, to: { nodeId: 'timeline', port: 'videoIn' } })));
  await page.addInitScript(fixture => sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify(fixture)), fixture);
  await page.reload();
  await page.getByRole('button', { name: 'Nodes', exact: true }).click();
  const bin = page.locator('[aria-label="Timeline media bin"]');
  await expect(bin.locator('.assembly-media-bin-item')).toHaveCount(5);
  for (const name of shots) await expect(bin.getByText(name, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
