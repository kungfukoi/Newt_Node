import assert from 'node:assert/strict';
import test from 'node:test';
import { createNodeRunControl } from '../src/nodeRunControl.js';

test('stop releases a hung run and leaves other nodes active', async () => {
  const control = createNodeRunControl();
  let oldToken, finishOld, finishOther;
  const old = control.run('a', token => { oldToken = token; return new Promise(resolve => { finishOld = resolve; }); });
  const other = control.run('b', () => new Promise(resolve => { finishOther = resolve; }));
  await Promise.resolve();
  control.stop('a');
  assert.equal((await old).status, 'error');
  assert.equal(oldToken.stopped, true);
  assert.equal(control.get('a'), undefined);
  assert.ok(control.get('b'));
  let newToken;
  const newer = control.run('a', token => { newToken = token; return new Promise(() => {}); });
  await Promise.resolve();
  finishOld({ status: 'complete' });
  await Promise.resolve();
  assert.equal(control.get('a'), newToken);
  control.stop('a'); await newer;
  finishOther({ status: 'complete' });
  assert.equal((await other).status, 'complete');
});

test('errors release ownership and duplicate runs are skipped', async () => {
  const control = createNodeRunControl();
  const active = control.run('a', () => new Promise(() => {}));
  assert.equal((await control.run('a', () => { throw Error('duplicate'); })).status, 'skipped');
  control.stop('a'); await active;
  await assert.rejects(control.run('a', () => { throw Error('provider failure'); }), /provider failure/);
  assert.equal(control.get('a'), undefined);
});
