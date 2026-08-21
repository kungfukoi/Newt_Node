import test from "node:test";
import assert from "node:assert/strict";
import { clearAssemblyLiveFrame, publishAssemblyLiveFrame, subscribeAssemblyLiveFrame } from "../src/assembly/assemblyLiveFrameBus.js";

test("Timeline live frame bus publishes immediately without graph-state polling", () => {
  const received = [];
  const unsubscribe = subscribeAssemblyLiveFrame("timeline-a", (frame) => received.push(frame));
  publishAssemblyLiveFrame({ nodeId: "timeline-a", url: "data:image/jpeg;base64,a", frameTime: 1, targetFrameRate: 24, emittedAt: 10 });
  publishAssemblyLiveFrame({ nodeId: "timeline-a", url: "data:image/jpeg;base64,b", frameTime: 2, targetFrameRate: 24, emittedAt: 20 });
  unsubscribe();
  clearAssemblyLiveFrame("timeline-a");

  assert.deepEqual(received.map((frame) => frame.frameTime), [1, 2]);
  assert.equal(received[1].targetFrameRate, 24);
});

test("Timeline live frame subscribers receive the latest frame on connection", () => {
  publishAssemblyLiveFrame({ nodeId: "timeline-b", url: "data:image/jpeg;base64,current", frameTime: 3 });
  let current = null;
  const unsubscribe = subscribeAssemblyLiveFrame("timeline-b", (frame) => { current = frame; });
  unsubscribe();
  clearAssemblyLiveFrame("timeline-b");

  assert.equal(current?.frameTime, 3);
});
