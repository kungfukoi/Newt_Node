import assert from 'node:assert/strict';
import test from 'node:test';
import { saveGeneratedVideoWithFallback } from '../server/video-save-fallback.js';
const job = () => ({ spec: { body: { outputTargetPath: '/inaccessible/share', workflowPackagePath: '/workflow', outputTargetNodeId: 'out' } } });

test('reservation failure falls back without changing paid inputs and checkpoints the actual destination', async () => {
  const original = job(), checkpoints = []; let downloads = 0;
  const result = await saveGeneratedVideoWithFallback(original, {
    reserve: async body => { if (body.outputTargetPath) throw Object.assign(Error('unavailable'), { code: 'EPERM' }); return { filePath: '/workflow/outputs/video.mp4' }; },
    download: async (_, target) => { downloads++; return target; }, checkpoint: async patch => checkpoints.push(patch)
  });
  assert.equal(result.fallback, true); assert.match(result.warning, /workflow.*outputs/); assert.equal(downloads, 1);
  assert.equal(original.spec.body.outputTargetPath, '/inaccessible/share');
  assert.equal(checkpoints.find(p => p.storageBody).storageBody.outputTargetPath, '');
});

test('write failure at an existing target redirects the same generated video', async () => {
  let downloads = 0;
  const result = await saveGeneratedVideoWithFallback({ ...job(), target: { filePath: '/share/existing.mp4' } }, {
    reserve: async () => ({ filePath: '/workflow/outputs/recovered.mp4' }),
    download: async (_, target) => { if (++downloads === 1) throw Object.assign(Error('disk full'), { code: 'ENOSPC' }); return target; }, checkpoint: async () => {}
  });
  assert.equal(result.output.filePath, '/workflow/outputs/recovered.mp4'); assert.equal(downloads, 2);
});

test('failed fallback pauses instead of silently choosing another location or repeating paid work', async () => {
  let attempts = 0;
  await assert.rejects(saveGeneratedVideoWithFallback(job(), { reserve: async () => { attempts++; throw Object.assign(Error('no space'), { code: 'ENOSPC' }); }, download: async () => assert.fail(), checkpoint: async () => {} }), /no space/);
  assert.equal(attempts, 2);
});

test('preflight-selected fallback and saved download survive restart without redownloading', async () => {
  const savedOutput = { filePath: '/workflow/outputs/video.mp4' };
  const result = await saveGeneratedVideoWithFallback({ ...job(), spec: { ...job().spec, storageFallback: true }, target: savedOutput, savedOutput }, {
    reserve: async () => assert.fail(), download: async () => assert.fail(), checkpoint: async () => {}
  });
  assert.equal(result.output, savedOutput); assert.equal(result.fallback, true);
});
