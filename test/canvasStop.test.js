import test from 'node:test';import assert from 'node:assert/strict';
import { activeCanvasNodes, stoppedCanvasNodePatch } from '../src/canvasStop.js';
import { runRunnableNodesByDependencyOrder } from '../src/nodeRunner.js';
test('canvas stop selects all active kinds and preserves completed nodes', () => {
 const nodes = [{id:'a',data:{status:'running'}},{id:'b',data:{status:'planning'}},{id:'c',data:{characterVoiceBusy:true}},{id:'d',data:{status:'complete'}},{id:'e',data:{}}];
 assert.deepEqual(activeCanvasNodes(nodes,['e']).map(n=>n.id),['a','b','c','e']);
 const frame={id:'done',status:'complete',resultUrl:'/saved.png'};
 const patch=stoppedCanvasNodePatch({type:'storyboard',data:{storyboardFrames:[frame,{id:'queue',status:'queued'}]}},'Stopped');
 assert.equal(patch.storyboardFrames[0],frame); assert.equal(patch.storyboardFrames[1].status,'error');assert.equal(patch.storyboardRevisionActive,false);
});
test('canvas abort prevents queued and downstream nodes from starting', async () => {
 const controller=new AbortController();let release;const starts=[];
 const nodes=[{id:'a',type:'imageModel',data:{}},{id:'b',type:'imageModel',data:{}},{id:'c',type:'videoModel',data:{}}];
 const work=runRunnableNodesByDependencyOrder(nodes,[{from:{nodeId:'a'},to:{nodeId:'c'}}],{maxConcurrent:1,signal:controller.signal,runNode:node=>{starts.push(node.id);return new Promise(resolve=>{release=resolve;});}});
 await Promise.resolve();await Promise.resolve();controller.abort();release({status:'error'});
 const result=await work;assert.deepEqual(starts,['a']);assert.equal(result.cancelled,true);assert.equal(result.skipped,1);
});
