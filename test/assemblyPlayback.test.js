import test from "node:test";
import assert from "node:assert/strict";
import { AssemblyPlaybackClock } from "../src/assembly/assemblyPlayback.js";

test("timeline clock owns seek, play, pause, and duration boundaries", () => {
  let currentNow = 1000;
  let queued = null;
  const times = [];
  const states = [];
  const clock = new AssemblyPlaybackClock({
    duration: 2,
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

  clock.seek(0.5);
  clock.play();
  currentNow = 1500;
  queued(currentNow);
  assert.equal(times.at(-1), 1);
  clock.pause();
  assert.equal(states.at(-1), "paused");
  clock.seek(8);
  assert.equal(times.at(-1), 2);
});
