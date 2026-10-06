import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NewtPresetStore } from '../server/newt-presets.js';
import { instantiateNewtPreset } from '../src/newtPresets.js';
test('six system presets insert with fresh IDs, restore media and cannot be deleted', async t => {
 const root=await mkdtemp(path.join(os.tmpdir(),'newt-presets-test-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const store=new NewtPresetStore({directory:path.join(root,'user'),systemDirectory:path.resolve('server/system-newt-presets'),assetsDirectory:path.join(root,'assets'),assetsUrl:'/outputs/Newt-Presets/dependencies',collectAssetUrls:()=>[],rewriteAssetUrls:g=>g});
 const items=await store.list();assert.equal(items.length,6);assert.ok(items.every(p=>p.isSystem));
 const manifest=JSON.parse(await readFile('server/system-newt-presets/manifest.json','utf8'));
 for(const item of items){const preset=await store.get(item.id);const graph=instantiateNewtPreset(preset.graph);assert.equal(graph.nodes.length,item.nodeCount);assert.ok(graph.nodes.every(n=>!preset.graph.nodes.some(old=>old.id===n.id)));await assert.rejects(store.remove(item.id),/permanent/);
 for(const asset of manifest.presets.find(p=>p.id===item.id).assets){assert.ok((await stat(path.join(root,'assets',item.id,decodeURIComponent(asset.url.split('/').at(-1))))).size>0);}}
 const copy=await store.save({name:'My copy',graph:(await store.get(items[0].id)).graph});assert.equal(copy.isSystem,false);await store.remove(copy.id);assert.equal((await store.list()).length,6);
});
