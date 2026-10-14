import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { seedanceSubmittedPrompt } from '../src/seedancePrompt.js';
import { directorDialogueBrief } from '../src/characterDialogue.js';
import { verifyVideoOutputDestination } from '../server/video-output-preflight.js';

test('Atlas keeps the entire creative prompt and strips local diagnostic context', () => {
  const creative = 'Use @Image1 and @Video1. ' + 'Preserve exact motion and camera position. '.repeat(160) + 'Final essential instruction.';
  assert.ok(creative.length > 4000);
  const value = creative + '\n\nNode reference context:\nReferenced video node @Video1: /workflow-assets/p/inputs/private.mp4';
  assert.equal(seedanceSubmittedPrompt(value, 'atlas'), creative);
  assert.ok(new TextEncoder().encode(seedanceSubmittedPrompt(value, 'krea')).length <= 4000);
  assert.doesNotMatch(seedanceSubmittedPrompt(value, 'atlas'), /compacted|workflow-assets|Node reference context/);
});

test('empty dialogue placeholders never enter authoritative speech instructions', () => {
  assert.equal(directorDialogueBrief({ lines: [{ id: 'empty', text: '' }] }), '');
  const value = directorDialogueBrief({ characters: [{ nodeId: 'a', tag: 'Alice' }], lines: [{ text: ' ' }, { text: 'Hello.', characterNodeId: 'a' }] });
  assert.match(value, /@Alice: "Hello\."/); assert.doesNotMatch(value, /Unbound|: ""/);
});

test('output preflight creates and removes only its own write probe', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'newt-preflight-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await verifyVideoOutputDestination({}, { fallbackDirectory: dir });
  assert.deepEqual(await readdir(dir), []);
});

test('permission failure is reported before submission and disk space is not retried blindly', async () => {
  let writes = 0;
  await assert.rejects(verifyVideoOutputDestination({}, { fallbackDirectory: 'fixture', io: {
    mkdir: async () => { throw Object.assign(Error('private path'), { code: 'EPERM' }); },
    writeFile: async () => { writes++; }, rm: async () => {}
  } }), error => error.status === 400 && error.code === 'EPERM' && /No video generation was submitted/.test(error.message) && !/private path/.test(error.message));
  assert.equal(writes, 0);
});


test('prompt cleanup preserves meaningful text, character and dialogue instructions appended after context', () => {
  const value = 'Animate @Image1.' + '\n\nNode reference context:\nReferenced node @Video1:\nVideo output: source.mp4 (/workflow-assets/p/inputs/source.mp4)\n\nReferenced video node @Video1: /workflow-assets/p/inputs/source.mp4\n\nReferenced node @Look:\nWarm daylight and blue fill.\n\nAUTHORITATIVE DIALOGUE: Alice says hello.';
  const cleaned = seedanceSubmittedPrompt(value, 'atlas');
  assert.match(cleaned, /Warm daylight and blue fill/); assert.match(cleaned, /AUTHORITATIVE DIALOGUE/);
  assert.doesNotMatch(cleaned, /Video output|workflow-assets|Node reference context/);
});

test('output preflight chooses a tested managed fallback when the configured output fails', async () => {
  const directories = [], written = [];
  const result = await verifyVideoOutputDestination({ outputTargetPath: 'invalid-share' }, { rootDir: '/fixture', fallbackDirectory: '/fixture/workflow/outputs', io: {
    mkdir: async directory => { directories.push(directory); if (!directory.endsWith('workflow/outputs')) throw Object.assign(Error('unavailable'), { code: 'EPERM' }); },
    writeFile: async file => written.push(file), rm: async () => {}
  } });
  assert.equal(result.fallback, true); assert.equal(written.length, 1); assert.ok(written[0].replaceAll('\\', '/').includes('workflow/outputs'));
});


test('Atlas reference duration checks reject unreadable, too short and excessive combined media', async () => {
  const { validateAtlasSeedanceDurations } = await import('../src/atlasSeedanceLimits.js');
  validateAtlasSeedanceDurations([3.333333, 3.461792], []);
  validateAtlasSeedanceDurations([], [6, 6, 6]);
  for (const values of [[0], [1.8], [31], [20, 20]]) assert.throws(() => validateAtlasSeedanceDurations(values), /No generation was submitted/);
  assert.throws(() => validateAtlasSeedanceDurations([], [20, 20]), /audio/);
});
