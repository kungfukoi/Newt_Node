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
