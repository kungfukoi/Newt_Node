import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { canvasFixture } from "./fixtures.mjs";

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


test("Timeline follows one active video per input and updates existing clips after upload", async ({ page }) => {
  const fixture = canvasFixture({ timeline: true, scale: .8 });
  const shots = ['batch-one', 'batch-two', 'batch-three'];
  fixture.nodes.push({ id: 'batch-source', type: 'videoModel', x: 1700, y: 20, data: {
    title: 'Batch source', model: 'seedance-1.5-pro', resultUrl: '/outputs/e2e/batch-one.mp4',
    resultItems: shots.map(name => ({ url: `/outputs/e2e/${name}.mp4`, type: 'video', label: name }))
  }});
  fixture.nodes.push({ id: 'other-source', type: 'video', x: 1700, y: 600, data: {
    title: 'Other source', videoUrl: '/outputs/e2e/motion.mp4', resultUrl: '/outputs/e2e/motion.mp4'
  }});
  fixture.edges.push(...['batch-source', 'other-source'].map(id => ({ id: `edge-${id}`, from: { nodeId: id, port: 'videoOut' }, to: { nodeId: 'timeline', port: 'videoIn' } })));
  const { errors } = await openFixture(page, { fixture });
  const bin = page.getByLabel("Timeline media bin", { exact: true });
  await expect(bin.locator(".assembly-media-bin-item")).toHaveCount(2);
  await expect(bin.locator('video[src*="batch-one.mp4"]')).toHaveCount(1);
  await expect(bin.locator('video[src*="batch-two.mp4"], video[src*="batch-three.mp4"]')).toHaveCount(0);

  await page.route("**/api/node/upload-video-asset", route => route.fulfill({ json: { asset: {
    localUrl: "/outputs/e2e/replacement.mp4", mediaType: "video", mimeType: "video/mp4", fileName: "replacement.mp4"
  } } }));
  await page.locator('[data-node-card-id="other-source"] input[type="file"]').setInputFiles("e2e/.generated/motion.mp4");
  await expect(bin.locator('video[src*="replacement.mp4"]')).toHaveCount(1);
  await expect(bin.locator(".assembly-media-bin-item")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => {
    const timeline = JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "timeline").data.assembly;
    const clip = timeline.tracks.flatMap(track => track.clips).find(clip => clip.id === "clip");
    return { mediaId: clip?.mediaId, url: timeline.media.find(media => media.id === clip?.mediaId)?.url };
  })).toEqual({ mediaId: "media", url: "/outputs/e2e/replacement.mp4" });
  expect(errors).toEqual([]);
});
