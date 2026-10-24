import { test, expect } from '@playwright/test';
import { openFixture } from './helpers.mjs';

for (const recovered of [false, true]) test(`Stop keeps ${recovered ? 'recovered' : 'batched'} Outpaint jobs stopped across polling and reload`, async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seedance-node-editor-draft-v1')) return;
    sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify({ nodes: [
      { id: 'source', type: 'video', x: 20, y: 20, data: { resultUrl: '/outputs/e2e/source.mp4', status: 'complete' } },
      { id: 'outpaint', type: 'utility', x: 500, y: 20, data: { title: 'Outpaint', utilityMode: 'video', utilityVideoModel: 'Video Outpaint', prompt: 'Continue the scene.', outpaintPromptMode: 'manual', batchCount: '2', settingsOpen: true } }
    ], edges: [{ id: 'wire', from: { nodeId: 'source', port: 'videoOut' }, to: { nodeId: 'outpaint', port: 'referenceVideoIn' } }], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } }));
  });
  const jobs = recovered ? [{ runId: 'recovered-outpaint', nodeId: 'outpaint', groupId: 'old', batchIndex: 1, state: 'running', createdAt: '2026-10-23T12:00:00Z' }] : [];
  let stopped = false, sent, polls = 0;
  const generations = [];
  const { errors } = await openFixture(page, { count: 2, remoteVideoJobs: route => {
    polls++;
    const scope = new URL(route.request().url()).searchParams.get('scope');
    return route.fulfill({ json: { jobs: jobs.map(job => ({ ...job, scope, state: stopped ? 'dismissed' : job.state })), cursor: 'fixture:' + polls, reset: true, pollAfterMs: 3000 } });
  } });
  await page.route('**/api/health', route => route.fulfill({ json: { ok: true, routes: { generationProgress: true, remoteVideoJobs: true, videoOutpaintMatching: true, videoOutpaintConsistency: true, videoOutpaintPreparedReuse: true, videoOutpaintFullResolution: true, videoOutpaintLocalMasks: true, videoOutpaintSeedance: true, videoOutpaintSeedanceSourceFrames: true, seedanceVideoEditing: true } } }));
  await page.route('**/api/node/generate-video', route => {
    const body = route.request().postDataJSON(); generations.push(body);
    const job = { runId: body.generationRunId, nodeId: 'outpaint', groupId: body.generationGroupId, batchIndex: body.generationBatchIndex, state: 'running', scope: body.generationScope, createdAt: new Date().toISOString() };
    jobs.push(job);
    return route.fulfill({ status: 202, json: { job } });
  });
  await page.route(/\/api\/remote-video-jobs\/[^/?]+$/, route => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
    return route.fulfill({ json: { job: { ...jobs.find(job => job.runId === id), state: stopped ? 'dismissed' : 'running' } } });
  });
  await page.route('**/api/remote-video-jobs/stop-node', route => { sent = route.request().postDataJSON(); stopped = true; return route.fulfill({ json: { jobs: [] } }); });
  const node = page.locator('[data-node-card-id="outpaint"]');
  if (!recovered) {
    await node.locator('.run-node-button').click();
    await expect.poll(() => generations.length).toBe(2);
    expect(new Set(generations.map(body => body.generationGroupId)).size).toBe(1);
    expect(generations[0].generationGroupId).toBeTruthy();
    expect(generations.map(body => body.generationBatchIndex).sort()).toEqual([1, 2]);
  }
  await expect(node.locator('.run-node-button')).toBeDisabled();
  await page.getByRole('button', { name: 'Stop all active canvas nodes', exact: true }).click();
  await expect.poll(() => sent?.nodeId).toBe('outpaint');
  expect(sent.groupIds).toEqual(recovered ? [] : [generations[0].generationGroupId]);
  await expect(node.locator('.run-node-button')).toBeEnabled();
  const afterStop = polls;
  await expect.poll(() => polls, { timeout: 12000 }).toBeGreaterThan(afterStop + 1);
  await expect(node.locator('.run-node-button')).toBeEnabled();
  expect(generations.length).toBe(recovered ? 0 : 2);
  await page.reload(); await page.getByRole('button', { name: 'Nodes', exact: true }).click();
  await expect(node.locator('.run-node-button')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('Stop releases a running image node and ignores a late successful response', async ({ page }) => {
  const { errors } = await openFixture(page, { generation: true, scale: 1 });
  let finish;
  await page.route('**/api/node/generate-image', async route => {
    await new Promise(resolve => { finish = resolve; });
    await route.fulfill({ json: { images: [{ localUrl: '/outputs/e2e/late.png', fileName: 'late.png' }] } });
  });
  const node = page.locator('[data-node-card-id="model"]');
  await node.locator('.run-node-button').click();
  await expect(page.getByRole('button', { name: 'Stop all active canvas nodes', exact: true })).toBeVisible();
  await expect.poll(() => Boolean(finish)).toBe(true);
  await page.getByRole('button', { name: 'Stop all active canvas nodes', exact: true }).click();
  await expect(node.getByText('Stopped at user request.', { exact: false })).toBeVisible();
  await expect(node.locator('.run-node-button')).toBeEnabled();
  finish();
  await expect(node.locator('.node-stop-button, .stop-node-button')).toHaveCount(0);
  await expect(node.locator('.run-node-button')).toBeEnabled();
  await expect(node.locator('img[src*="late.png"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});


test('Stop dismisses a recovered video job without submitting paid work', async ({ page }) => {
  let stopped = false, sent = null;
  const { errors, requests } = await openFixture(page, { videoProgress: true, scale: 1, remoteVideoJobs: route => {
    const scope = new URL(route.request().url()).searchParams.get('scope');
    return route.fulfill({ json: { jobs: [{ runId: 'stuck', nodeId: 'model', groupId: 'old', batchIndex: 1, scope, state: stopped ? 'dismissed' : 'recovering', createdAt: '2026-10-13T12:00:00Z', message: stopped ? 'Stopped at user request.' : 'Retrying local save' }], cursor: 'fixture:1', reset: true, pollAfterMs: 3000 } });
  } });
  await page.route('**/api/remote-video-jobs/stop-node', route => {
    sent = route.request().postDataJSON(); stopped = true;
    return route.fulfill({ json: { jobs: [] } });
  });
  const node = page.locator('[data-node-card-id="model"]');
  const stop = page.getByRole('button', { name: 'Stop all active canvas nodes', exact: true });
  await expect(stop).toBeVisible();
  await expect(node.locator('.run-node-button')).toBeDisabled();
  await stop.click();
  await expect.poll(() => sent?.nodeId).toBe('model');
  expect(JSON.parse(sent.scope)[0]).toBe('browser-regression-project');
  await expect(node.locator('.run-node-button')).toBeEnabled();
  expect(requests.filter(request => request.method === 'POST' && request.path.startsWith('/api/node/'))).toEqual([]);
  expect(errors).toEqual([]);
});


test('completed video with blocked fallback offers local recovery without a new generation', async ({ page }) => {
  let recovered = false, recovery = null;
  await openFixture(page, { videoProgress: true, scale: 1, remoteVideoJobs: route => {
    const scope = new URL(route.request().url()).searchParams.get('scope');
    return route.fulfill({ json: { jobs: [{ runId: 'saved-video', nodeId: 'model', groupId: 'blocked', batchIndex: 1, scope, state: recovered ? 'dismissed' : 'save_blocked', createdAt: '2026-10-13T12:00:00Z', message: 'Video generated; storage blocked.' }], cursor: 'fixture:1', reset: true, pollAfterMs: 3000 } });
  } });
  await page.route('**/api/remote-video-jobs/saved-video/recover', route => {
    recovery = route.request().postDataJSON(); recovered = true;
    return route.fulfill({ json: { job: { state: 'downloading' } } });
  });
  const node = page.locator('[data-node-card-id="model"]');
  await node.getByText('Run 1: Video generated — save blocked', { exact: true }).click();
  await node.getByRole('button', { name: 'Save to workflow outputs', exact: true }).click();
  await expect.poll(() => recovery?.action).toBe('save-to-workflow');
  expect(recovery.acknowledged).toBe(true);
  await expect(node.locator('.run-node-button')).toBeEnabled();
});


test('red canvas X stops two active nodes together and sits beside Snap and zoom', async ({ page }) => {
  const { fixture } = await openFixture(page, { generation: true, scale: 1 });
  const model = fixture.nodes.find(node => node.id === 'model');
  const twins = { ...fixture, nodes: [model, { ...model, id: 'second', x: 600, y: 30, data: { ...model.data, title: 'Second generator' } }], edges: [] };
  await page.addInitScript(value => sessionStorage.setItem('seedance-node-editor-draft-v1', JSON.stringify(value)), twins);
  const finish = [];
  await page.route('**/api/node/generate-image', async route => {
    await new Promise(resolve => finish.push(resolve));
    await route.fulfill({ json: { images: [{ localUrl: '/outputs/e2e/late.png' }] } });
  });
  await page.reload(); await page.getByRole('button', { name: 'Nodes', exact: true }).click();
  const first = page.locator('[data-node-card-id="model"]'), second = page.locator('[data-node-card-id="second"]');
  await first.locator('.run-node-button').click(); await second.locator('.run-node-button').click();
  await expect.poll(() => finish.length).toBe(2);
  const controls = page.locator('.zoom-controls');
  await expect(controls.getByRole('button', { name: 'Snap to grid', exact: true })).toBeVisible();
  const stop = controls.getByRole('button', { name: 'Stop all active canvas nodes', exact: true });
  await expect(stop).toHaveCSS('color', 'rgb(255, 92, 92)');
  await expect(page.locator('.node-stop-button, .stop-node-button')).toHaveCount(0);
  await stop.click();
  await expect(first.locator('.run-node-button')).toBeEnabled(); await expect(second.locator('.run-node-button')).toBeEnabled();
  finish.forEach(resolve => resolve());
  await expect(first.getByText('Stopped at user request.', { exact: false })).toBeVisible();
  await expect(second.getByText('Stopped at user request.', { exact: false })).toBeVisible();
});
