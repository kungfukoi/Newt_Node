import test from "node:test";
import assert from "node:assert/strict";
import { AssemblyPlaybackClock } from "../src/assembly/assemblyPlayback.js";

test("paused Timeline duration changes do not report active playback", () => {
  const emissions = [];
  let queued = null;
  const clock = new AssemblyPlaybackClock({
    duration: 10,
    requestFrame: (callback) => {
      queued = callback;
      return 1;
    },
    cancelFrame: () => {
      queued = null;
    },
    onTime: (time, state) => emissions.push({ time, state })
  });

  clock.seek(6);
  clock.setDuration(12);
  assert.deepEqual(emissions.at(-1), { time: 6, state: "paused" });

  clock.setLoopRange(2, 4, true);
  clock.seek(8);
  clock.play();
  assert.deepEqual(emissions.at(-1), { time: 2, state: "playing" });
  assert.equal(typeof queued, "function");
});

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
