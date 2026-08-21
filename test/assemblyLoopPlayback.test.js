import test from "node:test";
import assert from "node:assert/strict";
import { AssemblyPlaybackClock } from "../src/assembly/assemblyPlayback.js";
import {
  clearAssemblyInOut,
  createAssemblyState,
  setAssemblyInPoint,
  setAssemblyLoopInOut,
  setAssemblyOutPoint,
  setAssemblyPlayhead
} from "../src/assembly/assemblyState.js";

test("Timeline loop mode requires a valid marker range and enters at In", () => {
  let state = setAssemblyLoopInOut(createAssemblyState(), true);
  assert.equal(state.loopInOut, false);

  state = setAssemblyPlayhead(state, 8);
  state = setAssemblyInPoint(state, 2);
  state = setAssemblyOutPoint(state, 4);
  state = setAssemblyLoopInOut(state, true);
  assert.equal(state.loopInOut, true);
  assert.equal(state.playhead, 2);

  state = clearAssemblyInOut(state);
  assert.equal(state.loopInOut, false);
});

test("Timeline playback wraps continuously from Out back to In", () => {
  let currentNow = 1000;
  let queued = null;
  const times = [];
  const states = [];
  const clock = new AssemblyPlaybackClock({
    duration: 10,
    now: () => currentNow,
    requestFrame: (callback) => {
      queued = callback;
      return 1;
    },
    cancelFrame: () => {
      queued = null;
    },
    onTime: (time) => times.push(time),
    onState: (state) => states.push(state)
  });

  clock.setLoopRange(2, 4, true);
  clock.seek(3.75);
  clock.play();
  currentNow = 1500;
  queued(currentNow);

  assert.equal(times.at(-1), 2.25);
  assert.equal(states.at(-1), "playing");
  clock.pause();
  assert.equal(states.at(-1), "paused");

  clock.seek(8);
  clock.play();
  assert.equal(times.at(-1), 2);
});
