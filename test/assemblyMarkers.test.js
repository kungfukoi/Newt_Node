import test from "node:test";
import assert from "node:assert/strict";
import {
  assemblyDuration,
  clearAssemblyInOut,
  createAssemblyState,
  setAssemblyInPoint,
  setAssemblyOutPoint
} from "../src/assembly/assemblyState.js";

test("Timeline In and Out markers snap to frames and persist as a range", () => {
  let state = createAssemblyState({ playhead: 2 });
  state = setAssemblyInPoint(state);
  state = setAssemblyOutPoint(state, 6);
  assert.equal(state.inPoint, 2);
  assert.equal(state.outPoint, 6);
});

test("crossing a Timeline marker clears the stale opposite boundary", () => {
  let state = createAssemblyState({ inPoint: 2, outPoint: 6 });
  state = setAssemblyInPoint(state, 8);
  assert.equal(state.inPoint, 8);
  assert.equal(state.outPoint, null);

  state = setAssemblyOutPoint(state, 5);
  assert.equal(state.inPoint, 0);
  assert.equal(state.outPoint, 5);
});

test("setting only a Timeline Out marker creates an In marker at frame 1", () => {
  const state = setAssemblyOutPoint(createAssemblyState({ playhead: 5 }));
  assert.equal(state.inPoint, 0);
  assert.equal(state.outPoint, 5);
});

test("saved Out-only ranges recover their In marker at frame 1", () => {
  const state = createAssemblyState({ inPoint: null, outPoint: 8 });
  assert.equal(state.inPoint, 0);
  assert.equal(state.outPoint, 8);
});

test("Timeline marker working space stays visible and can be cleared", () => {
  const marked = createAssemblyState({ inPoint: 3, outPoint: 18 });
  assert.equal(assemblyDuration(marked), 18);
  assert.deepEqual(
    { inPoint: clearAssemblyInOut(marked).inPoint, outPoint: clearAssemblyInOut(marked).outPoint },
    { inPoint: null, outPoint: null }
  );
});
