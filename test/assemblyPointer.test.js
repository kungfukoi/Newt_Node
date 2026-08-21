import test from "node:test";
import assert from "node:assert/strict";
import { assemblyLocalX, assemblyTimeAtClientX } from "../src/assembly/assemblyPointer.js";

function timelineElement({ left = 100, renderedWidth = 200, layoutWidth = 800 } = {}) {
  return {
    offsetWidth: layoutWidth,
    getBoundingClientRect() {
      return { left, width: renderedWidth };
    }
  };
}

test("Timeline pointer coordinates compensate for canvas zoom", () => {
  const element = timelineElement();
  assert.equal(assemblyLocalX(element, 150), 200);
  assert.equal(assemblyTimeAtClientX(element, 150, 80), 2.5);
});

test("Timeline pointer time clamps before the start of the ruler", () => {
  assert.equal(assemblyTimeAtClientX(timelineElement(), 75, 80), 0);
});

test("Timeline pointer coordinates remain unchanged at native scale", () => {
  const element = timelineElement({ left: 40, renderedWidth: 800, layoutWidth: 800 });
  assert.equal(assemblyLocalX(element, 200), 160);
});

test("Timeline bin drops stay under the cursor with canvas zoom and horizontal scroll", () => {
  const element = timelineElement({ left: -120, renderedWidth: 280, layoutWidth: 1000 });
  const desiredTime = 12;
  const pixelsPerSecond = 80;
  const clientX = -120 + desiredTime * pixelsPerSecond * 0.28;
  assert.equal(assemblyTimeAtClientX(element, clientX, pixelsPerSecond), desiredTime);
});
