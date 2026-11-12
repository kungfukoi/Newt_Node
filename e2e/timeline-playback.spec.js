import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';
import { canvasFixture } from './fixtures.mjs';

test('Timeline opens wider with both yellow actions on the second footer row', async ({ page }) => {
  await openFixture(page, { timeline: true, scale: 0.7 });
  const node = page.locator('[data-node-card-id="timeline"]');
  await expect(node).toHaveCSS('width', '1400px');
  const controls = await node.locator('.assembly-footer-controls > *').evaluateAll(items =>
    items.map(item => {
      const { top, bottom } = item.getBoundingClientRect();
      return { bottom, center: (top + bottom) / 2 };
    }));
  expect(Math.max(...controls.map(item => item.center)) - Math.min(...controls.map(item => item.center))).toBeLessThan(1);
  const extract = await node.getByRole('button', { name: 'Extract Frame' }).boundingBox();
  const render = await node.getByRole('button', { name: 'Render Timeline' }).boundingBox();
  expect(extract.y).toBeCloseTo(render.y, 0);
  expect(extract.y).toBeGreaterThan(Math.max(...controls.map(item => item.bottom)));
});

test('Timeline adds a large connected Preview above the tracks that follows its transport', async ({ page }) => {
  const fixture = canvasFixture({ timeline: true, scale: 0.7 });
  fixture.nodes = fixture.nodes.filter(node => node.id === 'timeline');
  fixture.edges = [];
  fixture.nodes[0].data.assembly.outputWidth = 960;
  const { errors } = await openFixture(page, { fixture });
  const node = page.locator('[data-node-card-id="timeline"]');
  const preview = page.locator('.node-card.node-type-preview');
  const image = preview.locator('.preview-stage img');
  const frame = () => image.getAttribute('src');

  await expect(preview).toHaveCount(0);
  await node.getByRole('button', { name: 'Add connected Preview' }).press('Space');
  await expect(preview).toBeInViewport();
  await expect(preview).toHaveCSS('width', '770px');
  const previewBox = await preview.boundingBox();
  const timelineBox = await node.boundingBox();
  expect(previewBox.y + previewBox.height).toBeLessThan(timelineBox.y);
  const centerOffset = (previewBox.x + previewBox.width / 2) - (timelineBox.x + timelineBox.width / 2);
  expect(Math.abs(centerOffset)).toBeLessThan(2);
  const previewId = await preview.getAttribute('data-node-card-id');
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('seedance-node-editor-draft-v1')).edges)).toMatchObject([
    { from: { nodeId: 'timeline', port: 'frameOut' }, to: { nodeId: previewId, port: 'sourceIn' } }
  ]);
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS('object-fit', 'contain');
  await expect.poll(() => image.evaluate(element => element.naturalWidth / element.naturalHeight)).toBeCloseTo(960 / 360, 2);

  const beforeScrub = await frame();
  await node.locator('.assembly-ruler').click({ position: { x: 48, y: 12 } });
  await expect.poll(frame).not.toBe(beforeScrub);
  const beforePlay = await frame();
  await node.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(frame).not.toBe(beforePlay);
  await node.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(errors).toEqual([]);
});

test('New Timeline and connected Preview inherit sizes from the active canvas', async ({ page }) => {
  const fixture = canvasFixture({ timeline: true, scale: 0.6 });
  const [timeline, viewer] = fixture.nodes;
  Object.assign(timeline.data, { nodeWidth: 1600, nodeHeight: 620 });
  Object.assign(viewer.data, { nodeWidth: 980, nodeHeight: 690 });
  fixture.canvases = [{ id: 'current', name: 'Current' }, { id: 'other', name: 'Other' }];
  fixture.activeCanvasId = 'current';
  timeline.canvasId = viewer.canvasId = 'current';
  fixture.nodes.push(
    { ...timeline, id: 'other-timeline', canvasId: 'other', data: { ...timeline.data, nodeWidth: 1800 } },
    { ...viewer, id: 'other-preview', canvasId: 'other', data: { ...viewer.data, nodeWidth: 1100 } }
  );
  fixture.edges.push({ id: 'other-wire', from: { nodeId: 'other-timeline', port: 'frameOut' }, to: { nodeId: 'other-preview', port: 'sourceIn' } });
  await openFixture(page, { fixture });
  await page.locator('.node-canvas').click({ button: 'right', position: { x: 1200, y: 500 } });
  await page.locator('.node-context-menu').getByRole('button', { name: 'Timeline', exact: true }).click();
  const addedTimeline = page.locator('.node-card.node-type-assembly:not([data-node-card-id="timeline"])');
  await expect(addedTimeline).toHaveCSS('width', '1600px');
  await expect(addedTimeline).toHaveCSS('height', '620px');
  await addedTimeline.getByRole('button', { name: 'Add connected Preview' }).press('Space');
  const addedPreview = page.locator('.node-card.node-type-preview:not([data-node-card-id="viewer"])');
  await expect(addedPreview).toHaveCSS('width', '980px');
  await expect(addedPreview).toHaveCSS('height', '690px');
});

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
  const fixture = canvasFixture({ timeline: true, scale: 0.7 });
  // Without a Live Preview consumer this exercises the uncached composition path.
  fixture.nodes = fixture.nodes.filter(node => node.id !== 'viewer');
  fixture.edges = [];
  const timeline = fixture.nodes.find(node => node.id === 'timeline');
  timeline.data.assembly.media.push({ id: 'lower', type: 'image', url: '/outputs/e2e/landscape.png', duration: 2, width: 640, height: 360 });
  timeline.data.assembly.tracks.push({ id: 'v2', type: 'video', clips: [{ id: 'lower-clip', mediaId: 'lower', start: 0, duration: 2, sourceIn: 0, sourceDuration: 2 }] });
  const { errors } = await openFixture(page, { fixture });
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

test('Timeline warms a complete layered preview and plays cached frames through a live decoder stall', async ({ page }) => {
  const fixture = canvasFixture({ timeline: true, scale: 0.7 });
  const { assembly } = fixture.nodes.find(node => node.id === 'timeline').data;
  const background = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><path fill="lime" d="M0 0h640v360H0z"/></svg>');
  assembly.tracks[0].clips[0].scale = 50;
  assembly.media.push({ id: 'background', type: 'image', url: background, duration: 2, width: 640, height: 360 });
  assembly.tracks.push({ id: 'lower', type: 'video', clips: [{ id: 'lower-clip', mediaId: 'background', start: 0, duration: 2 }] });
  const { errors } = await openFixture(page, { fixture });
  const node = page.locator('[data-node-card-id="timeline"]');
  const canvas = node.locator('.assembly-frame-canvas');
  const image = page.locator('[data-node-card-id="viewer"] img').first();
  const corner = () => canvas.evaluate(element => [...element.getContext('2d').getImageData(10, 10, 1, 1).data]);
  await expect.poll(corner).toEqual([0, 255, 0, 255]);

  const ruler = node.locator('.assembly-ruler');
  const rulerBox = await ruler.boundingBox();
  const beforeScrub = await canvas.evaluate(element => element.toDataURL());
  await page.mouse.move(rulerBox.x + 12, rulerBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(rulerBox.x + 20, rulerBox.y + 12);
  await expect.poll(() => canvas.evaluate(element => element.toDataURL())).not.toBe(beforeScrub);
  await expect.poll(corner).toEqual([0, 255, 0, 255]);
  await page.mouse.up();
  await expect.poll(async () => parseInt((await node.locator('.assembly-cache-count').textContent()) || '0', 10)).toBeGreaterThanOrEqual(16);
  const video = node.locator('.assembly-media-pool video');
  await video.evaluate(element => {
    Object.defineProperty(element, 'readyState', { configurable: true, get: () => 1 });
    Object.defineProperty(element, 'seeking', { configurable: true, get: () => true });
  });
  const initial = await image.getAttribute('src');
  await node.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => image.getAttribute('src')).not.toBe(initial);
  const [, green] = await corner();
  expect(green).toBeGreaterThan(245);
  await node.getByRole('button', { name: 'Pause', exact: true }).click();
  await video.evaluate(element => { delete element.readyState; delete element.seeking; });
  await node.locator('[data-track-id="lower"]').locator('..').getByRole('button', { name: 'Hide track' }).click();
  await expect.poll(corner).toEqual([0, 0, 0, 255]);
  await node.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(corner).toEqual([0, 0, 0, 255]);
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

test('Timeline moves video layers above one another and restores their order on undo', async ({ page }) => {
  const fixture = canvasFixture({ timeline: true, scale: 0.7 });
  const { assembly } = fixture.nodes.find(node => node.id === 'timeline').data;
  const still = color => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><path fill="${color}" d="M0 0h640v360H0z"/></svg>`);
  assembly.media = ['red', 'blue'].map(color => ({ id: color, type: 'image', url: still(color), width: 640, height: 360 }));
  assembly.tracks = ['red', 'blue'].map((color, index) => ({ id: color, name: `V${index + 1}`, type: 'video', clips: [{ id: `${color}-clip`, mediaId: color, duration: 2 }] }));
  assembly.tracks.push({ id: 'audio', name: 'A1', type: 'audio', clips: [] });
  const { errors } = await openFixture(page, { fixture });
  const timeline = page.locator('[data-node-card-id="timeline"]');
  const layers = timeline.locator('.assembly-track-header > strong');
  const canvas = timeline.locator('.assembly-frame-canvas');
  const pixel = () => canvas.evaluate(element => [...element.getContext('2d').getImageData(10, 10, 1, 1).data]);
  await expect.poll(pixel).toEqual([255, 0, 0, 255]);
  await expect(timeline.getByRole('button', { name: 'Move V1 up' })).toBeDisabled();
  await expect(timeline.getByRole('button', { name: 'Move V2 down' })).toBeDisabled();
  await timeline.getByRole('button', { name: 'Move V2 up' }).click();
  await expect(layers).toHaveText(['V2', 'V1', 'A1']);
  await expect.poll(pixel).toEqual([0, 0, 255, 255]);
  await timeline.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(layers).toHaveText(['V1', 'V2', 'A1']);
  await expect.poll(pixel).toEqual([255, 0, 0, 255]);
  expect(errors).toEqual([]);
});
