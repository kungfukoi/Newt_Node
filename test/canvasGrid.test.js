import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasDragDelta, canvasDragAnchor } from '../src/canvasGrid.js';
test('grid movement preserves offsets, supports negative coordinates and bypass',()=>{
 const nodes=[{x:31,y:-17},{x:94,y:47}];const delta={x:12,y:38};
 assert.deepEqual(canvasDragDelta(canvasDragAnchor(nodes),delta,true),{x:25,y:45});
 assert.equal(canvasDragDelta(nodes[0],delta,false),delta);
 assert.deepEqual(canvasDragDelta(nodes[0],{x:0,y:0},true),{x:0,y:0});
});
